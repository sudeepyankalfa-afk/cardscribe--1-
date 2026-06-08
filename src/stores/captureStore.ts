/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { CaptureSession, CaptureSessionStatus, OcrResult, ParsedContact } from '../types';
import { db } from '../db';

interface CaptureState {
  activeSession: CaptureSession | null;
  progress: number; // 0 to 100 for visual feedback
  startSession: (session: CaptureSession) => Promise<void>;
  updateSessionStatus: (
    sessionId: string,
    status: CaptureSessionStatus,
    updates?: Partial<Omit<CaptureSession, 'id' | 'createdAt'>>
  ) => Promise<void>;
  setProcessingProgress: (progress: number) => void;
  clearSession: () => void;
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  activeSession: null,
  progress: 0,

  startSession: async (session) => {
    // Save to IndexedDB
    try {
      await db.captureSessions.put(session);
    } catch (e) {
      console.error('Error persisting capture session startup to IndexedDB:', e);
    }
    set({ activeSession: session, progress: 0 });
  },

  updateSessionStatus: async (sessionId, status, updates = {}) => {
    const current = get().activeSession;
    if (!current || current.id !== sessionId) return;

    const updatedSession: CaptureSession = {
      ...current,
      ...updates,
      status,
    };

    try {
      await db.captureSessions.put(updatedSession);
    } catch (e) {
      console.error('Error saving updated capture session in IndexedDB:', e);
    }

    set({ activeSession: updatedSession });
  },

  setProcessingProgress: (progress) => {
    set({ progress: Math.min(100, Math.max(0, progress)) });
  },

  clearSession: () => {
    set({ activeSession: null, progress: 0 });
  },
}));
