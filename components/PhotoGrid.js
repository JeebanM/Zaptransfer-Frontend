import { useState, useRef, useEffect, useCallback } from 'react';
import Lightbox from './Lightbox';
import { Download, Camera } from 'lucide-react';

/**
 * Premium Masonry photo grid with lazy loading shimmers and smooth hover overlay
 */
export default function PhotoGrid({ photos, highlightIds = null }) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [loadedSet, setLoadedSet] = useState(new Set());
  const observerRef = useRef(null);

  // Intersection observer for lazy loading thresholds
  const imageRef = useCallback((node) => {
    if (!node) return;
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const id = entry.target.dataset.photoid;
              setLoadedSet(prev => new Set(prev).add(id));
              observerRef.current.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '300px' } // Load images 300px before they enter viewport
      );
    }
    observerRef.current.observe(node);
  }, []);

  useEffect(() => {
    return () => observerRef.current?.disconnect();
  }, []);

  const handleDownload = (e, photo) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = photo.imageUrl;
    a.download = `zaptransfer_${photo.photoId}.jpg`;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const displayPhotos = highlightIds
    ? photos.filter(p => highlightIds.has(p.photoId))
    : photos;

  if (photos.length === 0) {
    return (
      <div className="w-full py-24 flex flex-col items-center justify-center bg-slate-900/30 backdrop-blur-md border border-slate-700/50 rounded-3xl border-dashed">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <Camera className="w-10 h-10 text-slate-500" />
        </div>
        <h3 className="text-2xl font-black text-slate-300 mb-2">Gallery is empty</h3>
        <p className="text-slate-500 text-lg">The photographer hasn't uploaded any photos to this event yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {displayPhotos.map((photo, index) => {
          const isLoaded = loadedSet.has(photo.photoId);
          const isDimmed = highlightIds && !highlightIds.has(photo.photoId);

          return (
            <div
              key={photo.photoId}
              ref={imageRef}
              data-photoid={photo.photoId}
              onClick={() => setLightboxIndex(index)}
              className={`break-inside-avoid relative group rounded-2xl overflow-hidden cursor-zoom-in bg-slate-800 animate-fade-in-up ${isDimmed ? 'opacity-20 grayscale transition-all duration-1000' : 'transition-all duration-500 shadow-lg hover:shadow-indigo-500/20 hover:ring-2 hover:ring-indigo-500/50'}`}
            >
              {/* Image with extreme blur-up loading and group-hover scaling */}
              <img
                src={photo.thumbnailUrl}
                alt={`Photo ${photo.photoId}`}
                loading="lazy"
                onLoad={(e) => {
                  e.target.style.opacity = 1;
                  e.target.style.filter = 'blur(0px)';
                }}
                className="w-full h-auto object-cover transform transition-all duration-[800ms] group-hover:scale-110 opacity-0 blur-md"
                style={{ 
                  aspectRatio: photo.width && photo.height ? `${photo.width}/${photo.height}` : 'auto' 
                }}
              />
              
              {/* Skeleton Shimmer Overlay */}
              {!isLoaded && (
                <div className="absolute inset-0 bg-slate-800 animate-pulse overflow-hidden rounded-2xl"></div>
              )}

              {/* Action Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-5">
                <div className="flex justify-between items-end transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                  <div className="flex space-x-2">
                     <span className="text-[10px] uppercase tracking-widest font-black text-white bg-white/20 backdrop-blur-md px-2 py-1 rounded-md">HQ Image</span>
                  </div>
                  <button
                    onClick={(e) => handleDownload(e, photo)}
                    className="p-3 bg-white/10 hover:bg-white/30 backdrop-blur-xl border border-white/20 rounded-full transition-colors shadow-2xl"
                    title="Download Native File"
                  >
                    <Download className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Premium Lightbox Overlay */}
      {lightboxIndex >= 0 && (
        <Lightbox
          photos={displayPhotos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(-1)}
          onChange={setLightboxIndex}
        />
      )}
    </>
  );
}
