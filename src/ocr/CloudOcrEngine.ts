/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IOcrEngine } from './IOcrEngine';
import { OcrResult, ParsedContact } from '../types';

export class CloudOcrEngine implements IOcrEngine {
  async processImage(
    imageBytesOrUrl: string | string[],
    onProgress?: (progress: number) => void
  ): Promise<OcrResult> {
    if (onProgress) {
      onProgress(15);
    }

    try {
      if (onProgress) {
        onProgress(35);
      }

      const isArray = Array.isArray(imageBytesOrUrl);
      const requestBody = isArray
        ? { images: imageBytesOrUrl }
        : { image: imageBytesOrUrl };

      const response = await fetch('/api/ocr/cloud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (onProgress) {
        onProgress(70);
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with ${response.status}`);
      }

      const data = await response.json();

      if (onProgress) {
        onProgress(95);
      }

      // Reconstruct ParsedContact and confidenceMap from Gemini JSON
      const parsedContact: ParsedContact = {
        fullName: data.fullName || '',
        title: data.title || '',
        company: data.company || '',
        phones: data.phones || [],
        emails: data.emails || [],
        addresses: data.addresses || [],
        websites: data.websites || [],
        businessDomain: data.businessDomain || 'Other',
        detectedLanguages: data.detectedLanguages || [],
        addressComponents: data.addressComponents || [],
        confidenceMap: {
          fullName: data.confidenceMap?.fullName ?? 0.8,
          title: data.confidenceMap?.title ?? 0.8,
          company: data.confidenceMap?.company ?? 0.8,
          phones: data.confidenceMap?.phones ?? 0.8,
          emails: data.confidenceMap?.emails ?? 0.8,
          addresses: data.confidenceMap?.addresses ?? 0.8,
          websites: data.confidenceMap?.websites ?? 0.8,
          businessDomain: data.confidenceMap?.businessDomain ?? 0.8,
        },
      };

      if (onProgress) {
        onProgress(100);
      }

      return {
        fullText: data.rawText || '',
        confidenceScore: data.confidenceMap?.fullName ?? 0.8,
        words: data.words || [],
        parsedContact,
      };
    } catch (error: any) {
      console.error('CloudOcrEngine error:', error);
      throw new Error(error.message || 'Cloud OCR connection failed. Please ensure you are online and try again.');
    }
  }
}
