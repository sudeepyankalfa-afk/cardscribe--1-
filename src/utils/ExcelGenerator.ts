/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ContactRecord } from '../types';

export class ExcelGenerator {
  /**
   * Escapes a string field for safe CSV output in Excel.
   * If the text contains double quotes, commas, or newlines, it must be enclosed in double quotes,
   * and any inner double quotes must be doubled up ("").
   */
  private static escapeCsvField(field: string | null | undefined): string {
    if (field === null || field === undefined) {
      return '""';
    }
    const text = String(field).trim();
    // Double up any existing double quotes
    const escaped = text.replace(/"/g, '""');
    // Always wrap in quotes to be safe and compatible with Excel
    return `"${escaped}"`;
  }

  /**
   * Formats an array of fields into a single combined cell.
   * Uses newline characters to space them out within the Excel cell.
   */
  private static formatArrayField(arr: string[] | null | undefined): string {
    if (!arr || arr.length === 0) {
      return '""';
    }
    const combined = arr.filter(Boolean).join('\n');
    return this.escapeCsvField(combined);
  }

  /**
   * Converts contact records list into a CSV string with a Byte Order Mark (BOM) to ensure
   * Microsoft Excel opens it correctly with UTF-8 character encoding support.
   */
  static generateCsv(contacts: ContactRecord[]): string {
    const headers = [
      'Full Name',
      'Job/Corporate Title',
      'Company/Organization',
      'Business Domain/Industry',
      'Phone Number(s)',
      'Email Address(es)',
      'Physical Address(es)',
      'Website(s)/URL(s)',
      'Scanned Date',
      'Notes'
    ];

    const csvRows: string[] = [];

    // Header row
    csvRows.push(headers.map(h => this.escapeCsvField(h)).join(','));

    // Data rows
    contacts.forEach((contact) => {
      const formattedDate = new Date(contact.createdAt).toLocaleString();
      
      const row = [
        this.escapeCsvField(contact.fullName),
        this.escapeCsvField(contact.title),
        this.escapeCsvField(contact.company),
        this.escapeCsvField(contact.businessDomain || 'Other'),
        this.formatArrayField(contact.phones),
        this.formatArrayField(contact.emails),
        this.formatArrayField(contact.addresses),
        this.formatArrayField(contact.websites),
        this.escapeCsvField(formattedDate),
        this.escapeCsvField(contact.notes || '')
      ];

      csvRows.push(row.join(','));
    });

    // Excel-friendly UTF-8 BOM
    const BOM = '\uFEFF';
    return BOM + csvRows.join('\r\n');
  }

  /**
   * Triggers a download of the compiled contacts directory as an Excel-compatible spreadsheet file.
   */
  static download(contacts: ContactRecord[], customFilename?: string): void {
    if (contacts.length === 0) return;

    const csvContent = this.generateCsv(contacts);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = customFilename || `CardScribe_Contacts_${dateStr}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.setAttribute('id', `excel-download-trigger-${Date.now()}`);

    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
export default ExcelGenerator;
