import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, Download } from 'lucide-react';

/**
 * Full-screen lightbox photo viewer with navigation.
 * 
 * Props:
 *   photos: [{ photoId, imageUrl, thumbnailUrl }]
 *   currentIndex: number
 *   onClose: () => void
 *   onChange: (index) => void
 */
export default function Lightbox({ photos, currentIndex, onClose, onChange }) {
  const [imgLoaded, setImgLoaded] = useState(false);

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

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = photo.imageUrl;
    a.download = `photo_${photo.photoId}.jpg`;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="lightbox-close"
          title="Close (Esc)"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Download button */}
        <button
          onClick={handleDownload}
          className="lightbox-download"
          title="Download"
        >
          <Download className="w-5 h-5" />
        </button>

        {/* Counter */}
        <div className="lightbox-counter">
          {currentIndex + 1} / {photos.length}
        </div>

        {/* Image */}
        <div className="lightbox-image-wrap">
          {!imgLoaded && (
            <div className="lightbox-loader">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          <img
            src={photo.imageUrl}
            alt=""
            className={`lightbox-img ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
          />
        </div>

        {/* Navigation arrows */}
        {currentIndex > 0 && (
          <button
            onClick={() => onChange(currentIndex - 1)}
            className="lightbox-nav lightbox-nav-left"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        )}
        {currentIndex < photos.length - 1 && (
          <button
            onClick={() => onChange(currentIndex + 1)}
            className="lightbox-nav lightbox-nav-right"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        )}
      </div>
    </div>
  );
}
