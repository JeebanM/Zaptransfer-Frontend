import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import PhotoGrid from '@/components/PhotoGrid';
import FaceScanner from '@/components/FaceScanner';
import {
  Zap, ScanFace, Image, Calendar, Download, X, Loader2, Camera, Check
} from 'lucide-react';

export default function GalleryPage() {
  const router = useRouter();
  const { eventId } = router.query;

  const [event, setEvent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Face scan state
  const [showScanner, setShowScanner] = useState(false);
  const [matchedIds, setMatchedIds] = useState(null);
  const [matching, setMatching] = useState(false);
  const [matchCount, setMatchCount] = useState(0);

  // Fetch event and photos
  useEffect(() => {
    if (!eventId) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const base = process.env.NEXT_PUBLIC_SIGNALING_SERVER || '';

        // Fetch event details
        const evRes = await fetch(`${base}/api/events/${eventId}`);
        if (!evRes.ok) {
          setError('Event not found');
          setLoading(false);
          return;
        }
        const evData = await evRes.json();
        setEvent(evData.event);

        // Fetch photos
        const phRes = await fetch(`${base}/api/events/${eventId}/photos`);
        const phData = await phRes.json();
        setPhotos(phData.photos || []);
      } catch (e) {
        setError('Failed to load gallery');
      }
      setLoading(false);
    };
    fetchData();
  }, [eventId]);

  // Handle face descriptor from scanner
  const handleFaceDescriptor = async (descriptor) => {
    setShowScanner(false);
    setMatching(true);

    try {
      const base = process.env.NEXT_PUBLIC_SIGNALING_SERVER || '';
      const res = await fetch(`${base}/api/events/${eventId}/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descriptor })
      });

      const data = await res.json();
      if (data.matches && data.matches.length > 0) {
        const ids = new Set(data.matches.map(m => m.photoId));
        setMatchedIds(ids);
        setMatchCount(ids.size);
      } else {
        setMatchedIds(new Set()); // Empty set = no matches found
        setMatchCount(0);
      }
    } catch (e) {
      console.error('Face match error:', e);
    }
    setMatching(false);
  };

  const clearFilter = () => {
    setMatchedIds(null);
    setMatchCount(0);
  };

  const handleDownloadMatched = () => {
    if (!matchedIds) return;
    photos.forEach(p => {
      if (matchedIds.has(p.photoId)) {
        const a = document.createElement('a');
        const dlUrl = p.imageUrl.replace('/upload/', '/upload/fl_attachment/');
        a.href = dlUrl;
        a.download = `zaptransfer_${p.photoId}.jpg`;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
        <p className="text-indigo-300 font-medium tracking-widest uppercase text-sm">Initializing Neural Gallery...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-950">
        <div className="text-6xl mb-4">😕</div>
        <h2 className="text-2xl font-bold text-slate-200 mb-2">{error}</h2>
        <p className="text-slate-400 text-sm">This gallery might have been removed or the link is invalid.</p>
      </div>
    );
  }

  const formattedDate = event?.date
    ? new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    : '';

  return (
    <div className="min-h-screen flex flex-col items-center bg-gradient-to-br from-slate-950 via-[#1E1B4B] to-slate-950 relative overflow-hidden pb-12">
      {/* Dynamic Background Glow */}
      <div className="absolute top-[10%] right-[-5%] w-[40%] h-[40%] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none"></div>

      <Head>
        <title>{event?.name || 'Gallery'} — ZapTransfer AI</title>
        <meta name="description" content={`View and download photos from ${event?.name || 'this event'}`} />
      </Head>

      {/* Hero Header */}
      <div className="w-full max-w-7xl py-8 px-4 sm:px-6 relative z-10 animate-fade-in-up">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 bg-slate-900/40 backdrop-blur-2xl border border-slate-700/50 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
          
          {/* subtle interior glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>

          <div className="relative z-10 flex-1">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-indigo-500/20 p-2.5 rounded-xl border border-indigo-500/30 shadow-inner">
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <span className="text-xs font-black tracking-[0.2em] uppercase text-indigo-300/80">ZapTransfer AI Gallery</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 tracking-tight leading-tight">{event?.name}</h1>
            
            <div className="flex flex-wrap items-center gap-4 text-slate-400 font-medium">
              <div className="flex items-center space-x-2 bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-700/50">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span className="text-sm">{formattedDate}</span>
              </div>
              <div className="flex items-center space-x-2 bg-slate-800/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-slate-700/50">
                <Image className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-300 font-bold">{photos.length} High-Res Photos</span>
              </div>
            </div>
            
            {event?.description && (
              <p className="text-slate-400 text-sm mt-5 max-w-2xl leading-relaxed border-l-2 border-indigo-500/30 pl-4">{event.description}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto relative z-10 pt-4 lg:pt-0">
            {matchedIds && matchedIds.size > 0 && (
              <button
                onClick={handleDownloadMatched}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-2xl font-bold transition-all shadow-lg"
              >
                <Download className="w-5 h-5" />
                <span>Get My {matchCount} Photos</span>
              </button>
            )}

            {matchedIds !== null && (
              <button
                onClick={clearFilter}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-6 py-4 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-2xl font-bold transition-all shadow-lg"
              >
                <X className="w-5 h-5" />
                <span>Show All</span>
              </button>
            )}

            <button
              onClick={() => setShowScanner(true)}
              className="w-full sm:w-auto flex items-center justify-center space-x-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-white transition-all shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)] transform hover:-translate-y-0.5"
            >
              <ScanFace className="w-5 h-5" />
              <span className="tracking-wide">FIND MY PHOTOS</span>
              <span className="relative flex h-3 w-3 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Match result banner */}
      {matching && (
        <div className="w-full max-w-7xl px-4 sm:px-6 mb-8 mt-4 animate-fade-in-up">
          <div className="bg-indigo-900/40 backdrop-blur-md border border-indigo-500/50 rounded-2xl p-6 flex flex-col items-center justify-center space-y-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-indigo-300 font-black tracking-widest uppercase text-sm">Analyzing billion-point facial geometry...</span>
            <div className="w-64 h-1 bg-indigo-950 rounded-full overflow-hidden">
               <div className="w-1/2 h-full bg-indigo-400 animate-pulse rounded-full"></div>
            </div>
          </div>
        </div>
      )}

      {matchedIds !== null && !matching && (
        <div className="w-full max-w-7xl px-4 sm:px-6 mb-8 mt-4 animate-fade-in-up">
          {matchedIds.size > 0 ? (
            <div className="bg-emerald-900/30 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-5 flex items-center space-x-4">
              <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <span className="block text-emerald-400 font-bold text-lg">
                  Neural Match Verified
                </span>
                <span className="block text-emerald-500/80 text-sm font-medium">
                  We found {matchCount} photo{matchCount > 1 ? 's' : ''} containing your exact facial geometry.
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 flex items-center space-x-4">
               <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">
                <Camera className="w-6 h-6 text-slate-500" />
              </div>
              <div>
                <span className="block text-slate-300 font-bold text-lg">
                  No Matching Faces Found
                </span>
                <span className="block text-slate-500 text-sm font-medium">
                  Ensure you are well-lit and directly facing the camera. Scanning glasses or masks may impact results.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Photo Grid */}
      <div className="w-full max-w-7xl px-4 sm:px-6 mt-4 relative z-10">
        <PhotoGrid photos={photos} highlightIds={matchedIds} />
      </div>

      {/* Face Scanner Modal */}
      {showScanner && (
        <FaceScanner
          onDescriptorReady={handleFaceDescriptor}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
