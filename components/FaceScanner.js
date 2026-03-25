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
    <div className="face-scanner-overlay" onClick={onClose}>
      <div className="face-scanner-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center">
              <ScanFace className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Find My Photos</h3>
              <p className="text-xs text-slate-400">Position your face in the frame</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Video / Status */}
        <div className="face-scanner-video-wrap">
          {status === 'loading' && (
            <div className="face-scanner-status">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
              <p className="text-slate-300 mt-3">Loading face recognition...</p>
            </div>
          )}

          {status === 'error' && (
            <div className="face-scanner-status">
              <div className="text-4xl mb-3">😕</div>
              <p className="text-red-400 text-sm text-center">{errorMsg}</p>
            </div>
          )}

          {(status === 'ready' || status === 'scanning' || status === 'success') && (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="face-scanner-video"
              />
              {/* Face outline overlay */}
              <div className={`face-scanner-frame ${status === 'scanning' ? 'scanning' : ''} ${status === 'success' ? 'success' : ''}`} />

              {status === 'scanning' && (
                <div className="face-scanner-scan-line" />
              )}

              {status === 'success' && (
                <div className="face-scanner-status-overlay">
                  <div className="text-5xl">✅</div>
                  <p className="text-emerald-400 font-bold mt-2">Face Captured!</p>
                </div>
              )}
            </>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Error message */}
        {errorMsg && status === 'ready' && (
          <p className="text-amber-400 text-sm text-center mt-3 animate-fade-in">{errorMsg}</p>
        )}

        {/* Action button */}
        {status === 'ready' && (
          <button
            onClick={handleScan}
            className="w-full mt-4 py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-xl font-bold text-white transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20"
          >
            <Camera className="w-5 h-5" />
            <span>Scan My Face</span>
          </button>
        )}

        {status === 'scanning' && (
          <div className="w-full mt-4 py-3.5 bg-blue-600/30 rounded-xl text-center">
            <div className="flex items-center justify-center space-x-2 text-blue-300">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="font-medium">Analyzing...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
