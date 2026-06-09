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

        // Get image dimensions to scale coordinates to percentages (0-100)
        const dims = await getImageDimensions(img);
        const imgWidth = dims.width || 1;
        const imgHeight = dims.height || 1;

        // Map words bounding box coordinates safely as percentages (0-100)
        const ocrWords: OcrWord[] = (words || []).map((w: any) => ({
          text: w.text,
          x0: w.bbox ? (w.bbox.x0 / imgWidth) * 100 : 0,
          y0: w.bbox ? (w.bbox.y0 / imgHeight) * 100 : 0,
          x1: w.bbox ? (w.bbox.x1 / imgWidth) * 100 : 0,
          y1: w.bbox ? (w.bbox.y1 / imgHeight) * 100 : 0,
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

function getImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
    };
    img.src = src;
  });
}
