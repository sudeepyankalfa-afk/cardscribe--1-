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
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Drag and drop upload state
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Active selected side for capturing/uploading ('front' or 'back')
  const [activeSide, setActiveSide] = useState<'front' | 'back'>('front');

  // Active method of camera capture or file upload ('camera' or 'upload')
  const [activeTab, setActiveTab] = useState<'camera' | 'upload'>('camera');

  // Captured files data
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [frontThumb, setFrontThumb] = useState<string | null>(null);
  const [backThumb, setBackThumb] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement | null>(null);

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

  // Ensure any standard browser webcam streams are kept closed as we use native camera exclusively
  useEffect(() => {
    stopCamera();
  }, [activeTab]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    // 8. Prevent Duplicate Camera Initialization
    if (cameraLoading || (cameraActive && streamRef.current?.active)) {
      console.log('Camera already active or loading. Skipping reinit.');
      return;
    }

    setCameraError(null);
    setUploadError(null);
    setCameraLoading(true);

    // 6. Permission Optimization
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as any });
        if (permissionStatus.state === 'denied') {
          setCameraError('Camera access is currently denied. Reset camera permissions in your browser bar or use "📸 Use Device Camera".');
          setCameraLoading(false);
          setHasCamera(false);
          return;
        }
      } catch (err) {
        console.debug('Navigator permissions query not supported for camera on this host:', err);
      }
    }

    try {
      // 9. Stream Reuse Optimization
      let stream = streamRef.current;
      const isStreamActive = stream && stream.active && stream.getVideoTracks().some(t => t.readyState === 'live');

      if (isStreamActive && stream) {
        console.log('Reusing existing valid media stream instance');
      } else {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('WebRTC camera streaming is not supported or is blocked in this context. Please use "📸 Use Device Camera"!');
        }

        // 1. Lower Initial Camera Resolution (1280x720 ideal)
        const constraints = {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // 3. Wait for Camera Readiness
        const video = videoRef.current;
        await new Promise<void>((resolve) => {
          const checkReady = () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              resolve();
            } else {
              requestAnimationFrame(checkReady);
            }
          };

          video.onloadedmetadata = () => {
            checkReady();
          };

          // Fallback if dimensions or metadata are already loaded
          if (video.readyState >= 1) {
            checkReady();
          }
        });
      }

      setCameraActive(true);
      setHasCamera(true);
    } catch (err: any) {
      console.warn('Camera initiation failed:', err);
      setHasCamera(false);
      setCameraActive(false);
      
      // 10. Improve Error Handling with User Friendly Messages
      let friendlyMessage = 'Could not start browser camera stream. Please try using "📸 Use Device Camera" or direct file upload.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        friendlyMessage = 'Camera access was denied. Please allow camera permissions in your browser or use "📸 Use Device Camera".';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        friendlyMessage = 'No compatible camera device was found. Please select "📸 Use Device Camera" or upload a file directly.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        friendlyMessage = 'Your camera is already in use by another tab or program. Close other programs and try again.';
      } else if (err.name === 'AbortError') {
        friendlyMessage = 'Camera acquisition was aborted mid-stream. Please refresh this page and try again.';
      } else if (err.name === 'OverconstrainedError') {
        friendlyMessage = 'The requested 720p HD resolution configuration is not supported by your camera hardware.';
      } else if (err.message) {
        friendlyMessage = err.message;
      }
      setCameraError(friendlyMessage);
    } finally {
      // 5. Turn off loading state
      setCameraLoading(false);
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
    setCameraLoading(false);
  };

  const executeOcrProc = async (base64ImageOrImages: string | string[], thumbUrlOrUrls: string | string[]) => {
    // Stop camera as OCR begins to release device camera locks
    stopCamera();

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

      // Keep camera active for instant subsequent captures (do not stopCamera here)

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

  const handleMobileCameraChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      {/* Attachment Method Tab Selector */}
      <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md mx-auto mb-8" id="attachment-method-tabs">
        <button
          type="button"
          onClick={() => setActiveTab('camera')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'camera'
              ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
          style={{ minHeight: 44 }}
          id="tab-camera-trigger"
        >
          <Camera className="w-4 h-4 text-blue-500" />
          <span>Capture with Camera</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-xs uppercase font-bold tracking-wider transition-all cursor-pointer ${
            activeTab === 'upload'
              ? 'bg-white text-slate-900 dark:bg-slate-800 dark:text-white shadow-xs border border-slate-200/60 dark:border-slate-700'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
          style={{ minHeight: 44 }}
          id="tab-upload-trigger"
        >
          <Upload className="w-4 h-4 text-emerald-500" />
          <span>Upload Saved Image</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto space-y-6" id="attachment-workflow-content">
        {activeTab === 'camera' ? (
          /* Camera capture element card - Native device camera exclusive */
          <div className="bg-white dark:bg-slate-950 border border-slate-205 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs flex flex-col min-h-[360px]" id="camera-viewport-card">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-blue-500" />
                <span>Workspace: {activeSide === 'front' ? 'Side A (Front)' : 'Side B (Back)'} side</span>
              </span>
            </div>

            <div className="flex-1 bg-slate-50/50 dark:bg-slate-950/25 flex flex-col items-center justify-center p-6 min-h-[300px]">
              {(activeSide === 'front' ? frontImage : backImage) ? (
                // Inspecting currently captured image side
                <div className="w-full h-full flex flex-col items-center justify-center max-w-lg mx-auto" id="captured-preview-container">
                  <div className="relative group rounded-xl overflow-hidden shadow-md">
                    <img
                      src={activeSide === 'front' ? (frontImage || '') : (backImage || '')}
                      alt={`Captured ${activeSide} side`}
                      className="w-full h-auto max-h-[220px] object-contain bg-slate-900 border border-slate-200 dark:border-slate-800"
                    />
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-md">
                      <Check className="w-4 h-4" />
                    </div>
                  </div>
                  
                  <div className="mt-5 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => mobileCameraInputRef.current?.click()}
                      className="font-bold text-xs tracking-wide uppercase px-5 py-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:hover:bg-blue-950/70 dark:text-blue-400 transition-all cursor-pointer flex items-center gap-2"
                      id="retake-photo-btn"
                    >
                      <Camera className="w-4 h-4" />
                      <span>Retake Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleClearSide(activeSide, e)}
                      className="font-bold text-xs tracking-wide uppercase px-5 py-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 dark:text-rose-450 border border-thin border-rose-100 dark:border-rose-955 transition-all cursor-pointer flex items-center gap-2"
                      id="clear-side-btn"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear Image</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Clickable Active Graphic Panel to Open Native Device Camera directly */
                <button
                  type="button"
                  onClick={() => mobileCameraInputRef.current?.click()}
                  className="w-full max-w-md mx-auto text-center p-8 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-2xl shadow-xs hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] group outline-none"
                  title="Click to open device camera app"
                  id="interactive-device-camera-button"
                >
                  <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center mb-4 border border-blue-100/50 dark:border-blue-900 group-hover:scale-105 group-hover:bg-blue-505 dark:group-hover:bg-blue-900 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all duration-300">
                    <Camera className="w-7 h-7" />
                  </div>
                  <h3 className="text-slate-800 dark:text-slate-200 font-semibold text-sm transition-colors group-hover:text-blue-600 dark:group-hover:text-blue-400">
                    Use Device Camera
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed max-w-xs">
                    Tap to launch your smartphone or tablet's native camera. Simply draft your photo, snap a picture, and return here.
                  </p>
                  
                  <div className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 group-hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm">
                    <Smartphone className="w-4 h-4" />
                    <span>Open Native Camera</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* File Picker Area and Error states in a pristine stack */
          <div className="space-y-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-10 text-center flex flex-col items-center justify-center min-h-[250px] cursor-pointer transition-all bg-white dark:bg-slate-950 ${
                dragActive
                  ? 'border-blue-500 bg-blue-50/10 dark:bg-blue-950/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-350 hover:bg-slate-50/40 dark:hover:bg-slate-950/20'
              }`}
              onClick={() => fileInputRef.current?.click()}
              id="upload-dropzone"
            >
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${
                dragActive
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                  : 'bg-slate-100 text-slate-500 dark:bg-slate-900'
              }`}>
                <Upload className="w-6 h-6" />
              </div>

              {((activeSide === 'front' ? frontImage : backImage)) ? (
                <div className="flex flex-col items-center">
                  <img
                    src={activeSide === 'front' ? (frontImage || '') : (backImage || '')}
                    alt={`Attached ${activeSide} side`}
                    className="w-auto max-h-[140px] object-contain rounded border border-slate-200 dark:border-slate-800 bg-slate-900 shadow-sm mb-4"
                  />
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                    ✓ Attached Side {activeSide === 'front' ? 'A (Front)' : 'B (Back)'}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="mt-3 text-xs text-blue-600 hover:underline font-bold"
                  >
                    Replace Image
                  </button>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-slate-850 dark:text-slate-200 text-sm">
                    {dragActive ? `Drop card ${activeSide} side` : `Browse Saved image for ${activeSide === 'front' ? 'Front' : 'Back'} side`}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
                    Drag &amp; drop a photo of your card's {activeSide === 'front' ? 'FRONT' : 'BACK'} side here, or click to browse files.
                  </p>
                  <p className="text-[10px] text-slate-450 uppercase tracking-widest mt-4">
                    Supports JPEG, PNG, or WebP
                  </p>
                </>
              )}
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
          </div>
        )}

        {/* Global Quick instructions guidelines panel */}
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

      {/* Persistent global inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        id="file-capture-picker"
      />
      <input
        type="file"
        ref={mobileCameraInputRef}
        onChange={handleMobileCameraChange}
        accept="image/*"
        capture="environment"
        className="hidden"
        id="mobile-camera-picker"
      />

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
