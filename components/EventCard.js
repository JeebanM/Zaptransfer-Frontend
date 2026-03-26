import { Camera, QrCode, Image as ImageIcon, Calendar, Trash2, ArrowRight } from 'lucide-react';

/**
 * Premium Event Card for the Photographer Studio Dashboard
 */
export default function EventCard({ event, index, onViewQR, onOpen, onDelete }) {
  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Generate a deterministic gradient based on eventId
  const getGradient = (id) => {
    const colors = [
      'from-indigo-500 to-purple-500',
      'from-emerald-400 to-cyan-500',
      'from-amber-400 to-orange-500',
      'from-pink-500 to-rose-500',
      'from-blue-600 to-indigo-600',
      'from-fuchsia-500 to-pink-500'
    ];
    const hash = (id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const gradientClass = getGradient(event.eventId);

  return (
    <div 
      className="group relative bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-3xl overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-500 animate-fade-in-up"
      style={{ animationDelay: `${(index || 0) * 100}ms` }}
    >
      {/* Cover Image Area */}
      <div className={`h-40 w-full bg-gradient-to-br ${gradientClass} relative overflow-hidden`}>
        {/* Subtle overlay noise/pattern could go here */}
        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-500"></div>
        
        {/* Action Overlay on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-slate-900/40 backdrop-blur-sm z-10">
          <button
            onClick={() => onOpen(event.eventId)}
            className="px-6 py-2.5 bg-white text-slate-900 font-bold rounded-full shadow-xl flex items-center space-x-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
          >
            <Camera className="w-4 h-4" />
            <span>Open Studio</span>
          </button>
        </div>

        {/* Badges */}
        <div className="absolute top-4 right-4 flex space-x-2 z-0">
          <button
            onClick={(e) => { e.stopPropagation(); onViewQR(event.eventId); }}
            className="p-2 bg-slate-900/40 hover:bg-slate-900/80 backdrop-blur-md text-white rounded-full transition-colors shadow-lg"
            title="Share via QR"
          >
            <QrCode className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(event.eventId); }}
            className="p-2 bg-slate-900/40 hover:bg-red-500/80 backdrop-blur-md text-white rounded-full transition-colors shadow-lg"
            title="Delete Gallery"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 relative">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-bold text-white truncate pr-4 group-hover:text-indigo-300 transition-colors">
            {event.name}
          </h3>
        </div>
        
        <div className="flex items-center space-x-2 text-slate-400 text-sm mb-6">
          <Calendar className="w-4 h-4 opacity-70" />
          <span>{formattedDate}</span>
        </div>

        {/* Stats Row */}
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400 font-medium">Synced Media</span>
            <div className="flex items-center space-x-1.5 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/50">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-bold text-slate-200">{event.photoCount} files</span>
            </div>
          </div>
          
          {/* Progress Bar Mockue (Visual only for Studio Feel) */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-full rounded-full bg-gradient-to-r ${gradientClass} opacity-50 group-hover:opacity-100 transition-opacity`} 
              style={{ width: event.photoCount > 0 ? '100%' : '5%' }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
