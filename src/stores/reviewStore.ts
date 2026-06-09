/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { ParsedContact } from '../types';

interface ValidationErrors {
  fullName?: string;
  emails?: Record<number, string>; // validation error message per index
  phones?: Record<number, string>; // validation error message per index
}

interface ReviewState {
  draft: ParsedContact | null;
  validationErrors: ValidationErrors;
  isSaving: boolean;
  setDraft: (draft: ParsedContact | null) => void;
  updateDraftField: <K extends keyof Omit<ParsedContact, 'confidenceMap'>>(
    field: K,
    value: ParsedContact[K]
  ) => void;
  updateDraftFieldArrayValue: (
    field: 'phones' | 'emails' | 'addresses' | 'websites',
    index: number,
    value: string
  ) => void;
  addDraftFieldArrayValue: (
    field: 'phones' | 'emails' | 'addresses' | 'websites'
  ) => void;
  removeDraftFieldArrayValue: (
    field: 'phones' | 'emails' | 'addresses' | 'websites',
    index: number
  ) => void;
  validateDraft: () => boolean;
  setValidationError: (field: keyof ValidationErrors, index: number | undefined, message: string | undefined) => void;
  resetValidationErrors: () => void;
  setIsSaving: (isSaving: boolean) => void;
}

// Regex matching RFC 5322 simplified email standard
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Recognised phone formats: allowing E164 and regional (digits, space, +, -, ., parentheses)
const PHONE_REGEX = /^[+]?[\d\s.()\-]{5,25}$/;

export const useReviewStore = create<ReviewState>((set, get) => ({
  draft: null,
  validationErrors: {},
  isSaving: false,

  setDraft: (draft) => {
    set({ draft, validationErrors: {}, isSaving: false });
  },

  updateDraftField: (field, value) => {
    const draft = get().draft;
    if (!draft) return;

    const updatedDraft = {
      ...draft,
      [field]: value,
    };

    set({ draft: updatedDraft });
    // Proactively validate the updated field if it's fullName
    if (field === 'fullName') {
      const errors = { ...get().validationErrors };
      if (!value) {
        errors.fullName = 'Full Name is required.';
      } else {
        delete errors.fullName;
      }
      set({ validationErrors: errors });
    }
  },

  updateDraftFieldArrayValue: (field, index, value) => {
    const draft = get().draft;
    if (!draft) return;

    const arrayCopy = [...draft[field]];
    arrayCopy[index] = value;

    const updatedDraft = {
      ...draft,
      [field]: arrayCopy,
    };

    set({ draft: updatedDraft });

    // Validate email or phone on typing
    const errors = { ...get().validationErrors };
    if (field === 'emails') {
      const emailErrors = { ...errors.emails };
      if (value && !EMAIL_REGEX.test(value)) {
        emailErrors[index] = 'Please enter a valid RFC 5322 email address (e.g. name@company.com).';
      } else {
        delete emailErrors[index];
      }
      errors.emails = Object.keys(emailErrors).length > 0 ? emailErrors : undefined;
    } else if (field === 'phones') {
      const phoneErrors = { ...errors.phones };
      if (value && !PHONE_REGEX.test(value)) {
        phoneErrors[index] = 'Please enter a valid phone format (digits, +, -, parents, spaces).';
      } else {
        delete phoneErrors[index];
      }
      errors.phones = Object.keys(phoneErrors).length > 0 ? phoneErrors : undefined;
    }
    set({ validationErrors: errors });
  },

  addDraftFieldArrayValue: (field) => {
    const draft = get().draft;
    if (!draft) return;

    const updatedDraft = {
      ...draft,
      [field]: [...draft[field], ''] as any,
    };

    if (field === 'addresses') {
      updatedDraft.addressComponents = [
        ...(draft.addressComponents || []),
        { street: '', city: '', district: '', country: '', pincode: '' }
      ];
    }

    set({ draft: updatedDraft });
  },

  removeDraftFieldArrayValue: (field, index) => {
    const draft = get().draft;
    if (!draft) return;

    const arrayCopy = draft[field].filter((_, i) => i !== index);
    const updatedDraft = {
      ...draft,
      [field]: arrayCopy as any,
    };

    if (field === 'addresses' && draft.addressComponents) {
      updatedDraft.addressComponents = draft.addressComponents.filter((_, i) => i !== index);
    }

    // Also clean up validation errors for that index (shift down errors)
    const errors = { ...get().validationErrors };
    if (field === 'emails' && errors.emails) {
      const emailErrors: Record<number, string> = {};
      Object.keys(errors.emails).forEach((k) => {
        const numK = parseInt(k, 10);
        if (numK < index) {
          emailErrors[numK] = errors.emails![numK];
        } else if (numK > index) {
          emailErrors[numK - 1] = errors.emails![numK];
        }
      });
      errors.emails = Object.keys(emailErrors).length > 0 ? emailErrors : undefined;
    } else if (field === 'phones' && errors.phones) {
      const phoneErrors: Record<number, string> = {};
      Object.keys(errors.phones).forEach((k) => {
        const numK = parseInt(k, 10);
        if (numK < index) {
          phoneErrors[numK] = errors.phones![numK];
        } else if (numK > index) {
          phoneErrors[numK - 1] = errors.phones![numK];
        }
      });
      errors.phones = Object.keys(phoneErrors).length > 0 ? phoneErrors : undefined;
    }

    set({ draft: updatedDraft, validationErrors: errors });
  },

  validateDraft: () => {
    const draft = get().draft;
    if (!draft) return false;

    const errors: ValidationErrors = {};
    let isValid = true;

    // Validate Full Name
    if (!draft.fullName || draft.fullName.trim() === '') {
      errors.fullName = 'Full Name is required.';
      isValid = false;
    }

    // Validate Emails
    const emailErrors: Record<number, string> = {};
    draft.emails.forEach((email, idx) => {
      if (email && !EMAIL_REGEX.test(email)) {
        emailErrors[idx] = 'Please enter a valid RFC 5322 email address.';
        isValid = false;
      }
    });
    if (Object.keys(emailErrors).length > 0) {
      errors.emails = emailErrors;
    }

    // Validate Phones
    const phoneErrors: Record<number, string> = {};
    draft.phones.forEach((phone, idx) => {
      if (phone && !PHONE_REGEX.test(phone)) {
        phoneErrors[idx] = 'Please enter a valid phone format.';
        isValid = false;
      }
    });
    if (Object.keys(phoneErrors).length > 0) {
      errors.phones = phoneErrors;
    }

    set({ validationErrors: errors });
    return isValid;
  },

  setValidationError: (field, index, message) => {
    const errors = { ...get().validationErrors };
    if (field === 'fullName') {
      errors.fullName = message;
    } else if (field === 'emails') {
      const emailErrors = { ...errors.emails } as Record<number, string>;
      if (message && index !== undefined) {
        emailErrors[index] = message;
      } else if (index !== undefined) {
        delete emailErrors[index];
      }
      errors.emails = Object.keys(emailErrors).length > 0 ? emailErrors : undefined;
    } else if (field === 'phones') {
      const phoneErrors = { ...errors.phones } as Record<number, string>;
      if (message && index !== undefined) {
        phoneErrors[index] = message;
      } else if (index !== undefined) {
        delete phoneErrors[index];
      }
      errors.phones = Object.keys(phoneErrors).length > 0 ? phoneErrors : undefined;
    }
    set({ validationErrors: errors });
  },

  resetValidationErrors: () => {
    set({ validationErrors: {} });
  },

  setIsSaving: (isSaving) => {
    set({ isSaving });
  },
}));
