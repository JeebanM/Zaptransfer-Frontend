import { Camera, QrCode, Image as ImageIcon, Calendar, Trash2 } from 'lucide-react';
import { motion, useMotionTemplate, useMotionValue } from 'framer-motion';

/**
 * Premium Event Card for the Photographer Studio Dashboard (Neon Dark Hybrid)
 */
export default function EventCard({ event, index, onViewQR, onOpen, onDelete }) {
  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Neon Futuristic Gradients
  const getGradient = (id) => {
    const colors = [
      'from-cyan-500 to-blue-600',
      'from-fuchsia-500 to-pink-600',
      'from-emerald-400 to-teal-500',
      'from-violet-500 to-purple-600',
      'from-rose-500 to-red-600',
      'from-amber-400 to-orange-500'
    ];
    const hash = (id || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const gradientClass = getGradient(event.eventId);

  // 3D Tilt effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  function handleMouseMove({ currentTarget, clientX, clientY }) {
    let { left, top, width, height } = currentTarget.getBoundingClientRect();
    let x = clientX - left;
    let y = clientY - top;
    mouseX.set((x / width) * 2 - 1);
    mouseY.set((y / height) * 2 - 1);
  }

  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  const background = useMotionTemplate`radial-gradient(
    300px circle at calc(50% + ${mouseX} * 150px) calc(50% + ${mouseY} * 150px),
    rgba(255,255,255,0.08),
    transparent 80%
  )`;

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 30, rotateX: 15 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      transition={{ type: 'spring', damping: 20, stiffness: 100, delay: index * 0.1 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ y: -5, scale: 1.02 }}
      className="group relative bg-[#09090b]/80 backdrop-blur-xl border border-zinc-800/80 rounded-[2rem] overflow-hidden hover:shadow-[0_20px_40px_-15px_rgba(34,211,238,0.15)] transition-shadow duration-500 cursor-pointer"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <motion.div className="absolute inset-0 z-0 pointer-events-none" style={{ background }} />

      {/* Cover Image Area */}
      <div className={`h-48 w-full bg-gradient-to-br ${gradientClass} relative overflow-hidden`}>
        {/* Tech grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20"></div>
        <div className="absolute inset-0 bg-[#030712]/40 group-hover:bg-[#030712]/10 transition-colors duration-500"></div>
        
        {/* Action Overlay on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[#030712]/60 backdrop-blur-sm z-10">
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(34,211,238,0.4)" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onOpen(event.eventId)}
            className="px-6 py-3 bg-zinc-900 border border-cyan-500/50 text-cyan-400 font-bold rounded-2xl shadow-xl flex items-center space-x-2 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300"
          >
            <Camera className="w-5 h-5" />
            <span className="tracking-wide uppercase text-sm">Open Studio</span>
          </motion.button>
        </div>

        {/* Badges */}
        <div className="absolute top-4 right-4 flex space-x-2 z-20">
          <motion.button
            whileHover={{ scale: 1.1, backgroundColor: "rgba(34,211,238,0.2)" }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); onViewQR(event.eventId); }}
            className="p-2.5 bg-zinc-950/60 backdrop-blur-md text-zinc-300 hover:text-cyan-400 rounded-xl transition-colors border border-zinc-700/50 hover:border-cyan-500/50 shadow-lg"
            title="Share via QR"
          >
            <QrCode className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1, backgroundColor: "rgba(244,63,94,0.2)" }}
            whileTap={{ scale: 0.9 }}
            onClick={(e) => { e.stopPropagation(); onDelete(event.eventId); }}
            className="p-2.5 bg-zinc-950/60 backdrop-blur-md text-zinc-300 hover:text-rose-400 rounded-xl transition-colors border border-zinc-700/50 hover:border-rose-500/50 shadow-lg"
            title="Delete Gallery"
          >
            <Trash2 className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-6 relative z-10 bg-gradient-to-b from-[#09090b] to-[#030712]">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-black tracking-tight text-white truncate pr-4 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-cyan-400 group-hover:to-fuchsia-400 transition-all duration-300">
            {event.name}
          </h3>
        </div>
        
        <div className="flex items-center space-x-2 text-zinc-500 font-medium text-xs uppercase tracking-wider mb-6">
          <Calendar className="w-3.5 h-3.5 opacity-70" />
          <span>{formattedDate}</span>
        </div>

        {/* Stats Row */}
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Synced Media</span>
            <div className="flex items-center space-x-1.5 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800 shadow-inner">
              <ImageIcon className="w-3.5 h-3.5 text-fuchsia-400" />
              <span className="font-bold text-zinc-300 text-xs">{event.photoCount} files</span>
            </div>
          </div>
          
          {/* Neon Progress Bar */}
          <div className="w-full bg-zinc-900 rounded-full h-1 overflow-hidden border border-zinc-800">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: event.photoCount > 0 ? '100%' : '5%' }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={`h-full rounded-full bg-gradient-to-r ${gradientClass} opacity-80 group-hover:opacity-100 transition-opacity shadow-[0_0_10px_currentColor]`}
            ></motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
