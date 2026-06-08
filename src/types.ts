/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserAccount {
  id: string; // Typically the lowercase username
  username: string; // Unique username (UserId)
  passwordHash: string; // Password stored securely
  fullName: string;
  createdAt: number;
}

export type CaptureSessionStatus = 'processing' | 'complete' | 'failed' | 'saved';

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrResult {
  fullText: string;
  confidenceScore: number; // Overall confidence 0-1
  words: OcrWord[];
  parsedContact?: ParsedContact; // Optional pre-parsed structured contact for Cloud OCR
}

export interface ConfidenceMap {
  fullName: number;
  title: number;
  company: number;
  phones: number;
  emails: number;
  addresses: number;
  websites: number;
  businessDomain: number;
}

export interface ParsedContact {
  fullName: string;
  title: string;
  company: string;
  phones: string[];
  emails: string[];
  addresses: string[];
  websites: string[];
  businessDomain?: string;
  confidenceMap: ConfidenceMap;
}

export interface CaptureSession {
  id: string; // Unique ID (UUID or Timestamp-based)
  createdAt: number; // Timestamp
  userId?: string; // User ownership association
  imageUrl: string | string[]; // Loaded image(s) (either original or high-res base64)
  thumbnailUrl: string | string[]; // Data URL thumbnail(s)
  status: CaptureSessionStatus;
  errorMessage?: string;
  ocrEngineUsed?: 'local' | 'cloud';
  ocrResult?: OcrResult;
  parsedContact?: ParsedContact;
}

export interface ContactRecord {
  id: string; // Matches or is linked to CaptureSession.id
  sessionId?: string;
  userId?: string; // User ownership association
  createdAt: number;
  fullName: string;
  title: string;
  company: string;
  phones: string[];
  emails: string[];
  addresses: string[];
  websites: string[];
  notes?: string;
  thumbnailUrl?: string; // Captured card thumbnail URL if available
  businessDomain?: string;
}
