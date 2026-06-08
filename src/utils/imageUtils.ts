/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Validates whether the chosen upload is a supported image type and under the maximum size limit.
 */
export function validateImageFile(file: File): { isValid: boolean; reason?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      reason: 'Unsupported format. Please select a JPEG, PNG, or WebP business card photo.',
    };
  }

  // Max 20 MB limit as specified in the requirements
  const maxSizeInBytes = 20 * 1024 * 1024;
  if (file.size > maxSizeInBytes) {
    return {
      isValid: false,
      reason: `File size exceeds the 20 MB limit. (Your file: ${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
    };
  }

  return { isValid: true };
}

/**
 * Creates an image element and resizes it to generate a base64 thumbnail.
 */
export function generateThumbnailUrl(
  base64OrUrlSrc: string,
  maxWidth = 160,
  maxHeight = 120
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Handle scaling ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64OrUrlSrc); // Fallback to full src on rendering failures
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      } catch (e) {
        console.error('Failed to create thumbnail from canvas context:', e);
        resolve(base64OrUrlSrc); // Fallback on canvas security locks
      }
    };

    img.onerror = (err) => {
      console.error('Image element loading error during thumbnail generation:', err);
      // Fallback: resolve immediately with the original image representation
      resolve(base64OrUrlSrc);
    };

    img.src = base64OrUrlSrc;
  });
}
