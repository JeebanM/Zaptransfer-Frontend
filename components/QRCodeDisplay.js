import QRCode from 'react-qr-code';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function QRCodeDisplay({ url }) {
  const [copied, setCopied] = useState(false);

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* QR Code with glow */}
      <div className="bg-white p-5 rounded-2xl shadow-qr-glow inline-block transition-transform duration-300 hover:scale-105 animate-pulse-glow">
        <QRCode value={url} size={280} level="H" />
      </div>

      {/* Label */}
      <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">
        Scan to receive files
      </p>

      {/* Copy Link Button */}
      <button
        onClick={copyLink}
        className="flex items-center space-x-2 px-5 py-2.5 bg-slate-700/60 hover:bg-slate-700 border border-slate-600/50 rounded-xl text-sm transition-all duration-200 group"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">Link Copied!</span>
          </>
        ) : (
          <>
            <Copy className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" />
            <span className="text-slate-300 group-hover:text-white transition-colors">Copy Share Link</span>
          </>
        )}
      </button>
    </div>
  );
}
