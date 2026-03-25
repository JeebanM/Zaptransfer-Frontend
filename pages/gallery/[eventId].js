import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import PhotoGrid from '@/components/PhotoGrid';
import FaceScanner from '@/components/FaceScanner';
import {
  Zap, ScanFace, Image, Calendar, Download, X, Loader2, Camera
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
        a.href = p.imageUrl;
        a.download = `photo_${p.photoId}.jpg`;
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
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-4" />
        <p className="text-slate-400">Loading gallery...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
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
    <div className="min-h-screen p-4 flex flex-col items-center">
      <Head>
        <title>{event?.name || 'Gallery'} — ZapTransfer</title>
        <meta name="description" content={`View and download photos from ${event?.name || 'this event'}`} />
      </Head>

      {/* Header */}
      <div className="w-full max-w-6xl py-6 mb-6 border-b border-slate-800">
        <div className="flex items-center space-x-3 mb-4">
          <Zap className="w-5 h-5 text-blue-400" />
          <span className="text-sm font-medium bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            ZapTransfer Gallery
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">{event?.name}</h1>
            <div className="flex items-center space-x-4 mt-2">
              <div className="flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">{formattedDate}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <Image className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-400">{photos.length} photos</span>
              </div>
            </div>
            {event?.description && (
              <p className="text-slate-400 text-sm mt-2 max-w-xl">{event.description}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-3">
            {matchedIds && matchedIds.size > 0 && (
              <button
                onClick={handleDownloadMatched}
                className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/20 rounded-xl text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download My Photos ({matchCount})</span>
              </button>
            )}

            {matchedIds !== null && (
              <button
                onClick={clearFilter}
                className="flex items-center space-x-2 px-4 py-2.5 bg-slate-700/40 hover:bg-slate-700/80 text-slate-300 border border-slate-600/30 rounded-xl text-sm font-medium transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Show All</span>
              </button>
            )}

            <button
              onClick={() => setShowScanner(true)}
              className="flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20"
            >
              <ScanFace className="w-4 h-4" />
              <span>Find My Photos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Match result banner */}
      {matching && (
        <div className="w-full max-w-6xl mb-6 glass-card rounded-2xl p-4 flex items-center justify-center space-x-3 animate-fade-in">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <span className="text-blue-300 font-medium">Searching for your photos...</span>
        </div>
      )}

      {matchedIds !== null && !matching && (
        <div className="w-full max-w-6xl mb-6 animate-fade-in">
          {matchedIds.size > 0 ? (
            <div className="glass-card rounded-2xl p-4 flex items-center justify-between border-emerald-500/20">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-emerald-500/15 rounded-lg flex items-center justify-center">
                  <Camera className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-emerald-400 font-medium">
                  Found {matchCount} photo{matchCount > 1 ? 's' : ''} of you! 🎉
                </span>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-2xl p-4 flex items-center space-x-3 border-amber-500/20">
              <span className="text-amber-400 text-sm">
                No matching photos found. Try better lighting or a different angle.
              </span>
            </div>
          )}
        </div>
      )}

      {/* Photo Grid */}
      <div className="w-full max-w-6xl">
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
