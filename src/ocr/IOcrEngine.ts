/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OcrResult } from '../types';

export interface IOcrEngine {
  /**
   * Process a captured or uploaded business card image.
   * @param imageBytesOrUrl The base64 data URL or representation of the image.
   * @param onProgress Callback function reporting OCR progress from 0 to 100.
   */
  processImage(
    imageBytesOrUrl: string | string[],
    onProgress?: (progress: number) => void
  ): Promise<OcrResult>;
}
