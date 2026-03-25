import { File, Image, Film, Music, FileText, Download, Eye } from 'lucide-react';

const getFileIcon = (mimeType) => {
  if (!mimeType) return File;
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  return File;
};

const getFileColor = (mimeType) => {
  if (!mimeType) return 'text-slate-400 bg-slate-500/10';
  if (mimeType.startsWith('image/')) return 'text-pink-400 bg-pink-500/10';
  if (mimeType.startsWith('video/')) return 'text-purple-400 bg-purple-500/10';
  if (mimeType.startsWith('audio/')) return 'text-amber-400 bg-amber-500/10';
  if (mimeType.includes('pdf')) return 'text-red-400 bg-red-500/10';
  return 'text-blue-400 bg-blue-500/10';
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

  return (
    <div className="flex items-center space-x-4 p-4 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-2xl transition-all duration-200 group animate-fade-in-up" style={{ animationDelay: `${(index || 0) * 60}ms` }}>
      {/* Icon */}
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-slate-200 font-medium truncate text-sm">{file.name}</p>
        <p className="text-xs text-slate-400 mt-0.5">{formatSize(file.size)}</p>
        
        {/* Progress bar */}
        {progress !== null && !isComplete && (
          <div className="mt-2 w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-emerald-400 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
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
              className="p-2.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl transition-colors flex"
              title="Preview File"
            >
              <Eye className="w-5 h-5" />
            </a>
            <button
              onClick={() => onDownload(index)}
              className="p-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
          </>
        ) : progress !== null ? (
          <span className="text-xs font-mono text-slate-400">{Math.round(progress)}%</span>
        ) : (
          <span className="text-xs text-emerald-400 font-medium">Ready</span>
        )}
      </div>
    </div>
  );
}
