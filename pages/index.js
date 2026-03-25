import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useDropzone } from 'react-dropzone';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

import QRCodeDisplay from '@/components/QRCodeDisplay';
import FileCard from '@/components/FileCard';
import ProgressBar from '@/components/ProgressBar';
import { UploadCloud, Activity, LogOut, Zap, Users, LayoutDashboard } from 'lucide-react';

import { createPeerConnection, waitForDrain } from '@/utils/webrtc';
import { CryptoUtils, MathUtils, CHUNK_SIZE, encodeChunk } from '@/utils/chunkProtocol';
import { getToken, setToken, isLoggedIn, getUserInfo, logout, authFetch } from '@/utils/auth';

const MAX_WINDOW = 256;
const BACKPRESSURE_BYTES = 16 * 1024 * 1024;

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState('waiting_for_files');
  const [progress, setProgress] = useState(0);
  const [activePeers, setActivePeers] = useState(0);
  const [loading, setLoading] = useState(true);

  const socketRef = useRef(null);
  const connectionsRef = useRef(new Map());
  const channelsRef = useRef(new Map());
  const metaListRef = useRef(null);
  const filesRef = useRef([]);
  const peerQueuesRef = useRef(new Map());
  const totalChunksSentRef = useRef(0);
  const totalChunksRef = useRef(0);

  // Auth check
  useEffect(() => {
    // Handle OAuth callback token
    const params = new URLSearchParams(window.location.search);
    const callbackToken = params.get('token');
    if (callbackToken) {
      setToken(callbackToken);
      window.history.replaceState({}, '', '/');
    }

    if (isLoggedIn()) {
      setUser(getUserInfo());
      setLoading(false);
      return;
    }

    // Check if server has OAuth configured — if not, skip login (dev mode)
    const checkAuth = async () => {
      try {
        const base = process.env.NEXT_PUBLIC_SIGNALING_SERVER || '';
        const res = await fetch(`${base}/auth/verify`);
        const data = await res.json();
        // If we got here and not logged in, check if server is in dev mode
        if (res.status === 401) {
          // Try creating a room without auth — if it works, we're in dev mode
          const roomRes = await fetch(`${base}/api/rooms/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileCount: 0 })
          });
          if (roomRes.ok) {
            // Dev mode — no auth required
            setUser({ name: 'Dev User', email: '' });
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        // Server might not be running
      }
      router.replace('/login');
    };
    checkAuth();
  }, [router]);

  // Peer count polling
  useEffect(() => {
    const interval = setInterval(() => {
      let readyChannels = 0;
      for (const channel of channelsRef.current.values()) {
        if (channel.readyState === 'open') readyChannels++;
      }
      setActivePeers(readyChannels);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      connectionsRef.current.forEach(pc => pc.close());
    };
  }, []);

  const connectToSignaling = (room) => {
    const token = getToken();
    socketRef.current = io(process.env.NEXT_PUBLIC_SIGNALING_SERVER || window.location.origin, {
      auth: { token }
    });

    socketRef.current.emit('join-room', room);

    socketRef.current.on('room-peers', async (peerIds) => {
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
      peerQueuesRef.current.delete(peerId);
    });
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

  const setupDataChannel = (peerId, channel) => {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = 4 * 1024 * 1024;
    channelsRef.current.set(peerId, channel);

    peerQueuesRef.current.set(peerId, {
      requests: [],
      inFlight: 0
    });

    channel.onopen = () => {
      if (metaListRef.current) {
        channel.send(JSON.stringify(metaListRef.current));
      }
    };

    channel.onmessage = async (e) => {
      if (typeof e.data === 'string') {
        const message = JSON.parse(e.data);

        if (message.type === 'BITFIELD') {
          setStatus('transferring');
        } else if (message.type === 'REQUEST') {
          setStatus('transferring');
          const q = peerQueuesRef.current.get(peerId);
          if (q) {
            q.requests.push({ fileIndex: message.fileIndex, chunkIndex: message.chunkIndex });
            processQueue(peerId, channel);
          }
        } else if (message.type === 'ACK') {
          const q = peerQueuesRef.current.get(peerId);
          if (q) {
            q.inFlight = Math.max(0, q.inFlight - 1);
            processQueue(peerId, channel);
            totalChunksSentRef.current++;
            if (totalChunksRef.current > 0) {
              setProgress(Math.min(100, (totalChunksSentRef.current / totalChunksRef.current) * 100));
            }
          }
        }
      }
    };
  };

  const processQueue = async (peerId, channel) => {
    const q = peerQueuesRef.current.get(peerId);
    if (!q || filesRef.current.length === 0) return;

    while (q.requests.length > 0 && q.inFlight < MAX_WINDOW) {
      if (channel.bufferedAmount > BACKPRESSURE_BYTES) {
        await waitForDrain(channel, channel.bufferedAmountLowThreshold);
      }
      if (channel.readyState !== 'open') break;

      const { fileIndex, chunkIndex } = q.requests.shift();
      q.inFlight++;

      const file = filesRef.current[fileIndex];
      if (!file) { q.inFlight--; continue; }

      const offset = chunkIndex * CHUNK_SIZE;
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();
      const encoded = encodeChunk(fileIndex, chunkIndex, buffer);

      if (channel.readyState === 'open') {
        channel.send(encoded);
      } else {
        q.inFlight--;
      }
    }
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    setFiles(acceptedFiles);
    filesRef.current = acceptedFiles;
    setStatus('hashing');

    // Build metadata for all files
    const transferId = uuidv4();
    const filesMeta = [];
    let totalChunks = 0;

    for (let i = 0; i < acceptedFiles.length; i++) {
      const f = acceptedFiles[i];
      const chunks = MathUtils.calculateChunks(f.size);
      totalChunks += chunks;
      const hash = await CryptoUtils.hashBlob(f);

      filesMeta.push({
        name: f.name,
        size: f.size,
        mimeType: f.type,
        chunkSize: CHUNK_SIZE,
        totalChunks: chunks,
        hash
      });
    }

    totalChunksRef.current = totalChunks;

    metaListRef.current = {
      type: 'META_LIST',
      transferId,
      files: filesMeta
    };

    // Create room via API
    try {
      const res = await authFetch('/api/rooms/create', {
        method: 'POST',
        body: JSON.stringify({ fileCount: acceptedFiles.length })
      });
      const data = await res.json();

      if (data.success) {
        setRoomId(data.room.roomId);
        setStatus('ready_to_share');

        // Connect to signaling
        connectToSignaling(data.room.roomId);

        // Send meta to any already-open channels
        for (const channel of channelsRef.current.values()) {
          if (channel.readyState === 'open') {
            channel.send(JSON.stringify(metaListRef.current));
          }
        }
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      setStatus('waiting_for_files');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const receiveUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/receive?room=${roomId}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 flex flex-col items-center">
      <Head>
        <title>ZapTransfer — Secure QR File Sharing</title>
        <meta name="description" content="Upload files and share instantly via QR code. Secure P2P transfer." />
        <meta name="google-site-verification" content="4Klq89JtcGdB5adRxgxwLPOiW_RpU_SnXrrbyHHoRAY" />
      </Head>

      {/* Header */}
      <div className="w-full max-w-5xl flex justify-between items-center py-6 mb-8 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <Zap className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            ZapTransfer
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center space-x-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-sm font-medium transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Photo Dashboard</span>
          </button>
          {activePeers > 0 && (
            <div className="flex items-center space-x-2 text-sm">
              <Users className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-medium">{activePeers} connected</span>
            </div>
          )}
          {user && (
            <div className="flex items-center space-x-3">
              {user.avatar && (
                <img src={user.avatar} alt="" className="w-8 h-8 rounded-full ring-2 ring-slate-700" />
              )}
              <span className="text-sm text-slate-300 hidden sm:inline">{user.name}</span>
              <button onClick={logout} className="p-2 text-slate-400 hover:text-red-400 transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full max-w-3xl">
        {/* Upload Zone */}
        {status === 'waiting_for_files' && (
          <div className="glass-card rounded-3xl p-8 animate-fade-in">
            <div {...getRootProps()} className={`border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-blue-500 bg-blue-500/10 scale-[1.01]' : 'border-slate-600 hover:border-blue-400 hover:bg-slate-700/30'}`}>
              <input {...getInputProps()} />
              <UploadCloud className="mx-auto w-20 h-20 text-slate-400 mb-6" />
              <h2 className="text-3xl font-bold text-slate-200 mb-3">Drop your files here</h2>
              <p className="text-slate-400 text-lg">Photos, videos, documents — anything, any size</p>
              <p className="text-slate-500 text-sm mt-4">or click to browse</p>
            </div>
          </div>
        )}

        {/* Hashing */}
        {status === 'hashing' && (
          <div className="glass-card rounded-3xl p-8 text-center animate-fade-in">
            <div className="py-12 space-y-6">
              <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <h3 className="text-2xl font-bold text-amber-400">Preparing files...</h3>
              <p className="text-slate-400 text-sm max-w-sm mx-auto">Generating integrity hashes for {files.length} file{files.length > 1 ? 's' : ''}</p>
            </div>
          </div>
        )}

        {/* Ready to Share / Transferring */}
        {(status === 'ready_to_share' || status === 'transferring') && (
          <div className="space-y-6 animate-fade-in">
            {/* QR Code Section */}
            <div className="glass-card rounded-3xl p-8 flex flex-col items-center">
              <QRCodeDisplay url={receiveUrl} />
            </div>

            {/* File List */}
            <div className="glass-card rounded-3xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-200">
                  {files.length} File{files.length > 1 ? 's' : ''} Ready
                </h3>
                <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                  Seeding
                </span>
              </div>
              <div className="space-y-3">
                {files.map((file, i) => (
                  <FileCard key={i} file={file} index={i} />
                ))}
              </div>
            </div>

            {/* Transfer Progress */}
            {status === 'transferring' && (
              <div className="glass-card rounded-3xl p-6 animate-fade-in">
                <ProgressBar progress={Math.round(progress)} statusText={`Serving ${activePeers} peer${activePeers !== 1 ? 's' : ''}...`} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
// Trigger Vercel Webhook Deploy
