import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useDropzone } from 'react-dropzone';
import QRCode from 'react-qr-code';
import imageCompression from 'browser-image-compression';

import EventCard from '@/components/EventCard';
import ProgressBar from '@/components/ProgressBar';
import {
  Zap, LogOut, Plus, UploadCloud, X, Copy, Check,
  Camera, Calendar, FileText, ArrowLeft, Image
} from 'lucide-react';

import { getToken, setToken, isLoggedIn, getUserInfo, logout, authFetch } from '@/utils/auth';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [view, setView] = useState('events'); // events | create | upload | qr

  // Create event form
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventDesc, setEventDesc] = useState('');

  // Upload state
  const [activeEvent, setActiveEvent] = useState(null);
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // QR state
  const [qrEventId, setQrEventId] = useState('');
  const [copied, setCopied] = useState(false);

  // Auth
  useEffect(() => {
    // Handle OAuth callback token from login redirect
    const params = new URLSearchParams(window.location.search);
    const callbackToken = params.get('token');
    if (callbackToken) {
      setToken(callbackToken);
      window.history.replaceState({}, '', '/dashboard');
    }

    if (!isLoggedIn()) {
      router.replace('/login');
      return;
    }
    setUser(getUserInfo());
    fetchEvents();
    setLoading(false);
  }, [router]);

  const fetchEvents = async () => {
    try {
      const res = await authFetch('/api/events');
      const data = await res.json();
      if (data.events) setEvents(data.events);
    } catch (e) {
      console.error('Failed to fetch events:', e);
    }
  };

  // Create event
  const handleCreateEvent = async () => {
    if (!eventName || !eventDate) return;
    try {
      const res = await authFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify({ name: eventName, date: eventDate, description: eventDesc })
      });
      const data = await res.json();
      if (data.success) {
        setEventName('');
        setEventDate('');
        setEventDesc('');
        setView('events');
        fetchEvents();
      }
    } catch (e) {
      console.error('Failed to create event:', e);
    }
  };

  // Delete event
  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Delete this event and all its photos?')) return;
    try {
      await authFetch(`/api/events/${eventId}`, { method: 'DELETE' });
      fetchEvents();
    } catch (e) {
      console.error('Failed to delete event:', e);
    }
  };

  // Upload photos
  const onDrop = useCallback((acceptedFiles) => {
    setUploadFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'] },
    multiple: true
  });

  const handleUpload = async () => {
    if (!activeEvent || uploadFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    let totalUploaded = 0;
    let errors = [];
    const uploadedFilesData = [];

    try {
      const token = getToken();
      const base = process.env.NEXT_PUBLIC_SIGNALING_SERVER || '';
      
      // 1. Fetch Cloudinary Signature from Backend
      const sigRes = await fetch(`${base}/api/events/${activeEvent.eventId}/photos/signature`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!sigRes.ok) throw new Error('Failed to obtain upload signature');
      const { signature, timestamp, folder, cloudName, apiKey } = await sigRes.json();

      // 2. Compress & Upload each file directly from Edge to Cloudinary
      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        try {
          // Native Worker Compression
          const options = { maxSizeMB: 2, maxWidthOrHeight: 2500, useWebWorker: true };
          const compressedFile = await imageCompression(file, options);

          // Direct Signed Cloudinary Push
          const formData = new FormData();
          formData.append('file', compressedFile);
          formData.append('api_key', apiKey);
          formData.append('timestamp', timestamp);
          formData.append('signature', signature);
          formData.append('folder', folder);

          const cRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData
          });
          
          if (!cRes.ok) throw new Error('Cloudinary secure upload rejected');
          const cData = await cRes.json();

          uploadedFilesData.push({
            secure_url: cData.secure_url,
            public_id: cData.public_id,
            original_filename: file.name
          });

          totalUploaded++;
          setUploadProgress(Math.round(((i + 1) / uploadFiles.length) * 100));
        } catch (e) {
          errors.push({ file: file.name, error: e.message });
        }
      }

      // 3. Dispatch validated Edge URLs to Backend to initiate Async Neural Face Extraction
      if (uploadedFilesData.length > 0) {
        setUploadProgress(100); 
        await fetch(`${base}/api/events/${activeEvent.eventId}/photos/process`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uploadedFiles: uploadedFilesData })
        });
      }

    } catch (e) {
      errors.push({ file: 'System', error: e.message });
    }

    setUploadResult({ uploaded: totalUploaded, faces: 'Processing Internally...', errors });
    setUploading(false);
    setUploadFiles([]);
    fetchEvents();
  };

  const openUpload = (eventId) => {
    const ev = events.find(e => e.eventId === eventId);
    setActiveEvent(ev);
    setUploadFiles([]);
    setUploadResult(null);
    setView('upload');
  };

  const openQR = (eventId) => {
    setQrEventId(eventId);
    setView('qr');
  };

  const galleryUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/gallery/${qrEventId}`;

  const copyLink = () => {
    navigator.clipboard.writeText(galleryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalPhotos = events.reduce((sum, ev) => sum + (ev.photoCount || 0), 0);
  const totalEvents = events.length;

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-gradient-to-br from-slate-950 via-[#1E1B4B] to-slate-950 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[20%] left-[-10%] w-[30%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none"></div>

      <Head>
        <title>Studio Dashboard — ZapTransfer AI</title>
        <meta name="description" content="Professional photographer studio dashboard" />
      </Head>

      {/* Header */}
      <div className="w-full max-w-6xl flex justify-between items-center py-4 px-6 mb-10 bg-slate-900/40 backdrop-blur-2xl border border-slate-700/50 rounded-2xl shadow-xl z-10">
        <div className="flex items-center space-x-3">
          <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
            ZapTransfer <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">Studio</span>
          </h1>
          <span className="hidden md:inline-flex text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 font-black uppercase tracking-widest ml-2">
            Pro Plan
          </span>
        </div>
        
        <div className="flex items-center space-x-3">
          {user && (
            <div className="flex items-center space-x-3 bg-slate-800/50 pl-2 pr-4 py-1.5 rounded-xl border border-slate-700/50">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-7 h-7 rounded-full ring-2 ring-indigo-500/50" />
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
      </div>

      {/* Main Content */}
      <main className="w-full max-w-6xl z-10">

        {/* ===== EVENTS LIST ===== */}
        {view === 'events' && (
          <div className="space-y-8 animate-fade-in-up">
            
            {/* STAT ROLLUPS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 flex flex-col relative overflow-hidden group hover:border-indigo-500/30 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <span className="text-slate-400 text-sm font-bold tracking-wide uppercase mb-2">Total Events</span>
                <span className="text-4xl font-black text-white">{totalEvents}</span>
              </div>
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 flex flex-col relative overflow-hidden group hover:border-emerald-500/30 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <span className="text-slate-400 text-sm font-bold tracking-wide uppercase mb-2">Total Photos</span>
                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-200">{totalPhotos}</span>
              </div>
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 flex flex-col relative overflow-hidden group hover:border-purple-500/30 transition-colors">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
                <span className="text-slate-400 text-sm font-bold tracking-wide uppercase mb-2">Engaged Guests</span>
                <span className="text-4xl font-black text-slate-500">--</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <div>
                <h2 className="text-2xl font-bold text-white">Project Galleries</h2>
                <p className="text-sm text-slate-400 mt-1">Manage event albums and P2P distribution</p>
              </div>
              <button
                onClick={() => setView('create')}
                className="flex items-center space-x-2 px-6 py-3 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold transition-all shadow-lg hover:shadow-indigo-500/20"
              >
                <Plus className="w-5 h-5 text-indigo-600" />
                <span className="hidden sm:inline">New Event Gallery</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>

            {events.length === 0 ? (
              <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-700/50 rounded-[2rem] p-16 text-center border-dashed">
                <div className="w-20 h-20 bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-6 transform rotate-3">
                  <Camera className="w-10 h-10 text-indigo-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-200 mb-3">No galleries yet</h3>
                <p className="text-slate-400 max-w-sm mx-auto mb-8">Create your first event gallery, upload high-res photos, and share instantly with your clients.</p>
                <button
                  onClick={() => setView('create')}
                  className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20"
                >
                  Create First Gallery
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((ev, i) => (
                  <EventCard
                    key={ev.eventId}
                    event={ev}
                    index={i}
                    onOpen={openUpload}
                    onViewQR={openQR}
                    onDelete={handleDeleteEvent}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== CREATE EVENT ===== */}
        {view === 'create' && (
          <div className="glass-card rounded-3xl p-8 animate-fade-in">
            <button
              onClick={() => setView('events')}
              className="flex items-center space-x-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Events</span>
            </button>

            <h2 className="text-2xl font-bold text-white mb-6">Create New Event</h2>

            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Event Name *</label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="e.g. Sharma & Patel Wedding"
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Event Date *</label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                <textarea
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                />
              </div>

              <button
                onClick={handleCreateEvent}
                disabled={!eventName || !eventDate}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all shadow-lg shadow-emerald-600/20"
              >
                Create Event
              </button>
            </div>
          </div>
        )}

        {/* ===== UPLOAD PHOTOS ===== */}
        {view === 'upload' && activeEvent && (
          <div className="space-y-6 animate-fade-in">
            <button
              onClick={() => setView('events')}
              className="flex items-center space-x-2 text-slate-400 hover:text-white text-sm transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Events</span>
            </button>

            <div className="glass-card rounded-3xl p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">{activeEvent.name}</h2>
                  <p className="text-sm text-slate-400 mt-1">{activeEvent.photoCount} photos uploaded</p>
                </div>
                <div className="flex items-center space-x-1 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
                  <Image className="w-4 h-4 text-blue-400" />
                  <span className="font-bold text-blue-400">{activeEvent.photoCount}</span>
                </div>
              </div>

              {/* Drop zone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-300 ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
                    : 'border-slate-600 hover:border-blue-400 hover:bg-slate-700/30'
                }`}
              >
                <input {...getInputProps()} />
                <UploadCloud className="mx-auto w-16 h-16 text-slate-400 mb-4" />
                <h3 className="text-xl font-bold text-slate-200 mb-2">
                  {isDragActive ? 'Drop photos here!' : 'Drag & drop photos'}
                </h3>
                <p className="text-slate-400 text-sm">JPG, PNG, WebP, HEIC — up to 50MB each</p>
              </div>

              {/* Selected files */}
              {uploadFiles.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-300">
                      {uploadFiles.length} photo{uploadFiles.length > 1 ? 's' : ''} selected
                    </span>
                    <button
                      onClick={() => setUploadFiles([])}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>

                  {/* Thumbnail preview grid */}
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-48 overflow-y-auto">
                    {uploadFiles.slice(0, 32).map((file, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden bg-slate-800">
                        <img
                          src={URL.createObjectURL(file)}
                          alt=""
                          className="w-full h-full object-cover"
                          onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                        />
                      </div>
                    ))}
                    {uploadFiles.length > 32 && (
                      <div className="aspect-square rounded-lg bg-slate-800 flex items-center justify-center">
                        <span className="text-xs text-slate-400 font-medium">+{uploadFiles.length - 32}</span>
                      </div>
                    )}
                  </div>

                  {/* Upload button */}
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full mt-4 py-3.5 bg-gradient-to-r from-blue-600 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition-all shadow-lg shadow-blue-600/20"
                  >
                    {uploading ? 'Uploading...' : `Upload ${uploadFiles.length} Photos`}
                  </button>
                </div>
              )}

              {/* Upload progress */}
              {uploading && (
                <div className="mt-4">
                  <ProgressBar progress={uploadProgress} statusText="Uploading to cloud..." />
                </div>
              )}

              {/* Upload result */}
              {uploadResult && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 animate-fade-in">
                  <p className="text-emerald-400 font-medium">
                    ✅ {uploadResult.uploaded} photos uploaded · {uploadResult.faces} faces detected
                  </p>
                  {uploadResult.errors.length > 0 && (
                    <p className="text-amber-400 text-sm mt-1">
                      ⚠️ {uploadResult.errors.length} failed
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== QR CODE ===== */}
        {view === 'qr' && qrEventId && (
          <div className="glass-card rounded-3xl p-8 animate-fade-in">
            <button
              onClick={() => setView('events')}
              className="flex items-center space-x-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Events</span>
            </button>

            <div className="flex flex-col items-center space-y-6">
              <h2 className="text-2xl font-bold text-white">Share Gallery</h2>
              <p className="text-slate-400 text-center text-sm max-w-sm">
                Print this QR code or share the link. Guests can view and find their photos instantly.
              </p>

              {/* QR Code */}
              <div className="bg-white p-5 rounded-2xl shadow-qr-glow inline-block animate-pulse-glow">
                <QRCode value={galleryUrl} size={280} level="H" />
              </div>

              <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">
                Scan to open gallery
              </p>

              {/* Copy Link */}
              <button
                onClick={copyLink}
                className="flex items-center space-x-2 px-5 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-sm transition-all"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">Copy Gallery Link</span>
                  </>
                )}
              </button>

              {/* Gallery link preview */}
              <div className="w-full p-3 bg-slate-900/60 rounded-lg border border-slate-700/50">
                <p className="text-xs text-slate-500 font-mono truncate">{galleryUrl}</p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
