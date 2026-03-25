import { Camera, QrCode, Image, Calendar, Trash2 } from 'lucide-react';

/**
 * Event summary card for the photographer dashboard.
 * 
 * Props:
 *   event: { eventId, name, date, description, photoCount, createdAt }
 *   onViewQR: (eventId) => void
 *   onOpen: (eventId) => void
 *   onDelete: (eventId) => void
 */
export default function EventCard({ event, onViewQR, onOpen, onDelete }) {
  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className="glass-card rounded-2xl p-5 hover:border-blue-500/40 transition-all duration-300 group animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-slate-100 truncate group-hover:text-blue-300 transition-colors">
            {event.name}
          </h3>
          <div className="flex items-center space-x-2 mt-1">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-sm text-slate-400">{formattedDate}</span>
          </div>
        </div>
        <div className="flex items-center space-x-1 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
          <Image className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-sm font-semibold text-blue-400">{event.photoCount}</span>
        </div>
      </div>

      {event.description && (
        <p className="text-sm text-slate-400 mb-4 line-clamp-2">{event.description}</p>
      )}

      <div className="flex items-center space-x-2 pt-3 border-t border-slate-700/50">
        <button
          onClick={() => onOpen(event.eventId)}
          className="flex-1 flex items-center justify-center space-x-2 py-2.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded-xl text-sm font-medium transition-colors"
        >
          <Camera className="w-4 h-4" />
          <span>Upload Photos</span>
        </button>
        <button
          onClick={() => onViewQR(event.eventId)}
          className="flex items-center justify-center space-x-2 py-2.5 px-4 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-xl text-sm font-medium transition-colors"
          title="Show QR Code"
        >
          <QrCode className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(event.eventId)}
          className="flex items-center justify-center py-2.5 px-3 bg-red-600/10 hover:bg-red-600/20 text-red-400/60 hover:text-red-400 rounded-xl text-sm transition-colors"
          title="Delete Event"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
