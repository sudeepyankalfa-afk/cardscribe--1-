/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContactRecord, ParsedContact } from '../types';

export class VcfGenerator {
  /**
   * Escapes text for compliance with the vCard 3.0 spec.
   * Backslashes, semi-colons, commas, and newlines must be backslash-escaped.
   */
  private static escapeText(text: string): string {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n')
      .trim();
  }

  /**
   * Converts a ContactRecord or ParsedContact into a valid vCard 3.0 text string.
   */
  static generate(contact: ContactRecord | Omit<ParsedContact, 'confidenceMap'>): string {
    const vcardLines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

    const fullName = contact.fullName || '';
    
    // Add FN (Formatted Name)
    vcardLines.push(`FN:${this.escapeText(fullName)}`);

    // Add N (Structured Name: Family Name; Given Name; Additional Names; Honorific Prefixes; Honorific Suffixes)
    const nameParts = fullName.trim().split(/\s+/);
    if (nameParts.length > 1) {
      const lastName = nameParts[nameParts.length - 1];
      const firstName = nameParts.slice(0, nameParts.length - 1).join(' ');
      vcardLines.push(`N:${this.escapeText(lastName)};${this.escapeText(firstName)};;;`);
    } else {
      vcardLines.push(`N:${this.escapeText(fullName)};;;;;`);
    }

    // Add TITLE
    if (contact.title) {
      vcardLines.push(`TITLE:${this.escapeText(contact.title)}`);
    }

    // Add ORG (Company/Organization)
    if (contact.company) {
      vcardLines.push(`ORG:${this.escapeText(contact.company)}`);
    }

    // Add TEL (Phones)
    if (contact.phones && contact.phones.length > 0) {
      contact.phones.forEach((phone, idx) => {
        if (!phone) return;
        const type = idx === 0 ? 'CELL,VOICE,PREF' : 'WORK,VOICE';
        vcardLines.push(`TEL;TYPE=${type}:${this.escapeText(phone)}`);
      });
    }

    // Add EMAIL
    if (contact.emails && contact.emails.length > 0) {
      contact.emails.forEach((email, idx) => {
        if (!email) return;
        const type = idx === 0 ? 'INTERNET,PREF' : 'INTERNET';
        vcardLines.push(`EMAIL;TYPE=${type}:${this.escapeText(email)}`);
      });
    }

    // Add ADR (Addresses)
    // Structure: post office box; extended address; street address; locality; region; postal code; country name
    if (contact.addresses && contact.addresses.length > 0) {
      contact.addresses.forEach((addr) => {
        if (!addr) return;
        vcardLines.push(`ADR;TYPE=WORK:;;${this.escapeText(addr)};;;;`);
      });
    }

    // Add URL (Websites)
    if (contact.websites && contact.websites.length > 0) {
      contact.websites.forEach((url) => {
        if (!url) return;
        // Prefix with http protocol if missing for general web-readers
        let formattedUrl = url;
        if (!/^https?:\/\//i.test(url)) {
          formattedUrl = `http://${url}`;
        }
        vcardLines.push(`URL:${this.escapeText(formattedUrl)}`);
      });
    }

    vcardLines.push('END:VCARD');
    return vcardLines.join('\r\n'); // vCard standard dictates \r\n linebreaks
  }

  /**
   * Generates a vCard and initiates a client-side file download.
   */
  static download(contact: ContactRecord | Omit<ParsedContact, 'confidenceMap'>): void {
    const vcardText = this.generate(contact);
    const blob = new Blob([vcardText], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const safeName = (contact.fullName || 'Contact')
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '_') // sanitize filename characters
      .replace(/_+/g, '_');
      
    const filename = `${safeName}.vcf`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.setAttribute('id', `vcard-download-trigger-${Date.now()}`);
    
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
export default VcfGenerator;
