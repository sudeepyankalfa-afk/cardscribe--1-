/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Upload, AlertCircle, Sparkles, Loader2, RefreshCw, Smartphone, Image as ImageIcon, Trash2, Check } from 'lucide-react';
import { useCaptureStore } from '../stores/captureStore';
import { useReviewStore } from '../stores/reviewStore';
import { LocalOcrEngine } from '../ocr/LocalOcrEngine';
import { CloudOcrEngine } from '../ocr/CloudOcrEngine';
import { HeuristicParser } from '../ocr/HeuristicParser';
import { validateImageFile, generateThumbnailUrl } from '../utils/imageUtils';
import { CaptureSession } from '../types';
import { useAuthStore } from '../stores/authStore';

interface CaptureScreenProps {
  onNavigate: (view: 'home' | 'capture' | 'review') => void;
}

export function CaptureScreen({ onNavigate }: CaptureScreenProps) {
  const { startSession, updateSessionStatus, setProcessingProgress, progress, activeSession } = useCaptureStore();
  const { setDraft } = useReviewStore();

  const [ocrEngineMode, setOcrEngineMode] = useState<'local' | 'cloud'>('local');
  const [onlineStatus, setOnlineStatus] = useState(navigator.onLine);
  
  // Camera state
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Drag and drop upload state
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active selected side for capturing/uploading ('front' or 'back')
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  // Captured files data
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [frontThumb, setFrontThumb] = useState<string | null>(null);
  const [backThumb, setBackThumb] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync online status
  useEffect(() => {
    const updateOnline = () => {
      setOnlineStatus(navigator.onLine);
      if (!navigator.onLine) {
        setOcrEngineMode('local');
      }
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    


    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  // Shutdown camera stream on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraError(null);
    setUploadError(null);
    try {
      if (streamRef.current) {
        stopCamera();
      }

      const constraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Back camera for capturing text documents
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      setHasCamera(true);
    } catch (err: any) {
      console.warn('Camera initiation failed:', err);
      setHasCamera(false);
      setCameraActive(false);
      
      // Map error message gracefully for user
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera service denied. Please unlock permission or choose a file upload instead.');
      } else {
        setCameraError('Could not start video stream. Your device might not support native browsers camera streams.');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const executeOcrProc = async (base64ImageOrImages: string | string[], thumbUrlOrUrls: string | string[]) => {
    // Generate a unique ID
    const sessionId = 'session_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    const session: CaptureSession = {
      id: sessionId,
      createdAt: Date.now(),
      userId: useAuthStore.getState().currentUser?.id || undefined,
      imageUrl: base64ImageOrImages,
      thumbnailUrl: thumbUrlOrUrls,
      status: 'processing',
      ocrEngineUsed: ocrEngineMode,
    };

    // Save capture session to store and DB
    await startSession(session);
    onNavigate('review'); // Promptly navigate to show the loading skeletal loader

    try {
      const mode = ocrEngineMode === 'cloud' && onlineStatus ? 'cloud' : 'local';
      const engine = mode === 'cloud' ? new CloudOcrEngine() : new LocalOcrEngine();

      // Implement timeout limits based on speed SLA requirements
      const timeoutLimitMs = mode === 'cloud' ? 30000 : 45000;
      const ocrPromise = engine.processImage(base64ImageOrImages, (percent) => {
        setProcessingProgress(percent);
      });

      // Timeout wrapper
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Extraction timed out (exceeded SLA threshold of ${timeoutLimitMs / 1000}s)`)), timeoutLimitMs);
      });

      // Complete the processing
      const ocrResult = await Promise.race([ocrPromise, timeoutPromise]);
      const parsedContact = HeuristicParser.parse(ocrResult);

      // Save complete status
      await updateSessionStatus(sessionId, 'complete', {
        ocrResult,
        parsedContact
      });
      
      // Update review edit draft state
      setDraft(parsedContact);

    } catch (error: any) {
      console.error('OCR Process failed:', error);
      await updateSessionStatus(sessionId, 'failed', {
        errorMessage: error.message || 'Unknown scanning error occurred.'
      });
    }
  };

  const handleCapturedImage = async (rawSrc: string) => {
    try {
      const thumbUrl = await generateThumbnailUrl(rawSrc, 180, 135);
      if (activeSide === 'front') {
        setFrontImage(rawSrc);
        setFrontThumb(thumbUrl);
        // Guide them to back side automatically if not already captured
        if (!backImage) {
          setActiveSide('back');
        }
      } else {
        setBackImage(rawSrc);
        setBackThumb(thumbUrl);
      }
    } catch (e) {
      console.error('Error handling side card image:', e);
      setUploadError('Failed to generate preview thumbnail.');
    }
  };

  const handleStartAnalysis = () => {
    if (!frontImage) {
      setUploadError('Front side of business card is required first.');
      return;
    }

    const base64Images: string[] = [frontImage];
    const thumbUrls: string[] = [frontThumb || ''];

    if (backImage) {
      base64Images.push(backImage);
      thumbUrls.push(backThumb || '');
    }

    executeOcrProc(base64Images, thumbUrls);
  };

  const handleClearSide = (side: 'front' | 'back', e: React.MouseEvent) => {
    e.stopPropagation();
    if (side === 'front') {
      setFrontImage(null);
      setFrontThumb(null);
      setActiveSide('front');
    } else {
      setBackImage(null);
      setBackThumb(null);
      setActiveSide('back');
    }
  };

  // Perform Capture from Active Stream
  const capturePhoto = async () => {
    if (!videoRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 1280;
      canvas.height = videoRef.current.videoHeight || 720;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw the vertical video frame to the canvas
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.9);

      // Stop camera stream to conserve system camera locks
      stopCamera();

      // Process card capture
      await handleCapturedImage(base64Image);
    } catch (err) {
      console.error('Error drawing canvas output stream:', err);
      setCameraError('Failed to capture picture. Try uploading directly.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setCameraError(null);
    const files = e.target.files;
    if (files && files.length > 0) {
      await processSelectedFile(files[0]);
    }
  };

  const processSelectedFile = async (file: File) => {
    const check = validateImageFile(file);
    if (!check.isValid) {
      setUploadError(check.reason || 'File validation failed.');
      return;
    }

    try {
      // Read file to binary base64 DataURL
      const reader = new FileReader();
      reader.onload = async (event) => {
        const rawSrc = event.target?.result as string;
        if (!rawSrc) {
          setUploadError('Failed to parse selected image asset.');
          return;
        }

        await handleCapturedImage(rawSrc);
      };
      
      reader.onerror = () => {
        setUploadError('Error occurred while reading the file.');
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setUploadError('Error processing files.');
    }
  };

  // Drag-and-drop dropzone triggers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    setUploadError(null);
    setCameraError(null);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" id="capture-container">
      {/* Header and Toggle Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-850 dark:text-slate-100 tracking-tight" id="capture-title">
            Scan Business Card
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Attach up to 2 images (front and back side) of your business card to combine and analyze details.
          </p>
        </div>
        
        {/* OCR Strategy selection tab */}
        <div className="bg-slate-50 dark:bg-slate-900 p-1 rounded-xl flex items-center border border-slate-200 dark:border-slate-800 self-start" id="ocr-engine-selector-panel">
          <button
            onClick={() => setOcrEngineMode('local')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
              ocrEngineMode === 'local'
                ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-50 border border-slate-200/60 dark:border-slate-750 shadow-xs'
                : 'text-slate-500 hover:text-slate-850 dark:hover:text-slate-300'
            }`}
            style={{ minHeight: 44 }}
            id="local-ocr-toggle"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Local OCR</span>
          </button>
          <button
            onClick={() => onlineStatus && setOcrEngineMode('cloud')}
            disabled={!onlineStatus}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all relative ${
              ocrEngineMode === 'cloud' && onlineStatus
                ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-50 border border-slate-200/60 dark:border-slate-750 shadow-xs'
                : 'text-slate-500'
            } ${!onlineStatus ? 'opacity-50 cursor-not-allowed' : 'hover:text-slate-850 dark:hover:text-slate-300'}`}
            style={{ minHeight: 44 }}
            title={!onlineStatus ? 'Cloud OCR requires internet network access' : 'High Accuracy extraction'}
            id="cloud-ocr-toggle"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Cloud AI OCR</span>
            {onlineStatus && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            )}
          </button>
        </div>
      </div>

      {/* 2-Side Selector bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8" id="card-sides-layout-row">
        {/* Front slot button */}
        <button
          type="button"
          onClick={() => setActiveSide('front')}
          className={`p-4 rounded-xl border text-left transition-all relative cursor-pointer outline-none bg-white dark:bg-slate-950 ${
            activeSide === 'front'
              ? 'border-blue-600 dark:border-blue-500 bg-blue-50/5 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
              : 'border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900'
          }`}
          id="select-front-side-tab"
        >
          <div className="flex items-center justify-between pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              SIDE A
            </span>
            {frontImage ? (
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wide border border-emerald-100 dark:border-emerald-950">
                <Check className="w-3" /> Captured
              </span>
            ) : (
              <span className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 px-2 py-0.5 rounded font-bold uppercase tracking-wide border border-blue-100 dark:border-blue-950">
                Required
              </span>
            )}
          </div>
          
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mt-2 pointer-events-none">
            Front Side Image
          </h3>
          
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 pointer-events-none">
              {frontThumb ? (
                <img
                  src={frontThumb}
                  alt="Front Thumbnail"
                  className="w-12 h-8 object-cover rounded border border-slate-200 dark:border-slate-800 bg-black"
                />
              ) : (
                <div className="w-12 h-8 rounded border border-dashed border-slate-350 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-[9px] text-slate-450 font-mono">
                  Empty
                </div>
              )}
              <span className="text-xs text-slate-450 dark:text-slate-500 truncate max-w-[150px]">
                {frontImage ? 'Click to inspect / retake' : 'No face image uploaded'}
              </span>
            </div>
            
            {frontImage && (
              <button
                type="button"
                onClick={(e) => handleClearSide('front', e)}
                className="p-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-805 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 text-slate-400 dark:text-slate-500 transition-colors cursor-pointer"
                title="Remove Front Side Image"
                id="clear-front-img-icon"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </button>

        {/* Back slot button */}
        <button
          type="button"
          onClick={() => setActiveSide('back')}
          className={`p-4 rounded-xl border text-left transition-all relative cursor-pointer outline-none bg-white dark:bg-slate-950 ${
            activeSide === 'back'
              ? 'border-blue-600 dark:border-blue-500 bg-blue-50/5 dark:bg-blue-950/20 ring-2 ring-blue-500/20'
              : 'border-slate-200 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-900'
          }`}
          id="select-back-side-tab"
        >
          <div className="flex items-center justify-between pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              SIDE B
            </span>
            {backImage ? (
              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wide border border-emerald-100 dark:border-emerald-950">
                <Check className="w-3" /> Captured
              </span>
            ) : (
              <span className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400 px-2 py-0.5 rounded font-bold uppercase tracking-wide border border-slate-200 dark:border-slate-800">
                Optional
              </span>
            )}
          </div>
          
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 mt-2 pointer-events-none">
            Back Side Image
          </h3>
          
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5 pointer-events-none">
              {backThumb ? (
                <img
                  src={backThumb}
                  alt="Back Thumbnail"
                  className="w-12 h-8 object-cover rounded border border-slate-200 dark:border-slate-800 bg-black"
                />
              ) : (
                <div className="w-12 h-8 rounded border border-dashed border-slate-350 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-center text-[9px] text-slate-455 font-mono">
                  Empty
                </div>
              )}
              <span className="text-xs text-slate-450 dark:text-slate-500 truncate max-w-[150px]">
                {backImage ? 'Click to inspect / retake' : 'Add card backside details'}
              </span>
            </div>
            
            {backImage && (
              <button
                type="button"
                onClick={(e) => handleClearSide('back', e)}
                className="p-1 px-1.5 rounded-lg border border-slate-200 dark:border-slate-805 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 text-slate-400 dark:text-slate-500 transition-colors cursor-pointer"
                title="Remove Back Side Image"
                id="clear-back-img-icon"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Camera capture element card */}
        <div className="md:col-span-7 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col min-h-[400px]" id="camera-viewport-card">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-slate-400" />
              <span>Workspace: {activeSide === 'front' ? 'Side A (Front)' : 'Side B (Back)'} side</span>
            </span>
            {cameraActive && (
              <button
                onClick={stopCamera}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20"
                style={{ minHeight: 44, minWidth: 60 }}
                id="camera-stop-btn"
              >
                Disable Lens
              </button>
            )}
          </div>

          <div className="flex-1 bg-slate-950 flex items-center justify-center relative min-h-[300px]">
            {cameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover aspect-video"
                id="camera-video-source"
              />
            ) : (activeSide === 'front' ? frontImage : backImage) ? (
              // Inspecting currently captured image side
              <div className="w-full h-full p-6 flex flex-col items-center justify-center max-w-lg mx-auto">
                <img
                  src={activeSide === 'front' ? (frontImage || '') : (backImage || '')}
                  alt={`Captured ${activeSide} side`}
                  className="w-full h-auto max-h-[220px] object-contain rounded-lg border border-slate-800 bg-slate-900 shadow-md"
                />
                
                <div className="mt-5 flex items-center gap-2.5">
                  <button
                    onClick={startCamera}
                    className="font-bold text-xs tracking-wide uppercase px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                    id="retake-photo-btn"
                  >
                    Retake with Camera
                  </button>
                  <button
                    onClick={(e) => handleClearSide(activeSide, e)}
                    className="font-bold text-xs tracking-wide uppercase px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 dark:text-rose-450 border border-thin border-rose-100 dark:border-rose-950/50 transition-all cursor-pointer"
                    id="clear-side-btn"
                  >
                    Clear Image
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center p-8 flex flex-col items-center max-w-sm">
                <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-slate-450 mb-4 border border-slate-805">
                  <Camera className="w-8 h-8" />
                </div>
                <h3 className="text-slate-200 font-medium text-sm">Camera Stream Unconnected</h3>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Capture {activeSide === 'front' ? 'the FRONT side A' : 'the BACK side B'} of your card using your device's native glass lens.
                </p>
                <button
                  onClick={startCamera}
                  className="mt-6 font-bold text-xs tracking-wide uppercase px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white transition-all active:scale-[0.98] cursor-pointer"
                  style={{ minHeight: 44, minWidth: 150 }}
                  id="camera-start-btn"
                >
                  Enable Lens Camera
                </button>
              </div>
            )}

            {/* Active camera capture controls */}
            {cameraActive && (
              <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10">
                <button
                  onClick={capturePhoto}
                  className="w-14 h-14 rounded-full border-4 border-white bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 transition-all hover:scale-105 active:scale-95 shadow-md"
                  style={{ minWidth: 56, minHeight: 56 }}
                  aria-label="Capture snapshot"
                  id="camera-snap-btn"
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Camera Permission Error Indicator */}
          {cameraError && (
            <div className="p-4 bg-amber-50 dark:bg-slate-905 text-amber-800 dark:text-amber-400 border-t border-amber-200 dark:border-amber-800 flex items-start gap-2.5" id="camera-error-message">
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed font-sans">
                <p className="font-semibold">Camera access alert</p>
                <p className="mt-1">{cameraError}</p>
              </div>
            </div>
          )}
        </div>

        {/* File Picker Drag-and-Drop Area */}
        <div className="md:col-span-5 flex flex-col gap-6">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center min-h-[220px] cursor-pointer transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-50/10 dark:bg-blue-950/10'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 hover:bg-slate-50/40 dark:hover:bg-slate-950/20'
            }`}
            onClick={() => fileInputRef.current?.click()}
            id="upload-dropzone"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              id="file-capture-picker"
            />
            
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 transition-colors ${
              dragActive
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-900'
            }`}>
              <Upload className="w-6 h-6" />
            </div>

            <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm">
              {dragActive ? `Drop card ${activeSide} side` : `Upload ${activeSide === 'front' ? 'Front' : 'Back'} side`}
            </h3>
            <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">
              Drag &amp; drop a photo of your card's {activeSide === 'front' ? 'FRONT' : 'BACK'} side right here, or click to browse files.
            </p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-4">
              Supports JPEG, PNG, or WebP
            </p>
          </div>

          {/* Validation Reject Frame */}
          {uploadError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-slate-900 border border-rose-100 dark:border-rose-950/40 flex items-start gap-2.5" id="upload-error-message">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-rose-800 dark:text-rose-400 font-sans">
                <p className="font-semibold">Upload rejected</p>
                <p className="mt-1">{uploadError}</p>
              </div>
            </div>
          )}

          {/* Quick instructions panel */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-805 rounded-xl p-5" id="guidelines-card">
            <h4 className="font-semibold text-xs tracking-wider uppercase text-slate-500 mb-3 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-slate-400" />
              Two-Sided Business Cards
            </h4>
            <ul className="space-y-2.5 text-xs text-slate-500 leading-relaxed list-disc list-inside">
              <li>Upload <strong>Side A (Front)</strong> with standard coordinates first.</li>
              <li>Toggle and attach <strong>Side B (Back)</strong> if the card contains details like additional phone lines, websites, or social handles on the back.</li>
              <li>Cloud AI will synthesize information from both sides together into a single contact draft.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Start analysis action trigger */}
      {frontImage && (
        <div className="mt-8 flex flex-col items-center justify-center border border-blue-100 dark:border-blue-900/40 bg-blue-50/5 dark:bg-slate-950/40 p-6 rounded-2xl shadow-sm text-center" id="process-trigger-actions">
          <div className="w-12 h-12 rounded-full bg-blue-100/30 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center mb-3">
            <Sparkles className="w-5 h-5 text-blue-500 animate-pulse" />
          </div>
          <h3 className="font-bold text-slate-850 dark:text-slate-100 text-sm">Ready to Extract Contact Data</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            {backImage 
              ? 'You have attached both the front and back sides of the card! Let\'s analyze them combined.'
              : 'You have loaded the front side of the card. You can also capture the back side, or proceed with just the front side.'}
          </p>
          
          <button
            onClick={handleStartAnalysis}
            className="mt-4 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-98"
            id="trigger-extraction-cta"
          >
            <Sparkles className="w-4 h-4" />
            <span>Extract Details ({backImage ? '2 Sides' : '1 Side'})</span>
          </button>
        </div>
      )}
    </div>
  );
}
export default CaptureScreen;
