/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Generates a SHA-256 hash signature of a plain-text password string.
 * This utilizes the browser's standard Web Crypto API.
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    
    // Convert Buffer to hexadecimal string representation
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  } catch (error) {
    console.error('Cryptographic hashing error on current device, falling back to basic encoding:', error);
    // Fallback if environment doesn't support Web Cryptography (e.g. legacy/insecure sandboxes)
    return btoa(password);
  }
}
