/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Briefcase, Building, Phone, Mail, MapPin, Globe, Save, Download, 
  Trash2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, Edit, 
  ArrowLeft, Plus, X, ListCollapse, Loader2
} from 'lucide-react';
import { useCaptureStore } from '../stores/captureStore';
import { useReviewStore } from '../stores/reviewStore';
import { useContactListStore } from '../stores/contactListStore';
import { VcfGenerator } from '../utils/VcfGenerator';
import { db } from '../db';
import { ContactRecord, ConfidenceMap } from '../types';
import { useAuthStore } from '../stores/authStore';

interface ReviewScreenProps {
  onNavigate: (view: 'home' | 'capture' | 'review') => void;
  viewingSavedRecord?: ContactRecord | null; // Set when viewing from Home List
}

export function ReviewScreen({ onNavigate, viewingSavedRecord }: ReviewScreenProps) {
  const { activeSession, progress, updateSessionStatus } = useCaptureStore();
  const { 
    draft, setDraft, updateDraftField, updateDraftFieldArrayValue, 
    addDraftFieldArrayValue, removeDraftFieldArrayValue, validationErrors, 
    validateDraft, isSaving, setIsSaving 
  } = useReviewStore();
  
  const { addContact, deleteContact } = useContactListStore();

  const [isEditMode, setIsEditMode] = useState(!viewingSavedRecord);
  const [showRawText, setShowRawText] = useState(false);
  const [saveComplete, setSaveComplete] = useState(false);

  // If viewing a saved record, we construct a dummy temporary draft for viewing/editing
  useMemo(() => {
    if (viewingSavedRecord) {
      const parsedDraft = {
        fullName: viewingSavedRecord.fullName,
        title: viewingSavedRecord.title || '',
        company: viewingSavedRecord.company || '',
        phones: viewingSavedRecord.phones || [],
        emails: viewingSavedRecord.emails || [],
        addresses: viewingSavedRecord.addresses || [],
        websites: viewingSavedRecord.websites || [],
        businessDomain: viewingSavedRecord.businessDomain || 'Other',
        confidenceMap: {
          fullName: 1.0,
          title: 1.0,
          company: 1.0,
          phones: 1.0,
          emails: 1.0,
          addresses: 1.0,
          websites: 1.0,
          businessDomain: 1.0
        }
      };
      setDraft(parsedDraft);
    }
  }, [viewingSavedRecord, setDraft]);

  const session = useMemo(() => {
    if (viewingSavedRecord) {
      return {
        id: viewingSavedRecord.id,
        imageUrl: viewingSavedRecord.thumbnailUrl || '', // fallback
        status: 'saved' as const
      };
    }
    return activeSession;
  }, [viewingSavedRecord, activeSession]);

  if (!session && !draft) {
    return (
      <div className="text-center p-12 max-w-md mx-auto bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl mt-12 shadow-xs">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
        <h3 className="font-bold text-slate-800 dark:text-slate-200">No session loaded</h3>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          You need to capture or upload a business card photo from the scan screen to review extracted information.
        </p>
        <button
          onClick={() => onNavigate('capture')}
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 text-white font-bold text-xs uppercase cursor-pointer transition-all"
          style={{ minHeight: 44 }}
        >
          <ArrowLeft className="w-4 h-4" /> Go to Scan
        </button>
      </div>
    );
  }

  const isProcessing = session?.status === 'processing';
  const isFailed = session?.status === 'failed';

  // Handle saving the Contact Record
  const handleSaveContact = async () => {
    if (!draft) return;
    
    // Perform standard validations before saving
    const isValid = validateDraft();
    if (!isValid) return;

    setIsSaving(true);
    try {
      const contactId = viewingSavedRecord ? viewingSavedRecord.id : session!.id;
      const record: ContactRecord = {
        id: contactId,
        sessionId: viewingSavedRecord ? undefined : session!.id,
        userId: useAuthStore.getState().currentUser?.id || viewingSavedRecord?.userId,
        createdAt: viewingSavedRecord ? viewingSavedRecord.createdAt : Date.now(),
        fullName: draft.fullName.trim(),
        title: draft.title?.trim() || '',
        company: draft.company?.trim() || '',
        phones: draft.phones.map(p => p.trim()).filter(Boolean),
        emails: draft.emails.map(e => e.trim()).filter(Boolean),
        addresses: draft.addresses.map(a => a.trim()).filter(Boolean),
        websites: draft.websites.map(w => w.trim()).filter(Boolean),
        notes: viewingSavedRecord?.notes || '',
        thumbnailUrl: session?.thumbnailUrl || viewingSavedRecord?.thumbnailUrl,
        businessDomain: draft.businessDomain || 'Other'
      };

      // Put to Local Dexie DB
      await db.contactRecords.put(record);
      
      // If saving a new card scan, mark capture status as saved too
      if (!viewingSavedRecord && session) {
        await updateSessionStatus(session.id, 'saved');
      }

      // Synchronize in-memory list Store reactively without complete DB reads
      addContact(record);

      setSaveComplete(true);
      setTimeout(() => {
        setSaveComplete(false);
        onNavigate('home');
      }, 1500);

    } catch (e) {
      console.error('Failed to write ContactRecord into Dexie DB:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportVcf = () => {
    if (!draft) return;
    VcfGenerator.download(draft);
  };

  const handleDelete = async () => {
    const contactId = viewingSavedRecord ? viewingSavedRecord.id : session?.id;
    if (!contactId) return;

    if (window.confirm('Are you sure you want to permanently delete this contact?')) {
      await deleteContact(contactId);
      onNavigate('home');
    }
  };

  // Helper to color/configure confidence badges with non-color accessibility markers
  const renderConfidenceBadge = (score: number) => {
    if (score >= 0.9) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 dark:text-emerald-400 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-900/60" id="confidence-high-badge" title="High certainty">
          <CheckCircle className="w-3 h-3 text-emerald-500" />
          <span>High ({Math.round(score * 100)}%)</span>
        </span>
      );
    } else if (score >= 0.7) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/60" id="confidence-medium-badge" title="Medium certainty. We suggest checking this field.">
          <Info className="w-3 h-3 text-amber-500" />
          <span>Medium ({Math.round(score * 100)}%)</span>
        </span>
      );
    } else if (score > 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 px-2 py-0.5 rounded border border-rose-100 dark:border-rose-900/60" id="confidence-low-badge" title="Low certainty. Please examine and type correctly.">
          <AlertTriangle className="w-3 h-3 text-rose-500" />
          <span>Low ({Math.round(score * 100)}%)</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 dark:bg-slate-900/40 px-2 py-0.5 rounded border border-slate-150 dark:border-slate-800" id="confidence-miss-badge" title="Field was empty or undetected">
          <span>Unmatched (0%)</span>
        </span>
      );
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" id="review-screen-container">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(viewingSavedRecord ? 'home' : 'capture')}
            className="p-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
            style={{ width: 44, height: 44 }}
            aria-label="Go back"
            id="back-navigation-arrow"
          >
            <ArrowLeft className="w-5 h-5 mx-auto" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-850 dark:text-slate-100 tracking-tight" id="review-title">
              {viewingSavedRecord ? 'View Contact Card' : 'Review Extracted Contact'}
            </h1>
            <p className="text-xs text-slate-500">
              {viewingSavedRecord ? 'Stored profile card records' : 'Verify, edit, and export parameters derived from scan.'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:self-center" id="review-controls-section">
          {viewingSavedRecord && !isEditMode && (
            <button
              onClick={() => setIsEditMode(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold"
              style={{ minHeight: 44 }}
              id="edit-mode-toggle"
            >
              <Edit className="w-4 h-4" />
              <span>Modify Contact</span>
            </button>
          )}

          {(!isProcessing && !isFailed && draft) && (
            <>
              <button
                onClick={handleExportVcf}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs font-semibold cursor-pointer disabled:opacity-40"
                style={{ minHeight: 44 }}
                id="export-vcard-btn"
              >
                <Download className="w-4 h-4" />
                <span>Export vCard</span>
              </button>
              
              <button
                onClick={handleSaveContact}
                disabled={isSaving || !!validationErrors.fullName || saveComplete}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold shadow-xs cursor-pointer text-white disabled:opacity-40 select-none ${
                  saveComplete ? 'bg-emerald-600' : 'bg-slate-900 hover:bg-slate-800'
                }`}
                style={{ minHeight: 44 }}
                id="save-contact-btn"
              >
                <Save className="w-4 h-4" />
                <span>{saveComplete ? 'Captured!' : isSaving ? 'Saving...' : 'Save Member'}</span>
              </button>

              <button
                onClick={handleDelete}
                className="p-2.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 dark:border-red-950/60 dark:hover:bg-red-950/20"
                style={{ width: 44, height: 44 }}
                title="Delete Record"
                id="delete-contact-btn"
              >
                <Trash2 className="w-4 h-4 mx-auto" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Left Side (Desktop) / Top (Mobile) Column: Original Business Card and Word Box projection overlays */}
        <div className="md:col-span-4 flex flex-col gap-6" id="review-image-sidebar">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden p-4 shadow-xs" id="image-viewer-frame">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-450 mb-3 block">
              Captured image Card
            </h4>
            
            <div className="flex flex-col gap-4" id="review-image-canvas-container">
              {(() => {
                const imageUrls = Array.isArray(session?.imageUrl)
                  ? session.imageUrl
                  : session?.imageUrl
                    ? [session.imageUrl]
                    : [];

                if (imageUrls.length === 0) {
                  return (
                    <div className="bg-slate-950 rounded-lg overflow-hidden flex flex-col items-center justify-center p-8 text-slate-600 min-h-[160px] aspect-video border dark:border-slate-800">
                      <Building className="w-10 h-10 mb-2 stroke-1" />
                      <span className="text-xs">No image preview available</span>
                    </div>
                  );
                }

                return imageUrls.map((url, index) => (
                  <div
                    key={index}
                    className="relative rounded-lg overflow-hidden bg-slate-950 flex items-center justify-center min-h-[160px] aspect-video w-full border dark:border-slate-800 group"
                    id={`image-viewer-container-${index}`}
                  >
                    <span className="absolute top-2 left-2 z-10 bg-slate-900/80 backdrop-blur-xs text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                      {imageUrls.length > 1 ? (index === 0 ? 'Front Side' : 'Back Side') : 'Card Scan'}
                    </span>
                    <img
                      src={url}
                      alt={imageUrls.length > 1 ? (index === 0 ? 'Front Side Card' : 'Back Side Card') : 'Captured Business Card'}
                      className="w-full h-auto object-contain max-h-[350px] select-none"
                      id={`business-card-original-img-${index}`}
                    />
                    
                    {isProcessing && (
                      <div className="absolute inset-x-0 top-0 h-1 bg-blue-500 shadow-[0_0_10px_2px_rgba(59,130,246,0.8)] animate-[scan_2.3s_ease-in-out_infinite]" id="scanning-laser-guide" />
                    )}
                    
                    {/* Bounding Box coordinate visual annotations */}
                    {!isProcessing && !isFailed && index === 0 && session.ocrResult?.words && (
                      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300" id="word-overlay-canvas">
                        {session.ocrResult.words.map((w, i) => {
                          return (
                            <div
                              key={i}
                              className="absolute bg-blue-500/10 border border-blue-400/30 rounded-[1px] text-[1px] text-transparent select-none cursor-help hover:bg-blue-400/40 hover:border-blue-500"
                              style={{
                                left: `${w.x0}%`,
                                top: `${w.y0}%`,
                                width: `${w.x1 - w.x0}%`,
                                height: `${w.y1 - w.y0}%`,
                              }}
                              title={w.text}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ));
              })()}
            </div>
            
            {!isProcessing && !isFailed && session.ocrResult?.words && (
              <p className="text-[10px] text-slate-400 mt-2 text-center" id="overlay-caption">
                Hover card photo to view digital word placement overlays.
              </p>
            )}
          </div>

          {/* Real-time simulated digital business card preview (Benchmark Aesthetic) */}
          {!isProcessing && !isFailed && draft && (
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm relative overflow-hidden" id="digital-card-simulation">
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 dark:bg-slate-900 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
              <div className="text-[10px] font-bold text-slate-450 dark:text-slate-400 uppercase tracking-widest mb-4">MAPPED ENTITY PREVIEW</div>
              
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-slate-100 tracking-tight leading-tight">
                    {draft.fullName || 'No Name Provided'}
                  </h2>
                  {draft.title && (
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                      {draft.title}
                    </p>
                  )}
                  {draft.company && (
                    <p className="text-xs text-slate-400 mt-0.5 font-sans uppercase tracking-wider font-semibold">
                      {draft.company}
                    </p>
                  )}
                  {draft.businessDomain && (
                    <div className="mt-1">
                      <span className="inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-55 text-slate-700 dark:text-emerald-300 border border-slate-200 dark:border-slate-800">
                        {draft.businessDomain}
                      </span>
                    </div>
                  )}
                </div>

                {(draft.phones.length > 0 || draft.emails.length > 0 || draft.websites.length > 0) && (
                  <div className="border-t border-slate-100 dark:border-slate-900 pt-3 space-y-1.5 text-xs text-slate-500">
                    {draft.phones.map((phone, i) => phone && (
                      <div key={i} className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span className="truncate">{phone}</span>
                      </div>
                    ))}
                    {draft.emails.map((email, i) => email && (
                      <div key={i} className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                        <span className="truncate">{email}</span>
                      </div>
                    ))}
                    {draft.websites.map((web, i) => web && (
                      <div key={i} className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span className="truncate text-blue-600 dark:text-blue-400">{web}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Engine Status Tag */}
          {!isProcessing && !isFailed && (
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-xs flex flex-col gap-2 shadow-2xs" id="ocr-metadata-card">
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">OCR Engine Model:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200 capitalize">
                  {session.ocrEngineUsed === 'cloud' ? 'Cloud AI (Gemini)' : 'Local Tesseract Worker'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-medium">Match Certainty:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {session.ocrResult ? `${Math.round(session.ocrResult.confidenceScore * 100)}%` : '100%'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Form input section */}
        <div className="md:col-span-8 flex flex-col gap-6" id="review-parsed-form">
          <AnimatePresence mode="wait">
            
            {/* L1: Loading Skeletal View Panel (Requirement 4) */}
            {isProcessing && (
              <motion.div
                key="loading-skeleton"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col gap-6"
                id="review-loading-skeleton"
              >
                <div className="flex items-center gap-3 bg-blue-50/40 dark:bg-slate-900/40 p-4 rounded-xl border border-blue-100/50 dark:border-slate-800">
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                      OCR Engine Processing...
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Extracting context using {session.ocrEngineUsed === 'cloud' ? 'Gemini Pro vision API' : 'Tesseract.js client threads'} ({progress}% complete)
                    </p>
                  </div>
                </div>

                <div className="space-y-5 animate-pulse">
                  <div className="h-5 bg-slate-200 dark:bg-slate-900 rounded-md w-1/3" />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-10 bg-slate-100 dark:bg-slate-900 rounded-lg w-full" />
                    <div className="h-10 bg-slate-100 dark:bg-slate-900 rounded-lg w-full" />
                  </div>
                  <div className="h-4 bg-slate-200 dark:bg-slate-900 rounded-md w-1/4" />
                  <div className="h-10 bg-slate-100 dark:bg-slate-900 rounded-lg w-full" />
                  <div className="h-4 bg-slate-200 dark:bg-slate-900 rounded-md w-1/4" />
                  <div className="h-10 bg-slate-100 dark:bg-slate-900 rounded-lg w-full" />
                </div>
              </motion.div>
            )}

            {/* L2: Failed OCR processing layout */}
            {isFailed && (
              <motion.div
                key="failed-alert"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-rose-50 dark:bg-rose-950/10 border border-rose-200 rounded-2xl p-6 text-center max-w-lg mx-auto"
                id="ocr-failed-panel"
              >
                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                <h3 className="font-bold text-rose-800 dark:text-rose-400 text-sm">OCR Processing Failed</h3>
                <p className="text-xs text-rose-700/80 mt-2">
                  {session.errorMessage || 'We experienced an error mapping textual sequences from the card image.'}
                </p>
                <button
                  onClick={() => onNavigate('capture')}
                  className="mt-6 font-semibold text-xs tracking-wider uppercase px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all shadow-xs"
                  style={{ minHeight: 44 }}
                  id="retry-button"
                >
                  Return and Try Again
                </button>
              </motion.div>
            )}

            {/* L3: Primary Contact Review Form */}
            {!isProcessing && !isFailed && draft && (
              <motion.div
                key="review-form-content"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs"
                id="editable-form-panel"
              >
                <div className="p-4 bg-slate-50/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center rounded-t-xl">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Extracted Contact Fields
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  
                  {/* Single fields constraints (fullName, title, company) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Full Name field (Required) */}
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <div className="flex justify-between items-center mb-1">
                        <label htmlFor="form-full-name" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>Full Name</span>
                          <span className="text-red-500">*</span>
                        </label>
                        {renderConfidenceBadge(draft.confidenceMap.fullName)}
                      </div>
                      <input
                        id="form-full-name"
                        type="text"
                        disabled={!isEditMode || isSaving}
                        value={draft.fullName}
                        onChange={(e) => updateDraftField('fullName', e.target.value)}
                        className={`w-full px-3.5 py-2 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-blue-105 focus:border-blue-500 bg-white outline-none font-medium ${
                          validationErrors.fullName 
                            ? 'border-rose-500 bg-rose-50/10 focus:ring-rose-100 focus:border-rose-500 text-rose-900' 
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                        placeholder="John Doe"
                        required
                        aria-required="true"
                        aria-invalid={!!validationErrors.fullName}
                      />
                      {validationErrors.fullName && (
                        <span className="text-[11px] text-rose-500 mt-1 flex items-center gap-1 font-medium" id="fullName-validation-error">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{validationErrors.fullName}</span>
                        </span>
                      )}
                    </div>

                    {/* Title professional roll */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center mb-1">
                        <label htmlFor="form-job-title" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span>Job/Corporate Title</span>
                        </label>
                        {renderConfidenceBadge(draft.confidenceMap.title)}
                      </div>
                      <input
                        id="form-job-title"
                        type="text"
                        disabled={!isEditMode || isSaving}
                        value={draft.title}
                        onChange={(e) => updateDraftField('title', e.target.value)}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm transition-all focus:ring-2 focus:ring-blue-105 focus:border-blue-500 bg-white outline-none"
                        placeholder="Lead Architect / MD"
                      />
                    </div>

                    {/* Corporate company names */}
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center mb-1">
                        <label htmlFor="form-company" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>Company / Organization</span>
                        </label>
                        {renderConfidenceBadge(draft.confidenceMap.company)}
                      </div>
                      <input
                        id="form-company"
                        type="text"
                        disabled={!isEditMode || isSaving}
                        value={draft.company}
                        onChange={(e) => updateDraftField('company', e.target.value)}
                        className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm transition-all focus:ring-2 focus:ring-blue-105 focus:border-blue-500 bg-white outline-none"
                        placeholder="Acme Corp"
                      />
                    </div>

                    {/* Business Domain / Industry */}
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <div className="flex justify-between items-center mb-1">
                        <label htmlFor="form-domain-select" className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          <span>Business Domain / Industry</span>
                        </label>
                        {renderConfidenceBadge(draft.confidenceMap.businessDomain || 0)}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <select
                          id="form-domain-select"
                          disabled={!isEditMode || isSaving}
                          value={
                            ['Technology', 'Healthcare', 'Finance', 'Education', 'Food & Dining', 'Real Estate', 'Consulting', 'Legal', 'Media & Design', 'Logistics', 'Manufacturing'].includes(draft.businessDomain || 'Other')
                              ? (draft.businessDomain || 'Other')
                              : 'Other'
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            updateDraftField('businessDomain', val);
                          }}
                          className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm transition-all focus:ring-2 focus:ring-blue-105 focus:border-blue-500 bg-white outline-none cursor-pointer dark:bg-slate-900"
                        >
                          <option value="Technology">Technology</option>
                          <option value="Healthcare">Healthcare</option>
                          <option value="Finance">Finance</option>
                          <option value="Education">Education</option>
                          <option value="Food & Dining">Food & Dining</option>
                          <option value="Real Estate">Real Estate</option>
                          <option value="Consulting">Consulting</option>
                          <option value="Legal">Legal</option>
                          <option value="Media & Design">Media & Design</option>
                          <option value="Logistics">Logistics</option>
                          <option value="Manufacturing">Manufacturing</option>
                          <option value="Other">Other (Custom)</option>
                        </select>

                        {/* Custom text writing input if Custom 'Other' option selected */}
                        {(!['Technology', 'Healthcare', 'Finance', 'Education', 'Food & Dining', 'Real Estate', 'Consulting', 'Legal', 'Media & Design', 'Logistics', 'Manufacturing'].includes(draft.businessDomain || '') || draft.businessDomain === 'Other') && (
                          <input
                            id="form-domain-custom"
                            type="text"
                            disabled={!isEditMode || isSaving}
                            value={draft.businessDomain === 'Other' ? '' : (draft.businessDomain || '')}
                            onChange={(e) => updateDraftField('businessDomain', e.target.value)}
                            className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm transition-all focus:ring-2 focus:ring-blue-105 focus:border-blue-500 bg-white outline-none"
                            placeholder="Enter Custom Sector (e.g. Energy)"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dynamic arrays of items: Phones list */}
                  <div className="space-y-3 pt-2" id="phones-group">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5" />
                        <span>Phone Numbers</span>
                      </h5>
                      {renderConfidenceBadge(draft.confidenceMap.phones)}
                    </div>
                    
                    {draft.phones.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No phone numbers detected.</p>
                    )}

                    <div className="space-y-3" id="phones-element-list">
                      {draft.phones.map((phone, idx) => {
                        const hasErr = validationErrors.phones?.[idx];
                        return (
                          <div key={idx} className="flex flex-col gap-1" id={`phone-item-wrap-${idx}`}>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                disabled={!isEditMode || isSaving}
                                value={phone}
                                onChange={(e) => updateDraftFieldArrayValue('phones', idx, e.target.value)}
                                className={`flex-1 px-3.5 py-2 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-blue-105 focus:border-blue-500 bg-white outline-none ${
                                  hasErr ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200 dark:border-slate-800'
                                }`}
                                placeholder="+1 (555) 012-3456"
                                aria-label={`Phone index ${idx}`}
                                id={`phone-input-${idx}`}
                              />
                              {isEditMode && (
                                <button
                                  type="button"
                                  onClick={() => removeDraftFieldArrayValue('phones', idx)}
                                  className="p-2.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-500 hover:border-red-200 dark:border-red-950/40 dark:hover:bg-red-950/20 transition-colors"
                                  style={{ width: 44, height: 44 }}
                                  title="Remove phone"
                                  id={`phone-remove-btn-${idx}`}
                                >
                                  <X className="w-4 h-4 mx-auto" />
                                </button>
                              )}
                            </div>
                            {hasErr && (
                              <span className="text-[10px] text-rose-500 mt-1 font-medium select-none">
                                {hasErr}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => addDraftFieldArrayValue('phones')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-dashed rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-slate-50 border-slate-200 dark:border-slate-800 dark:hover:bg-slate-900 transition-colors"
                        style={{ minHeight: 44 }}
                        id="add-phone-field"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Number</span>
                      </button>
                    )}
                  </div>

                  {/* Dynamic array: Emails */}
                  <div className="space-y-3 border-t border-slate-200 dark:border-slate-805 pt-4" id="emails-group">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        <span>Email Addresses</span>
                      </h5>
                      {renderConfidenceBadge(draft.confidenceMap.emails)}
                    </div>
                    
                    {draft.emails.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No email addresses detected.</p>
                    )}

                    <div className="space-y-3" id="emails-element-list">
                      {draft.emails.map((email, idx) => {
                        const hasErr = validationErrors.emails?.[idx];
                        return (
                          <div key={idx} className="flex flex-col gap-1" id={`email-item-wrap-${idx}`}>
                            <div className="flex items-center gap-2">
                              <input
                                type="email"
                                disabled={!isEditMode || isSaving}
                                value={email}
                                onChange={(e) => updateDraftFieldArrayValue('emails', idx, e.target.value)}
                                className={`flex-1 px-3.5 py-2 rounded-lg border text-sm transition-all focus:ring-2 focus:ring-blue-105 focus:border-blue-500 bg-white outline-none ${
                                  hasErr ? 'border-rose-500 bg-rose-50/10 focus:border-rose-500' : 'border-slate-200 dark:border-slate-800'
                                }`}
                                placeholder="name@company.com"
                                aria-label={`Email index ${idx}`}
                                id={`email-input-${idx}`}
                              />
                              {isEditMode && (
                                <button
                                  type="button"
                                  onClick={() => removeDraftFieldArrayValue('emails', idx)}
                                  className="p-2.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-500 hover:border-red-200 dark:border-red-950/40 dark:hover:bg-red-950/20 transition-colors"
                                  style={{ width: 44, height: 44 }}
                                  title="Remove email"
                                  id={`email-remove-btn-${idx}`}
                                >
                                  <X className="w-4 h-4 mx-auto" />
                                </button>
                              )}
                            </div>
                            {hasErr && (
                              <span className="text-[10px] text-rose-500 mt-1 font-medium select-none">
                                {hasErr}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => addDraftFieldArrayValue('emails')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-dashed rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-slate-50 border-slate-200 dark:border-slate-800 dark:hover:bg-slate-900 transition-colors"
                        style={{ minHeight: 44 }}
                        id="add-email-field"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Email</span>
                      </button>
                    )}
                  </div>

                  {/* Addresses physical locations */}
                  <div className="space-y-3 border-t border-slate-200 dark:border-slate-805 pt-4" id="addresses-group">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Physical Addresses</span>
                      </h5>
                      {renderConfidenceBadge(draft.confidenceMap.addresses)}
                    </div>
                    
                    {draft.addresses.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No addresses detected.</p>
                    )}

                    <div className="space-y-3" id="addresses-element-list">
                      {draft.addresses.map((addr, idx) => (
                        <div key={idx} className="flex items-center gap-2" id={`addr-item-wrap-${idx}`}>
                          <input
                            type="text"
                            disabled={!isEditMode || isSaving}
                            value={addr}
                            onChange={(e) => updateDraftFieldArrayValue('addresses', idx, e.target.value)}
                            className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm focus:ring-2 focus:ring-blue-105 focus:border-blue-500 bg-white outline-none"
                            placeholder="123 Main St, Suite 100"
                            aria-label={`Address index ${idx}`}
                            id={`address-input-${idx}`}
                          />
                          {isEditMode && (
                            <button
                              type="button"
                              onClick={() => removeDraftFieldArrayValue('addresses', idx)}
                              className="p-2.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-500 hover:border-red-200 dark:border-red-950/40 dark:hover:bg-red-950/20 transition-colors"
                              style={{ width: 44, height: 44 }}
                              title="Remove address"
                              id={`address-remove-btn-${idx}`}
                            >
                              <X className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => addDraftFieldArrayValue('addresses')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-dashed rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-slate-50 border-slate-200 dark:border-slate-800 dark:hover:bg-slate-900 transition-colors"
                        style={{ minHeight: 44 }}
                        id="add-address-field"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Address</span>
                      </button>
                    )}
                  </div>

                  {/* Websites profile URIs */}
                  <div className="space-y-3 border-t border-slate-200 dark:border-slate-805 pt-4 mb-4" id="websites-group">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-1">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5" />
                        <span>Websites / URLs</span>
                      </h5>
                      {renderConfidenceBadge(draft.confidenceMap.websites)}
                    </div>
                    
                    {draft.websites.length === 0 && (
                      <p className="text-xs text-slate-400 italic">No websites detected.</p>
                    )}

                    <div className="space-y-3" id="websites-element-list">
                      {draft.websites.map((url, idx) => (
                        <div key={idx} className="flex items-center gap-2" id={`web-item-wrap-${idx}`}>
                          <input
                            type="text"
                            disabled={!isEditMode || isSaving}
                            value={url}
                            onChange={(e) => updateDraftFieldArrayValue('websites', idx, e.target.value)}
                            className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-800 text-sm focus:ring-2 focus:ring-blue-105 focus:border-blue-500 bg-white outline-none"
                            placeholder="www.company.com"
                            aria-label={`Website index ${idx}`}
                            id={`website-input-${idx}`}
                          />
                          {isEditMode && (
                            <button
                              type="button"
                              onClick={() => removeDraftFieldArrayValue('websites', idx)}
                              className="p-2.5 rounded-lg border border-red-100 hover:bg-red-50 text-red-500 hover:border-red-200 dark:border-red-950/40 dark:hover:bg-red-950/20 transition-colors"
                              style={{ width: 44, height: 44 }}
                              title="Remove website"
                              id={`website-remove-btn-${idx}`}
                            >
                              <X className="w-4 h-4 mx-auto" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => addDraftFieldArrayValue('websites')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-dashed rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-slate-50 border-slate-200 dark:border-slate-800 dark:hover:bg-slate-900 transition-colors"
                        style={{ minHeight: 44 }}
                        id="add-website-field"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Website</span>
                      </button>
                    )}
                  </div>

                  {/* Collapsible Section showing Raw Extracted Text (Requirement 5.8) */}
                  {session.ocrResult?.fullText && (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden mt-6 bg-slate-50/40 dark:bg-slate-950/10" id="raw-ocr-collapse-section">
                      <button
                        type="button"
                        onClick={() => setShowRawText(!showRawText)}
                        className="w-full flex justify-between items-center px-4 py-3 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 select-none border-none cursor-pointer outline-none"
                        style={{ minHeight: 44 }}
                        id="raw-text-toggle-btn"
                      >
                        <span className="flex items-center gap-1.5">
                          <ListCollapse className="w-4 h-4" />
                          <span>Show Extracted Raw OCR Text</span>
                        </span>
                        {showRawText ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      
                      <AnimatePresence>
                        {showRawText && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t dark:border-slate-800"
                            id="raw-ocr-text-body"
                          >
                            <pre className="p-4 text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-100/50 dark:bg-slate-950/60 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[140px]" id="raw-ocr-text-content">
                              {session.ocrResult.fullText}
                            </pre>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                </div>
              </motion.div>
            )}
            
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
export default ReviewScreen;
