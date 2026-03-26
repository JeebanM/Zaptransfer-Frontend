import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Download, Loader2 } from 'lucide-react';

/**
 * Premium Full-screen lightbox photo viewer with touch swipe support
 */
export default function Lightbox({ photos, currentIndex, onClose, onChange }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    setImgLoaded(false);
  }, [currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentIndex > 0) onChange(currentIndex - 1);
      if (e.key === 'ArrowRight' && currentIndex < photos.length - 1) onChange(currentIndex + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIndex, photos.length, onClose, onChange]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const photo = photos[currentIndex];
  if (!photo) return null;

  const handleDownload = (e) => {
    e.stopPropagation();
    const a = document.createElement('a');
    
    // Cloudinary native download enforcement
    const dlUrl = photo.imageUrl.replace('/upload/', '/upload/fl_attachment/');
    
    a.href = dlUrl;
    a.download = `zaptransfer_${photo.photoId}.jpg`;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Swipe handlers
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (diff > 50 && currentIndex < photos.length - 1) {
      // Swipe left = next
      onChange(currentIndex + 1);
    } else if (diff < -50 && currentIndex > 0) {
      // Swipe right = prev
      onChange(currentIndex - 1);
    }
    touchStartX.current = null;
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-3xl animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="relative w-full h-full flex items-center justify-center p-4 md:p-12" 
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        
        {/* Top Controls Bar */}
        <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-start z-50 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
          <div className="flex items-center space-x-4 pointer-events-auto">
            <span className="text-white font-medium bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl text-sm border border-white/10">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>
          <div className="flex items-center space-x-4 pointer-events-auto">
            <button
              onClick={handleDownload}
              className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all shadow-lg border border-white/10 hover:scale-110"
              title="Download High-Res"
            >
              <Download className="w-6 h-6" />
            </button>
            <button
              onClick={onClose}
              className="p-3 bg-red-500/20 hover:bg-red-500/40 backdrop-blur-md rounded-full text-white transition-all shadow-lg border border-red-500/30 hover:scale-110"
              title="Close (Esc)"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Navigation arrows (Desktop) */}
        {currentIndex > 0 && (
          <button
            onClick={() => onChange(currentIndex - 1)}
            className="hidden md:flex absolute left-8 z-50 p-4 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-full text-white transition-all border border-white/10 hover:scale-110 focus:outline-none"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={() => onChange(currentIndex + 1)}
            className="hidden md:flex absolute right-8 z-50 p-4 bg-white/5 hover:bg-white/10 backdrop-blur-xl rounded-full text-white transition-all border border-white/10 hover:scale-110 focus:outline-none"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        )}

        {/* Image Display */}
        <div className="relative w-full h-full flex items-center justify-center max-w-7xl max-h-screen outline-none">
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-[spin_2s_linear_infinite]" />
            </div>
          )}
          <img
            src={photo.imageUrl}
            alt={`Gallery Item ${currentIndex + 1}`}
            className={`max-w-full max-h-[85vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-all duration-700 ease-in-out select-none ${imgLoaded ? 'opacity-100 scale-100 hover:scale-[1.02]' : 'opacity-0 scale-95'}`}
            onLoad={() => setImgLoaded(true)}
            draggable="false"
          />
        </div>
      </div>
    </div>
  );
}
