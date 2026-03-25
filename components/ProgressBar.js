export default function ProgressBar({ progress, speed = "", eta = "", statusText = "Transferring..." }) {
  return (
    <div className="w-full max-w-md mx-auto mt-4 px-2">
      <div className="flex justify-between mb-2 items-end">
        <span className="text-sm font-medium text-blue-400">{statusText}</span>
        <div className="text-right">
          <div className="text-sm font-bold text-white">{progress}%</div>
          {(speed || eta) && (
            <div className="text-xs text-slate-400 mt-1">
              <span className="mr-3">{speed}</span>
              <span>{eta}</span>
            </div>
          )}
        </div>
      </div>
      <div className="w-full bg-slate-700/50 rounded-full h-3 mb-4 overflow-hidden border border-slate-600">
        <div 
          className="bg-gradient-to-r from-blue-500 to-emerald-400 h-3 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.6)]" 
          style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
        ></div>
      </div>
    </div>
  );
}
