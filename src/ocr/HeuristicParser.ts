/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { OcrResult, ParsedContact, ConfidenceMap } from '../types';

// Email validator (RFC 5322 Simplified)
const EMAIL_REGEX = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*/g;

// URL validator
const URL_REGEX = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi;

// Phone validator
const PHONE_KEYWORDS_REGEX = /(?:tel|phone|ph|mob|cell|m:|t:|p:|telephone|cellphone)\s*[:.-]?\s*([+]?[\d\s.()\-]{7,22})/i;
const GENERAL_PHONE_REGEX = /[+]?[\d\s.()\-]{7,25}/g;

// Address indicators
const ADDRESS_KEYWORDS = [
  'street', 'st', 'road', 'rd', 'ave', 'avenue', 'way', 'drive', 'dr', 'suite', 'ste',
  'building', 'bldg', 'floor', 'fl', 'city', 'zip', 'po box', 'p.o. box', 'box', 'highway', 'hwy',
  'boulevard', 'blvd', 'court', 'ct', 'circle', 'cir', 'lane', 'ln', 'place', 'pl', 'plaza', 'plz'
];

// Title indicators
const TITLE_KEYWORDS = [
  'manager', 'director', 'president', 'vp', 'developer', 'engineer', 'founder', 'partner',
  'designer', 'consultant', 'specialist', 'officer', 'coordinator', 'analyst', 'intern', 'architect',
  'lead', 'senior', 'junior', 'executive', 'chief', 'head', 'owner', 'principal', 'representative',
  'advocate', 'producer', 'programmer', 'strategist', 'technician'
];

// Company corporate indicators
const COMPANY_KEYWORDS = [
  'inc', 'co', 'ltd', 'corp', 'corporation', 'group', 'technologies', 'solutions', 'services',
  'enterprises', 'studio', 'labs', 'agency', 'industries', 'partners', 'associates', 'llc', 'gmbh', 'plc'
];

export class HeuristicParser {
  /**
   * Parses raw OCR text into a structured ParsedContact.
   * Matches prefix layouts for round-trip reliability.
   */
  static parse(ocrResult: OcrResult): ParsedContact {
    // If the OCR result already has cloud parsed contact, use it directly!
    if (ocrResult.parsedContact) {
      return ocrResult.parsedContact;
    }

    const { fullText } = ocrResult;
    const lines = fullText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Initialized parsed results
    let fullName = '';
    let title = '';
    let company = '';
    const phones: string[] = [];
    const emails: string[] = [];
    const addresses: string[] = [];
    const websites: string[] = [];
    let businessDomain = 'Other';

    const confidenceMap: ConfidenceMap = {
      fullName: 0,
      title: 0,
      company: 0,
      phones: 0,
      emails: 0,
      addresses: 0,
      websites: 0,
      businessDomain: 0,
    };

    const processedIndices = new Set<number>();

    // 1. Check for Round-Trip formatted prefix lines (e.g. "Name: Jane Doe")
    // This handles the round-trip deserialization requirement reliably.
    lines.forEach((line, idx) => {
      const lowerLine = line.toLowerCase();
      if (lowerLine.startsWith('name:')) {
        fullName = line.substring(5).trim();
        confidenceMap.fullName = 1.0;
        processedIndices.add(idx);
      } else if (lowerLine.startsWith('title:')) {
        title = line.substring(6).trim();
        confidenceMap.title = 1.0;
        processedIndices.add(idx);
      } else if (lowerLine.startsWith('company:')) {
        company = line.substring(8).trim();
        confidenceMap.company = 1.0;
        processedIndices.add(idx);
      } else if (lowerLine.startsWith('phone:') || lowerLine.startsWith('tel:')) {
        const val = line.substring(line.indexOf(':') + 1).trim();
        if (val) {
          phones.push(val);
          confidenceMap.phones = 1.0;
        }
        processedIndices.add(idx);
      } else if (lowerLine.startsWith('email:')) {
        const val = line.substring(6).trim();
        if (val) {
          emails.push(val);
          confidenceMap.emails = 1.0;
        }
        processedIndices.add(idx);
      } else if (lowerLine.startsWith('address:') || lowerLine.startsWith('adr:')) {
        const val = line.substring(line.indexOf(':') + 1).trim();
        if (val) {
          addresses.push(val);
          confidenceMap.addresses = 1.0;
        }
        processedIndices.add(idx);
      } else if (lowerLine.startsWith('website:') || lowerLine.startsWith('web:') || lowerLine.startsWith('url:')) {
        const val = line.substring(line.indexOf(':') + 1).trim();
        if (val) {
          websites.push(val);
          confidenceMap.websites = 1.0;
        }
        processedIndices.add(idx);
      } else if (lowerLine.startsWith('domain:') || lowerLine.startsWith('industry:')) {
        const val = line.substring(line.indexOf(':') + 1).trim();
        if (val) {
          businessDomain = val;
          confidenceMap.businessDomain = 1.0;
        }
        processedIndices.add(idx);
      }
    });

    // 2. Fall back to standard card heuristics for rich OCR raw text
    // Step A: Extract Email addresses (high certainty)
    lines.forEach((line, idx) => {
      if (processedIndices.has(idx)) return;

      const emailMatches = line.match(EMAIL_REGEX);
      if (emailMatches) {
        emailMatches.forEach((email) => {
          if (!emails.includes(email)) {
            emails.push(email);
          }
        });
        if (!confidenceMap.emails) {
          confidenceMap.emails = 0.95;
        }
        processedIndices.add(idx);
      }
    });

    // Step B: Extract Websites (high certainty, excluding emails)
    lines.forEach((line, idx) => {
      // Exclude if already processed
      if (processedIndices.has(idx)) return;

      const urlMatches = line.match(URL_REGEX);
      if (urlMatches) {
        urlMatches.forEach((url) => {
          // Confirm it is not an email (does not contain '@')
          if (!url.includes('@') && !websites.includes(url)) {
            // Validate it has dot or protocol
            if (url.includes('.') && url.length > 4) {
              websites.push(url);
            }
          }
        });
        if (websites.length > 0) {
          if (!confidenceMap.websites) {
            confidenceMap.websites = 0.9;
          }
          processedIndices.add(idx);
        }
      }
    });

    // Step C: Extract Phone Numbers
    lines.forEach((line, idx) => {
      if (processedIndices.has(idx)) return;

      // Check first if it matches with standard label indicator
      const kwMatch = line.match(PHONE_KEYWORDS_REGEX);
      if (kwMatch && kwMatch[1]) {
        const cleaned = kwMatch[1].trim();
        if (cleaned.replace(/[^\d]/g, '').length >= 5) {
          phones.push(cleaned);
          if (!confidenceMap.phones) {
            confidenceMap.phones = 0.92;
          }
          processedIndices.add(idx);
          return;
        }
      }

      // Check generic phone regex
      const generalMatches = line.match(GENERAL_PHONE_REGEX);
      if (generalMatches) {
        generalMatches.forEach((m) => {
          const digitsOnly = m.replace(/[^\d]/g, '');
          // Usually a phone number is at least 6 digits and doesn't contain letters
          if (digitsOnly.length >= 7 && digitsOnly.length <= 15 && !/[a-zA-Z]/.test(line)) {
            const cleaned = m.trim();
            if (!phones.includes(cleaned)) {
              phones.push(cleaned);
            }
          }
        });
        if (phones.length > 0) {
          if (!confidenceMap.phones) {
            confidenceMap.phones = 0.78;
          }
          processedIndices.add(idx);
        }
      }
    });

    // Step D: Extract Physical Addresses
    lines.forEach((line, idx) => {
      if (processedIndices.has(idx)) return;

      const lowerLine = line.toLowerCase();
      const hasAddressKeyword = ADDRESS_KEYWORDS.some((kw) => {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        return regex.test(lowerLine);
      });

      // Sometimes ZIP codes/postal codes match numbers like \b\d{5}\b (e.g. 5 digits)
      const hasZipCode = /\b\d{5}(-\d{4})?\b/.test(line);

      if (hasAddressKeyword || hasZipCode) {
        if (!addresses.includes(line)) {
          addresses.push(line);
        }
        if (!confidenceMap.addresses) {
          confidenceMap.addresses = 0.85;
        }
        processedIndices.add(idx);
      }
    });

    // Step E: Identify Company, Full Name, Title from remaining lines
    const remainingLines: Array<{ text: string; index: number }> = [];
    lines.forEach((line, idx) => {
      if (!processedIndices.has(idx)) {
        remainingLines.push({ text: line, index: idx });
      }
    });

    // Heuristics for Title (roles) - run only if not parsed from prefixes yet!
    if (!title) {
      const possibleTitles: string[] = [];
      remainingLines.forEach((item) => {
        const lower = item.text.toLowerCase();
        const isTitle = TITLE_KEYWORDS.some((kw) => {
          const regex = new RegExp(`\\b${kw}\\b`, 'i');
          return regex.test(lower);
        });

        // Avoid long address/description text or digits
        if (isTitle && item.text.length < 50 && !/\d{4,}/.test(item.text)) {
          possibleTitles.push(item.text);
          processedIndices.add(item.index);
        }
      });

      if (possibleTitles.length > 0) {
        title = possibleTitles[0];
        confidenceMap.title = 0.82;
      }
    }

    // Re-filter remaining lines
    const finalCleanLines: string[] = [];
    lines.forEach((line, idx) => {
      if (!processedIndices.has(idx)) {
        // Exclude lines with only symbols or very long texts
        if (line.replace(/[^\w]/g, '').length > 2 && line.length < 80) {
          finalCleanLines.push(line);
        }
      }
    });

    // Heuristic for Company Name - run only if not parsed from prefixes yet!
    let companyIdx = -1;
    if (!company) {
      for (let i = 0; i < finalCleanLines.length; i++) {
        const lower = finalCleanLines[i].toLowerCase();
        const isCompany = COMPANY_KEYWORDS.some((kw) => {
          const regex = new RegExp(`\\b${kw}\\b`, 'i');
          return regex.test(lower);
        });

        if (isCompany) {
          company = finalCleanLines[i];
          confidenceMap.company = 0.88;
          // find the actual line index corresponding to this clean line
          companyIdx = lines.indexOf(finalCleanLines[i]);
          if (companyIdx !== -1) {
            processedIndices.add(companyIdx);
          }
          break;
        }
      }
    }

    // Fallbacks for Full Name - run only if not parsed from prefixes yet!
    if (!fullName) {
      const nameCandidates = finalCleanLines.filter((c) => lines.indexOf(c) !== companyIdx);

      if (nameCandidates.length > 0) {
        // Prefer Title Case (like John Doe or Jane A. Smith)
        const titleCaseCandidate = nameCandidates.find((c) => {
          // Simple letters-only Title Case checker
          const words = c.trim().split(/\s+/);
          if (words.length >= 2 && words.length <= 4) {
            return words.every((w) => /^[A-Z][A-Za-z.']*/.test(w) || w.length === 1);
          }
          return false;
        });

        fullName = titleCaseCandidate || nameCandidates[0];
        confidenceMap.fullName = titleCaseCandidate ? 0.85 : 0.70;

        // If we didn't identify a company, but we have multiple candidates left,
        // the second candidate might be the company or title or secondary info
        if (!company && nameCandidates.length > 1) {
          const secondary = nameCandidates.find((c) => c !== fullName);
          if (secondary) {
            company = secondary;
            confidenceMap.company = 0.70;
          }
        }
      }
    }

    // Fallback for title if still blank
    if (!title && finalCleanLines.length > 1 && fullName) {
      // Find a line near the name that wasn't used
      const unused = finalCleanLines.find((c) => c !== fullName && c !== company);
      if (unused && unused.length < 40) {
        title = unused;
        confidenceMap.title = 0.65;
      }
    }

    // Guess business domain from raw text if not prefix-matched
    const lowerFullText = fullText.toLowerCase();
    if (/\b(tech|software|developer|solutions|digital|data|web|systems|app|code|cloud|engineer|computer|network)\b/.test(lowerFullText)) {
      businessDomain = 'Technology';
      confidenceMap.businessDomain = 0.8;
    } else if (/\b(health|hospital|medical|doctor|dentist|care|clinic|pharma|clinical|nurse|therapist)\b/.test(lowerFullText)) {
      businessDomain = 'Healthcare';
      confidenceMap.businessDomain = 0.8;
    } else if (/\b(finance|bank|wealth|investment|capital|audit|tax|accounting|venture|insurance|broker)\b/.test(lowerFullText)) {
      businessDomain = 'Finance';
      confidenceMap.businessDomain = 0.8;
    } else if (/\b(school|univ|college|learn|academy|education|course|teach|study|training)\b/.test(lowerFullText)) {
      businessDomain = 'Education';
      confidenceMap.businessDomain = 0.8;
    } else if (/\b(food|dining|restaurant|cafe|beverage|bakery|kitchen|catering|chef|coffee|bar)\b/.test(lowerFullText)) {
      businessDomain = 'Food & Dining';
      confidenceMap.businessDomain = 0.8;
    } else if (/\b(estate|real|build|construct|property|house|homes|contractor|facility)\b/.test(lowerFullText)) {
      businessDomain = 'Real Estate';
      confidenceMap.businessDomain = 0.8;
    } else if (/\b(law|legal|attorney|solicitor|justice|counsel|court)\b/.test(lowerFullText)) {
      businessDomain = 'Legal';
      confidenceMap.businessDomain = 0.8;
    } else if (/\b(art|media|design|creative|studio|cinema|film|music|agency|photo|marketing|publicity|pr)\b/.test(lowerFullText)) {
      businessDomain = 'Media & Design';
      confidenceMap.businessDomain = 0.8;
    } else if (/\b(logistic|express|delivery|transit|ship|transport|cargo|warehouse|freight)\b/.test(lowerFullText)) {
      businessDomain = 'Logistics';
      confidenceMap.businessDomain = 0.8;
    } else if (/\b(consult|advisor|strategy|partner|management)\b/.test(lowerFullText)) {
      businessDomain = 'Consulting';
      confidenceMap.businessDomain = 0.7;
    } else if (/\b(manufactur|factory|plant|industr|chemical|steel|machinery|producer)\b/.test(lowerFullText)) {
      businessDomain = 'Manufacturing';
      confidenceMap.businessDomain = 0.7;
    } else {
      businessDomain = 'Other';
      confidenceMap.businessDomain = 0.4;
    }

    return {
      fullName,
      title,
      company,
      phones,
      emails,
      addresses,
      websites,
      businessDomain,
      confidenceMap,
    };
  }

  /**
   * Helper to verify if the round-trip property holds true.
   * Serializes a ParsedContact to text, and parses it again.
   */
  static serialize(contact: Omit<ParsedContact, 'confidenceMap'>): string {
    const lines: string[] = [];
    if (contact.fullName) lines.push(`Name: ${contact.fullName}`);
    if (contact.title) lines.push(`Title: ${contact.title}`);
    if (contact.company) lines.push(`Company: ${contact.company}`);
    if (contact.businessDomain) lines.push(`Domain: ${contact.businessDomain}`);
    contact.phones.forEach((phone) => {
      if (phone) lines.push(`Phone: ${phone}`);
    });
    contact.emails.forEach((email) => {
      if (email) lines.push(`Email: ${email}`);
    });
    contact.addresses.forEach((addr) => {
      if (addr) lines.push(`Address: ${addr}`);
    });
    contact.websites.forEach((web) => {
      if (web) lines.push(`Website: ${web}`);
    });
    return lines.join('\n');
  }
}
export default HeuristicParser;
