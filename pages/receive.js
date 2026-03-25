import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

import FileCard from '@/components/FileCard';
import ProgressBar from '@/components/ProgressBar';
import { Download, Users, Zap, CheckCircle, UserPlus, PackageOpen, Camera } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';

import { createPeerConnection } from '@/utils/webrtc';
import { SwarmManager } from '@/utils/swarmManager';
import { Scheduler } from '@/utils/scheduler';
import { StorageManager } from '@/utils/storage';
import { decodeChunk, CryptoUtils, encodeChunk } from '@/utils/chunkProtocol';
import { getToken, isLoggedIn, setToken } from '@/utils/auth';

export default function ReceivePage() {
  const router = useRouter();
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('waiting');
  const [filesMeta, setFilesMeta] = useState([]);
  const [fileProgress, setFileProgress] = useState([]);
  const [downloadUrls, setDownloadUrls] = useState([]);
  const [activePeers, setActivePeers] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [speed, setSpeed] = useState('');
  const [eta, setEta] = useState('');
  const [showScanner, setShowScanner] = useState(false);

  const socketRef = useRef(null);
  const connectionsRef = useRef(new Map());
  const channelsRef = useRef(new Map());

  const swarmManagerRef = useRef(null);
  const schedulerRef = useRef(null);
  const filesMetaRef = useRef(null);
  const transferIdRef = useRef(null);

  // Per-file tracking: Map of fileIndex -> Set of chunk indices received
  const receivedChunksRef = useRef(new Map());
  const requestedChunksRef = useRef(new Set());
  const completedFilesRef = useRef(new Set());

  // Stats
  const startTimeRef = useRef(null);
  const bytesReceivedRef = useRef(0);
  const lastUpdateBytesRef = useRef(0);
  const lastUpdateTimeRef = useRef(null);
  const totalChunksRef = useRef(0);
  const totalReceivedRef = useRef(0);

  // Auto-join from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const token = params.get('token');

    if (token) {
      setToken(token);
    }

    if (room) {
      setRoomId(room);
      // Auto-join after a short delay to ensure state is set
      setTimeout(() => joinRoom(room), 500);
    }
  }, []);

  // Speed & peer count
  useEffect(() => {
    const interval = setInterval(() => {
      if (status === 'transferring' && filesMetaRef.current && startTimeRef.current) {
        const now = Date.now();
        const timeDiff = (now - lastUpdateTimeRef.current) / 1000;
        if (timeDiff >= 1) {
          const bytesDiff = bytesReceivedRef.current - lastUpdateBytesRef.current;
          const currentSpeedBps = bytesDiff / timeDiff;

          if (currentSpeedBps > 0) {
            const speedMB = (currentSpeedBps / (1024 * 1024)).toFixed(2);
            setSpeed(`${speedMB} MB/s`);

            const totalSize = filesMetaRef.current.reduce((acc, f) => acc + f.size, 0);
            const remainingBytes = totalSize - bytesReceivedRef.current;
            const remainingSeconds = Math.max(0, remainingBytes / currentSpeedBps);

            if (remainingSeconds < 60) {
              setEta(`${Math.round(remainingSeconds)}s remaining`);
            } else {
              setEta(`${Math.round(remainingSeconds / 60)}m remaining`);
            }
          }

          lastUpdateBytesRef.current = bytesReceivedRef.current;
          lastUpdateTimeRef.current = now;
        }

        let readyChannels = 0;
        for (const channel of channelsRef.current.values()) {
          if (channel.readyState === 'open') readyChannels++;
        }
        setActivePeers(readyChannels);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const joinRoom = (overrideRoomId = null) => {
    const room = overrideRoomId || roomId;
    if (!room) return;
    setStatus('joining');

    const token = getToken();
    socketRef.current = io(process.env.NEXT_PUBLIC_SIGNALING_SERVER || window.location.origin, {
      auth: { token }
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join-room', room);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      setStatus('auth_error');
    });

    socketRef.current.on('room-peers', async (peerIds) => {
      setStatus('connecting_peers');
      for (const peerId of peerIds) {
        initiateConnection(peerId);
      }
    });

    socketRef.current.on('offer', async (data) => {
      await handleOffer(data.sender, data.offer);
    });

    socketRef.current.on('answer', async (data) => {
      const pc = connectionsRef.current.get(data.sender);
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
    });

    socketRef.current.on('ice-candidate', async (data) => {
      const pc = connectionsRef.current.get(data.sender);
      if (pc && data.candidate) await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
    });

    socketRef.current.on('peer-disconnected', (peerId) => {
      const pc = connectionsRef.current.get(peerId);
      if (pc) pc.close();
      connectionsRef.current.delete(peerId);
      channelsRef.current.delete(peerId);
      if (swarmManagerRef.current) swarmManagerRef.current.removePeer(peerId);
    });
  };

  const setupDataChannel = (peerId, channel) => {
    channel.binaryType = 'arraybuffer';
    channelsRef.current.set(peerId, channel);

    channel.onopen = async () => {
      if (transferIdRef.current) {
        const allChunks = [];
        for (const [fi, chunks] of receivedChunksRef.current.entries()) {
          for (const ci of chunks) {
            allChunks.push({ fileIndex: fi, chunkIndex: ci });
          }
        }
        channel.send(JSON.stringify({ type: 'BITFIELD', chunks: allChunks }));
      }
    };

    channel.onmessage = async (e) => {
      if (typeof e.data === 'string') {
        const message = JSON.parse(e.data);
        handleControlMessage(peerId, message);
      } else {
        await handleChunkData(peerId, e.data);
      }
    };
  };

  const initiateConnection = async (peerId) => {
    const pc = createPeerConnection();
    connectionsRef.current.set(peerId, pc);

    const channel = pc.createDataChannel('fileTransfer');
    setupDataChannel(peerId, channel);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', { target: peerId, candidate: event.candidate });
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socketRef.current.emit('offer', { target: peerId, offer });
  };

  const handleOffer = async (peerId, offer) => {
    const pc = createPeerConnection();
    connectionsRef.current.set(peerId, pc);

    pc.ondatachannel = (event) => {
      setupDataChannel(peerId, event.channel);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', { target: peerId, candidate: event.candidate });
      }
    };

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socketRef.current.emit('answer', { target: peerId, answer });
  };

  const askForNextChunk = () => {
    if (!filesMetaRef.current || !schedulerRef.current) return;

    const missingChunks = [];
    for (let fi = 0; fi < filesMetaRef.current.length; fi++) {
      if (completedFilesRef.current.has(fi)) continue;
      const received = receivedChunksRef.current.get(fi) || new Set();
      for (let ci = 0; ci < filesMetaRef.current[fi].totalChunks; ci++) {
        if (!received.has(ci)) {
          missingChunks.push({ fileIndex: fi, chunkIndex: ci });
        }
      }
    }

    if (missingChunks.length === 0) return;

    for (const [peerId, channel] of channelsRef.current.entries()) {
      if (channel.readyState !== 'open') continue;

      for (const chunk of missingChunks) {
        const key = `${chunk.fileIndex}_${chunk.chunkIndex}`;
        if (!requestedChunksRef.current.has(key)) {
          requestedChunksRef.current.add(key);
          channel.send(JSON.stringify({
            type: 'REQUEST',
            fileIndex: chunk.fileIndex,
            chunkIndex: chunk.chunkIndex
          }));
          break; // One request per peer per round
        }
      }
    }
  };

  const handleControlMessage = async (peerId, message) => {
    switch (message.type) {
      case 'META_LIST':
        if (!filesMetaRef.current) {
          filesMetaRef.current = message.files;
          transferIdRef.current = message.transferId;
          setFilesMeta(message.files);

          // Initialize tracking
          let total = 0;
          const initialProgress = [];
          for (let i = 0; i < message.files.length; i++) {
            receivedChunksRef.current.set(i, new Set());
            total += message.files[i].totalChunks;
            initialProgress.push(0);
          }
          totalChunksRef.current = total;
          setFileProgress(initialProgress);
          setDownloadUrls(new Array(message.files.length).fill(null));

          swarmManagerRef.current = new SwarmManager(total);
          schedulerRef.current = new Scheduler(swarmManagerRef.current);

          setStatus('transferring');
          startTimeRef.current = Date.now();
          lastUpdateTimeRef.current = Date.now();

          // Send BITFIELD
          channelsRef.current.get(peerId)?.send(JSON.stringify({ type: 'BITFIELD', chunks: [] }));

          askForNextChunk();
        }
        break;

      case 'BITFIELD':
        askForNextChunk();
        break;

      case 'HAVE':
        askForNextChunk();
        break;

      case 'REQUEST':
        if (transferIdRef.current) {
          const received = receivedChunksRef.current.get(message.fileIndex);
          if (received && received.has(message.chunkIndex)) {
            const buffer = await StorageManager.getChunk(transferIdRef.current, message.fileIndex, message.chunkIndex);
            if (buffer) {
              const channel = channelsRef.current.get(peerId);
              if (channel && channel.readyState === 'open') {
                channel.send(encodeChunk(message.fileIndex, message.chunkIndex, buffer));
              }
            }
          }
        }
        break;
    }
  };

  const handleChunkData = async (peerId, arrayBuffer) => {
    const { fileIndex, chunkIndex, data } = decodeChunk(arrayBuffer);

    const key = `${fileIndex}_${chunkIndex}`;
    requestedChunksRef.current.delete(key);

    const received = receivedChunksRef.current.get(fileIndex);
    if (!received || received.has(chunkIndex)) return;

    if (transferIdRef.current) {
      await StorageManager.saveChunk(transferIdRef.current, fileIndex, chunkIndex, data);
      received.add(chunkIndex);
      bytesReceivedRef.current += data.byteLength;
      totalReceivedRef.current++;

      // Update per-file progress
      const meta = filesMetaRef.current[fileIndex];
      if (meta) {
        const filePct = Math.round((received.size / meta.totalChunks) * 100);
        setFileProgress(prev => {
          const next = [...prev];
          next[fileIndex] = filePct;
          return next;
        });
      }

      // Update overall progress
      setOverallProgress(Math.round((totalReceivedRef.current / totalChunksRef.current) * 100));

      // ACK back to sender
      const senderChannel = channelsRef.current.get(peerId);
      if (senderChannel && senderChannel.readyState === 'open') {
        senderChannel.send(JSON.stringify({ type: 'ACK', fileIndex, chunkIndex }));
      }

      // Broadcast HAVE
      for (const [otherPeer, channel] of channelsRef.current.entries()) {
        if (otherPeer !== peerId && channel.readyState === 'open') {
          channel.send(JSON.stringify({ type: 'HAVE', fileIndex, chunkIndex }));
        }
      }

      // Check if this file is complete
      if (meta && received.size === meta.totalChunks && !completedFilesRef.current.has(fileIndex)) {
        completedFilesRef.current.add(fileIndex);
        await assembleFile(fileIndex);
      }

      askForNextChunk();
    }
  };

  const assembleFile = async (fileIndex) => {
    const meta = filesMetaRef.current[fileIndex];
    const chunks = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      const buf = await StorageManager.getChunk(transferIdRef.current, fileIndex, i);
      chunks.push(buf);
    }

    const blob = new Blob(chunks, { type: meta.mimeType });

    // Verify integrity
    const localHash = await CryptoUtils.hashBlob(blob);
    if (localHash === meta.hash) {
      const url = URL.createObjectURL(blob);
      setDownloadUrls(prev => {
        const next = [...prev];
        next[fileIndex] = url;
        return next;
      });

      // Check if all files done
      if (completedFilesRef.current.size === filesMetaRef.current.length) {
        setStatus('complete');
      }
    } else {
      console.error(`File ${fileIndex} (${meta.name}) integrity check failed!`);
    }
  };

  const handleDownload = (fileIndex) => {
    const url = downloadUrls[fileIndex];
    const meta = filesMeta[fileIndex];
    if (!url || !meta) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleDownloadAll = () => {
    downloadUrls.forEach((url, i) => {
      if (url) handleDownload(i);
    });
  };

  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      <Head>
        <title>Receive Files — ZapTransfer</title>
        <meta name="description" content="Receive files securely via P2P QR code sharing" />
      </Head>

      {/* Header */}
      <div className="w-full max-w-5xl flex justify-between items-center py-6 mb-8 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <Zap className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            ZapTransfer
          </h1>
        </div>
        {activePeers > 0 && (
          <div className="flex items-center space-x-2 text-sm">
            <Users className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-medium">{activePeers} connected</span>
          </div>
        )}
      </div>

      <main className="w-full max-w-2xl">
        {/* Waiting — Manual Room Entry */}
        {status === 'waiting' && (
          <div className="glass-card rounded-3xl p-8 text-center space-y-6 animate-fade-in">
            <UserPlus className="w-16 h-16 text-blue-400 mx-auto" />
            <h2 className="text-3xl font-bold text-slate-100">Join Room</h2>
            <p className="text-slate-400">Enter the room code or scan a QR code to receive files</p>

            <input
              type="text"
              maxLength={6}
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3"
              className="w-full max-w-xs mx-auto text-center text-4xl p-4 bg-slate-900 border-2 border-slate-700 rounded-xl uppercase tracking-widest font-mono font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 transition-colors block"
            />

            <button
              onClick={() => joinRoom()}
              disabled={roomId.length < 4}
              className="mt-4 px-12 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-600/20"
            >
              Connect
            </button>

            <button
              onClick={() => setShowScanner(!showScanner)}
              className="mt-4 ml-4 px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-lg transition-all"
            >
              <Camera className="w-5 h-5 inline mr-2" />
              Scan QR
            </button>

            {showScanner && (
              <div className="mt-8 w-full max-w-xs mx-auto overflow-hidden rounded-2xl border-4 border-emerald-500/30 bg-black">
                <Scanner 
                  onScan={(result) => {
                    const text = result?.[0]?.rawValue;
                    if (text) {
                      try {
                        const url = new URL(text);
                        const roomParam = url.searchParams.get('room');
                        if (roomParam) {
                          setRoomId(roomParam.toUpperCase());
                          setShowScanner(false);
                          joinRoom(roomParam.toUpperCase());
                        }
                      } catch (e) {
                        if (text.length === 6) {
                          setRoomId(text.toUpperCase());
                          setShowScanner(false);
                          joinRoom(text.toUpperCase());
                        }
                      }
                    }
                  }}
                  onError={(error) => console.error(error)}
                />
                <button 
                  onClick={() => setShowScanner(false)} 
                  className="w-full py-3 bg-slate-900 border-t border-slate-800 text-red-400 font-bold hover:bg-slate-800"
                >
                  Cancel Scanner
                </button>
              </div>
            )}
          </div>
        )}

        {/* Auth Error */}
        {status === 'auth_error' && (
          <div className="glass-card rounded-3xl p-8 text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <span className="text-3xl">🔒</span>
            </div>
            <h2 className="text-2xl font-bold text-red-400">Authentication Required</h2>
            <p className="text-slate-400">You need to be logged in to receive files.</p>
            <a
              href="/login"
              className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-colors"
            >
              Go to Login
            </a>
          </div>
        )}

        {/* Connecting */}
        {(status === 'joining' || status === 'connecting_peers') && (
          <div className="glass-card rounded-3xl p-8 text-center animate-fade-in">
            <div className="py-12 space-y-6">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <h3 className="text-2xl font-bold text-slate-200">Connecting to sender...</h3>
              <p className="text-slate-400 text-sm">Establishing secure P2P connection via WebRTC</p>
            </div>
          </div>
        )}

        {/* Transferring / Complete */}
        {(status === 'transferring' || status === 'complete') && filesMeta.length > 0 && (
          <div className="space-y-6 animate-fade-in">
            {/* Status Banner */}
            {status === 'complete' && (
              <div className="glass-card rounded-3xl p-6 text-center space-y-4 animate-fade-in border-emerald-500/30">
                <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto" />
                <h2 className="text-2xl font-extrabold text-white">All Files Received!</h2>
                <p className="text-emerald-400 text-sm font-mono bg-emerald-500/10 px-3 py-1.5 rounded-lg inline-block border border-emerald-500/30">
                  SHA-256 Verified ✓
                </p>
                <button
                  onClick={handleDownloadAll}
                  className="flex items-center space-x-3 mx-auto px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition-all shadow-lg group"
                >
                  <PackageOpen className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
                  <span>Download All ({filesMeta.length} files)</span>
                </button>
              </div>
            )}

            {/* Progress */}
            {status === 'transferring' && (
              <div className="glass-card rounded-3xl p-6">
                <ProgressBar progress={overallProgress} speed={speed} eta={eta} statusText="Receiving files..." />
              </div>
            )}

            {/* File List */}
            <div className="glass-card rounded-3xl p-6">
              <h3 className="text-lg font-semibold text-slate-200 mb-4">
                {filesMeta.length} File{filesMeta.length > 1 ? 's' : ''}
              </h3>
              <div className="space-y-3">
                {filesMeta.map((file, i) => (
                  <FileCard
                    key={i}
                    file={file}
                    index={i}
                    progress={fileProgress[i] || 0}
                    downloadUrl={downloadUrls[i]}
                    onDownload={handleDownload}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
