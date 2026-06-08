/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Tesseract from 'tesseract.js';
import { IOcrEngine } from './IOcrEngine';
import { OcrResult, OcrWord } from '../types';

export class LocalOcrEngine implements IOcrEngine {
  async processImage(
    imageBytesOrUrl: string | string[],
    onProgress?: (progress: number) => void
  ): Promise<OcrResult> {
    if (onProgress) {
      onProgress(5); // Initial loading starting indicator
    }

    const images = Array.isArray(imageBytesOrUrl) ? imageBytesOrUrl : [imageBytesOrUrl];
    const textParts: string[] = [];
    const allWords: OcrWord[] = [];
    let totalConfidence = 0;

    try {
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const result = (await Tesseract.recognize(
          img,
          'eng',
          {
            logger: (m) => {
              if (m.status === 'recognizing text' && onProgress) {
                // Scale recognizing text progress based on current image index
                const baseProgress = (i / images.length) * 100;
                const stepProgress = (m.progress * 100) / images.length;
                const val = Math.round(baseProgress + stepProgress);
                onProgress(Math.min(val, 99));
              } else if (onProgress && images.length === 1) {
                // Backwards compatible fallback progress
                onProgress(10);
              }
            }
          }
        )) as any;

        const { data: { text, confidence, words } } = result;
        if (text) {
          textParts.push(text);
        }
        if (confidence !== undefined) {
          totalConfidence += confidence;
        }

        // Map words bounding box coordinates safely
        const ocrWords: OcrWord[] = (words || []).map((w: any) => ({
          text: w.text,
          x0: w.bbox?.x0 ?? 0,
          y0: w.bbox?.y0 ?? 0,
          x1: w.bbox?.x1 ?? 0,
          y1: w.bbox?.y1 ?? 0,
        }));
        allWords.push(...ocrWords);
      }

      if (onProgress) {
        onProgress(100);
      }

      return {
        fullText: textParts.join('\n---\n'),
        confidenceScore: (images.length > 0 ? (totalConfidence / images.length) : 0) / 100, // Average and convert to 0-1
        words: allWords,
      };
    } catch (error) {
      console.error('Tesseract LocalOCR_Engine error:', error);
      throw new Error(
        error instanceof Error ? error.message : 'Local OCR processing failed.'
      );
    }
  }
}
