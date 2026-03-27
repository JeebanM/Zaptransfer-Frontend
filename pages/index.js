import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useDropzone } from 'react-dropzone';
import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'framer-motion';

import QRCodeDisplay from '@/components/QRCodeDisplay';
import FileCard from '@/components/FileCard';
import ProgressBar from '@/components/ProgressBar';
import { UploadCloud, Activity, LogOut, Zap, Users, LayoutDashboard, Sparkles, Camera } from 'lucide-react';

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
      <div className="min-h-screen flex items-center justify-center bg-[#030712]">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]"></div>
          <span className="text-cyan-400 font-bold tracking-widest uppercase text-sm animate-pulse">Initializing Protocol...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex flex-col items-center bg-[#030712] relative overflow-hidden">
      {/* Background Glows (Neon Dark) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-fuchsia-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <Head>
        <title>ZapTransfer AI — Premium Photos</title>
        <meta name="description" content="Premium AI-powered photo sharing and P2P transfers." />
        <meta name="google-site-verification" content="4Klq89JtcGdB5adRxgxwLPOiW_RpU_SnXrrbyHHoRAY" />
      </Head>

      {/* Header - Glassmorphism */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 20 }}
        className="w-full max-w-7xl flex items-center justify-between p-4 bg-zinc-950/60 backdrop-blur-2xl border border-zinc-800/80 rounded-[2rem] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] z-10 mb-8 lg:mb-16"
      >
        <div className="flex items-center space-x-3 ml-2">
          <div className="bg-gradient-to-br from-cyan-400 to-blue-600 p-2 rounded-xl shadow-[0_0_20px_rgba(34,211,238,0.4)]">
            <Zap className="w-5 h-5 text-zinc-950 fill-zinc-950" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            ZapTransfer <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-400 font-bold">AI</span>
          </h1>
        </div>
        
        <div className="flex items-center space-x-4 mr-2">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-sm font-bold transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>
          {activePeers > 0 && (
            <div className="flex items-center space-x-2 text-sm bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-emerald-400 font-bold">{activePeers} connected</span>
            </div>
          )}
          {user && (
            <div className="flex items-center space-x-3 bg-slate-800/50 pl-2 pr-4 py-1.5 rounded-xl border border-slate-700/50">
              {user.avatar ? (
                <img src={user.avatar} alt="Profile" className="w-7 h-7 rounded-full ring-2 ring-indigo-500/50" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-indigo-400">{user.name.charAt(0)}</span>
                </div>
              )}
              <span className="text-sm font-medium text-slate-300 hidden sm:inline">{user.name.split(' ')[0]}</span>
              <button onClick={logout} className="ml-2 text-slate-500 hover:text-red-400 transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Main Content - 2 Column Split */}
      <main className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center z-10 pb-12">
        
        {/* Left Side: Hero Marketing */}
        <div className="space-y-8 animate-fade-in-up">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 border border-indigo-500/20 text-indigo-300 px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>The Premium Photography Suite</span>
          </div>
          
          <h2 className="text-5xl lg:text-7xl font-extrabold text-white leading-[1.1] tracking-tight">
            Scan. Share. <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">
              Find your moments instantly.
            </span>
          </h2>
          
          <p className="text-xl text-slate-400 max-w-lg leading-relaxed font-medium">
            AI-powered facial recognition galleries for professionals, and blazing fast end-to-end encrypted P2P sharing for everyone else.
          </p>
          
          <div className="flex flex-wrap gap-4 pt-4">
            <button
               onClick={() => router.push('/dashboard')}
               className="group px-8 py-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-bold text-lg transition-all shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] flex items-center space-x-3"
            >
               <Camera className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
               <span>Create Gallery</span>
            </button>
            <button
               onClick={() => router.push('/receive')}
               className="px-8 py-4 bg-slate-800/80 hover:bg-slate-700/80 backdrop-blur-md border border-slate-700/50 text-white rounded-2xl font-bold text-lg transition-all hover:border-indigo-500/30"
            >
               Receive Files
            </button>
          </div>
        </div>

        {/* Right Side: Floating Glass Card (Quick P2P Transfer) */}
        <div className="relative group lg:mt-0 mt-8">
           {/* Subtle Neon Glow behind card */}
           <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-fuchsia-500 rounded-[2.5rem] blur-xl opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-500"></div>
           
           <div className="relative bg-[#09090b]/80 backdrop-blur-2xl border border-zinc-800/80 rounded-[2rem] p-8 shadow-[0_20px_50px_-20px_rgba(34,211,238,0.3)] min-h-[400px] flex flex-col justify-center">
              <div className="absolute top-6 left-8 right-8 flex items-center justify-between mb-8">
                 <h3 className="text-lg font-bold text-white flex items-center">
                    <Zap className="w-5 h-5 text-cyan-400 mr-2 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                    Secure P2P Drop
                 </h3>
                 <span className="text-[10px] font-black uppercase tracking-widest bg-zinc-900 text-zinc-400 px-3 py-1.5 rounded-full border border-zinc-800 shadow-inner">Encrypted</span>
              </div>
              
              <div className="mt-12 relative min-h-[250px]">
                <AnimatePresence mode="wait">
        {/* Upload Zone */}
        {status === 'waiting_for_files' && (
          <motion.div 
            key="waiting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="w-full"
          >
            <div {...getRootProps()} className={`border-2 border-dashed rounded-[2rem] p-16 text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-cyan-500 bg-cyan-500/10 scale-[1.02] shadow-[0_0_20px_rgba(34,211,238,0.2)]' : 'border-zinc-700 hover:border-cyan-400 hover:bg-zinc-900/50'}`}>
              <input {...getInputProps()} />
              <UploadCloud className="mx-auto w-20 h-20 text-zinc-500 mb-6 drop-shadow-md" />
              <h2 className="text-3xl font-bold text-white mb-3">Drop files to send</h2>
              <p className="text-zinc-400 text-lg">Photos, videos, or raw files</p>
              <p className="text-zinc-[600] text-sm mt-4 tracking-widest uppercase">Click to browse</p>
            </div>
          </motion.div>
        )}

        {/* Hashing */}
        {status === 'hashing' && (
          <motion.div 
            key="hashing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="bg-zinc-900/80 border border-zinc-800 rounded-[2rem] p-8 text-center"
          >
            <div className="py-12 space-y-6 flex flex-col items-center">
              <div className="w-16 h-16 border-4 border-fuchsia-500 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(217,70,239,0.3)]"></div>
              <h3 className="text-2xl font-bold text-fuchsia-400">Hashing Files...</h3>
              <p className="text-zinc-500 text-sm max-w-sm tracking-wide">Generating cryptographic signatures for {files.length} file{files.length > 1 ? 's' : ''}</p>
            </div>
          </motion.div>
        )}

        {/* Ready to Share / Transferring */}
        {(status === 'ready_to_share' || status === 'transferring') && (
          <motion.div 
            key="sharing"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 20, stiffness: 100 }}
            className="space-y-6"
          >
            {/* QR Code Section */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-[2rem] p-8 flex flex-col items-center shadow-lg">
              <QRCodeDisplay url={receiveUrl} />
            </div>

            {/* File List */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-[2rem] p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-white">
                  {files.length} File{files.length > 1 ? 's' : ''} Ready
                </h3>
                <span className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase bg-cyan-500/10 px-3 py-1.5 rounded-full border border-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.2)]">
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
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-zinc-900/80 border border-zinc-800 rounded-[2rem] p-6 shadow-lg"
              >
                <ProgressBar progress={Math.round(progress)} statusText={`Serving ${activePeers} peer${activePeers !== 1 ? 's' : ''}...`} />
              </motion.div>
            )}
          </motion.div>
        )}
                </AnimatePresence>
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}
// Trigger Vercel Webhook Deploy
