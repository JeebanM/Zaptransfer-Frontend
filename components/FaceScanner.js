import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Loader2, ScanFace, RefreshCw } from 'lucide-react';

/**
 * Face scanner modal: opens webcam, detects face, extracts descriptor.
 * 
 * Props:
 *   onDescriptorReady: (descriptor: number[]) => void
 *   onClose: () => void
 */
export default function FaceScanner({ onDescriptorReady, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | scanning | success | error
  const [faceApi, setFaceApi] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Load face-api.js models
  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        const fapi = await import('face-api.js');
        const MODEL_URL = '/models';

        await Promise.all([
          fapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          fapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          fapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        if (!cancelled) {
          setFaceApi(fapi);
          setStatus('ready');
        }
      } catch (err) {
        console.error('Failed to load face-api models:', err);
        if (!cancelled) {
          setStatus('error');
          setErrorMsg('Failed to load face recognition models');
        }
      }
    };

    loadModels();
    return () => { cancelled = true; };
  }, []);

  // Start webcam once models are loaded
  useEffect(() => {
    if (status !== 'ready') return;

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setStatus('error');
        setErrorMsg('Camera access denied. Please allow camera permissions.');
      }
    };

    startWebcam();
  }, [status]);

  // Cleanup webcam on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleScan = useCallback(async () => {
    if (!faceApi || !videoRef.current) return;
    setStatus('scanning');

    try {
      // Detect face from video
      const detection = await faceApi
        .detectSingleFace(videoRef.current, new faceApi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setStatus('ready');
        setErrorMsg('No face detected. Please center your face and try again.');
        setTimeout(() => setErrorMsg(''), 3000);
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      setStatus('success');

      // Small delay so user sees the success animation
      setTimeout(() => {
        onDescriptorReady(descriptor);
      }, 800);
    } catch (err) {
      console.error('Face scan error:', err);
      setStatus('ready');
      setErrorMsg('Scan failed. Please try again.');
      setTimeout(() => setErrorMsg(''), 3000);
    }
  }, [faceApi, onDescriptorReady]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-3xl animate-fade-in" onClick={onClose}>
      <div className="relative w-full max-w-md bg-slate-900/60 backdrop-blur-2xl border border-slate-700/50 rounded-[3rem] p-8 shadow-2xl overflow-hidden ring-1 ring-white/10" onClick={(e) => e.stopPropagation()}>
        
        {/* Core Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-inner">
              <ScanFace className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-xl font-black text-white tracking-tight">AI Identity</h3>
              <p className="text-xs text-indigo-300/70 font-medium uppercase tracking-widest">Neural Scanner</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video / Status Area */}
        <div className="relative z-10 flex flex-col items-center">
          
          <div className="relative w-64 h-64 mb-8">
            {/* The Circular Scanner Border */}
            <div className={`absolute inset-[-8px] rounded-full border-[3px] border-dashed transition-all duration-700 ${
              status === 'scanning' ? 'border-indigo-400 animate-[spin_6s_linear_infinite] shadow-[0_0_30px_rgba(99,102,241,0.4)]' : 
              status === 'success' ? 'border-emerald-400 shadow-[0_0_40px_rgba(52,211,153,0.5)]' : 
              'border-slate-700'
            }`}></div>

            {/* Inner Video Mask */}
            <div className="relative w-full h-full rounded-full overflow-hidden bg-slate-950 shadow-inner ring-4 ring-slate-900">
              
              {status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900">
                  <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                  <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-black">Initializing...</span>
                </div>
              )}

              {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/30">
                  <span className="text-4xl mb-2">⚠️</span>
                  <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold px-4 text-center">{errorMsg}</span>
                </div>
              )}

              {(status === 'ready' || status === 'scanning' || status === 'success') && (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-all duration-1000 ${status === 'success' ? 'scale-110 brightness-110 sepia-[.2] hue-rotate-[-30deg]' : 'scale-100'}`}
                  style={{ transform: 'scaleX(-1)' }} // Mirror webcam
                />
              )}

              {/* Scanning Overlay Sweep */}
              {status === 'scanning' && (
                <div className="absolute inset-0 bg-indigo-500/20 z-20">
                  <div className="w-full h-1 bg-indigo-400 shadow-[0_0_20px_4px_#818cf8] absolute left-0 animate-[shimmer_2s_infinite]"></div>
                </div>
              )}

              {/* Success Flash Overlay */}
              {status === 'success' && (
                <div className="absolute inset-0 flex items-center justify-center bg-emerald-500/30 backdrop-blur-sm z-30 animate-fade-in">
                  <div className="w-16 h-16 bg-emerald-400 text-white rounded-full flex items-center justify-center shadow-[0_0_40px_#34d399] animate-bounce">
                    <Check className="w-8 h-8 font-bold" />
                  </div>
                </div>
              )}

            </div>
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Action Trigger */}
          <div className="w-full h-16 flex items-center justify-center">
            {status === 'ready' ? (
              <button
                onClick={handleScan}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black text-white tracking-wide transition-all duration-300 shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_40px_rgba(99,102,241,0.5)] flex items-center justify-center space-x-3"
              >
                <ScanFace className="w-5 h-5" />
                <span>INITIATE SCAN</span>
              </button>
            ) : status === 'scanning' ? (
              <div className="flex items-center space-x-3 text-indigo-400">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="font-black tracking-widest uppercase text-sm">Analyzing Facial Geometry...</span>
              </div>
            ) : status === 'success' ? (
              <div className="flex items-center space-x-3 text-emerald-400">
                <span className="font-black tracking-widest uppercase text-sm">Match Confirmed</span>
              </div>
            ) : (
              <span className="text-slate-500 text-sm">{errorMsg || 'Awaiting Camera'}</span>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
