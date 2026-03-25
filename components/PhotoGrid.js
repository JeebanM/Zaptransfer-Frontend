import { useState, useRef, useEffect, useCallback } from 'react';
import Lightbox from './Lightbox';
import { Download, Loader2 } from 'lucide-react';

/**
 * Responsive photo grid with lazy loading, hover overlays, and lightbox.
 * 
 * Props:
 *   photos: [{ photoId, imageUrl, thumbnailUrl }]
 *   highlightIds: Set<string> | null  — if set, dim non-matching photos
 */
export default function PhotoGrid({ photos, highlightIds = null }) {
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [loadedSet, setLoadedSet] = useState(new Set());
  const observerRef = useRef(null);

  // Intersection observer for lazy loading
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
        { rootMargin: '200px' }
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
    a.download = `photo_${photo.photoId}.jpg`;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const displayPhotos = highlightIds
    ? photos.filter(p => highlightIds.has(p.photoId))
    : photos;

  const allPhotosForLightbox = displayPhotos;

  if (photos.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📷</div>
        <p className="text-slate-400 text-lg">No photos yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="photo-grid">
        {displayPhotos.map((photo, index) => {
          const isLoaded = loadedSet.has(photo.photoId);
          const isDimmed = highlightIds && !highlightIds.has(photo.photoId);

          return (
            <div
              key={photo.photoId}
              ref={imageRef}
              data-photoid={photo.photoId}
              className={`photo-grid-item ${isDimmed ? 'opacity-20' : ''}`}
              onClick={() => setLightboxIndex(index)}
              style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
            >
              {isLoaded ? (
                <img
                  src={photo.thumbnailUrl}
                  alt=""
                  className="photo-grid-img"
                  loading="lazy"
                />
              ) : (
                <div className="photo-grid-placeholder">
                  <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                </div>
              )}

              {/* Hover overlay */}
              <div className="photo-grid-overlay">
                <button
                  onClick={(e) => handleDownload(e, photo)}
                  className="p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/40 transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxIndex >= 0 && (
        <Lightbox
          photos={allPhotosForLightbox}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(-1)}
          onChange={setLightboxIndex}
        />
      )}
    </>
  );
}
