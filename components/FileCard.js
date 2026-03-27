import { File, Image, Film, Music, FileText, Download, Eye } from 'lucide-react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';

const getFileIcon = (mimeType) => {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  return File;
};

const getFileColor = (mimeType) => {
  if (!mimeType) return 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30';
  if (mimeType.startsWith('image/')) return 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30';
  if (mimeType.startsWith('video/')) return 'text-purple-400 bg-purple-500/10 border-purple-500/30';
  if (mimeType.startsWith('audio/')) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
  if (mimeType.includes('pdf')) return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
};

const formatSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export default function FileCard({ file, progress = null, downloadUrl = null, onDownload = null, index }) {
  const Icon = getFileIcon(file.type || file.mimeType);
  const colorClass = getFileColor(file.type || file.mimeType);
  const isComplete = progress === 100;

  // 3D Tilt effect values
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    let { left, top, width, height } = currentTarget.getBoundingClientRect();
    let x = clientX - left;
    let y = clientY - top;
    // Values from -1 to 1
    mouseX.set((x / width) * 2 - 1);
    mouseY.set((y / height) * 2 - 1);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  // Hover Glow effect template
  const background = useMotionTemplate`radial-gradient(
    250px circle at calc(50% + ${mouseX} * 100px) calc(50% + ${mouseY} * 100px),
    rgba(255, 255, 255, 0.05),
    transparent 80%
  )`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, rotateX: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      transition={{ type: 'spring', damping: 20, stiffness: 200, delay: index * 0.05 }}
      whileHover={{ y: -4, scale: 1.02 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative group bg-[#09090b]/80 hover:bg-[#030712] border border-zinc-800/80 rounded-2xl overflow-hidden cursor-pointer"
      style={{
        transformStyle: 'preserve-3d',
      }}
    >
      <motion.div className="absolute inset-0 pointer-events-none" style={{ background }} />
      
      <div className="relative z-10 flex items-center space-x-4 p-4 transform-gpu transition-all duration-200">
        {/* Neon Icon */}
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border shadow-2xl ${colorClass}`}>
          <Icon className="w-6 h-6 drop-shadow-[0_0_8px_currentColor]" />
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="text-zinc-100 font-bold tracking-tight truncate text-sm">{file.name}</p>
          <p className="text-xs text-zinc-500 mt-0.5 tracking-wider uppercase font-medium">{formatSize(file.size)}</p>
          
          {/* Progress bar */}
          {progress !== null && !isComplete && (
            <div className="mt-2.5 w-full bg-zinc-900 rounded-full h-1 overflow-hidden border border-zinc-800">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                transition={{ type: "tween", ease: "linear", duration: 0.5 }}
                className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 h-1 rounded-full shadow-[0_0_10px_#22d3ee]"
              />
            </div>
          )}
        </div>

        {/* Status / Download */}
        <div className="flex flex-shrink-0 items-center space-x-2">
          {isComplete && downloadUrl && onDownload ? (
            <>
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-colors flex border border-zinc-700/50 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                title="Preview File"
              >
                <Eye className="w-5 h-5" />
              </a>
              <motion.button
                whileHover={{ scale: 1.1, textShadow: "0 0 8px rgb(16,185,129)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onDownload(index)}
                className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors border border-emerald-500/30 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                title="Download"
              >
                <Download className="w-5 h-5" />
              </motion.button>
            </>
          ) : progress !== null ? (
            <span className="text-xs font-mono font-bold text-cyan-400 drop-shadow-[0_0_5px_#22d3ee]">{Math.round(progress)}%</span>
          ) : (
            <span className="text-xs text-emerald-400 font-black tracking-widest uppercase drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">Ready</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
