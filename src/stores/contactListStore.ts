/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { ContactRecord } from '../types';
import { db } from '../db';
import { useAuthStore } from './authStore';

interface ContactListState {
  contacts: ContactRecord[];
  isLoading: boolean;
  selectedRecord: ContactRecord | null;
  setSelectedRecord: (record: ContactRecord | null) => void;
  loadContacts: () => Promise<void>;
  addContact: (contact: ContactRecord) => void;
  deleteContact: (contactId: string) => Promise<void>;
}

export const useContactListStore = create<ContactListState>((set, get) => ({
  contacts: [],
  isLoading: false,
  selectedRecord: null,

  setSelectedRecord: (record) => {
    set({ selectedRecord: record });
  },

  loadContacts: async () => {
    const activeUserId = useAuthStore.getState().currentUser?.id;
    if (!activeUserId) {
      set({ contacts: [], isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      // Query contacts filtered by userId, ordered by createdAt descending
      const records = await db.contactRecords
        .where('userId')
        .equals(activeUserId)
        .reverse()
        .sortBy('createdAt');
        
      set({ contacts: records });
    } catch (error) {
      console.error('Failed to load contacts from LocalDB for active user:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  addContact: (contact) => {
    const current = get().contacts;
    // Check if duplicate already exists by ID
    const exists = current.some(c => c.id === contact.id);
    let newContacts = [...current];
    if (exists) {
      newContacts = newContacts.map(c => c.id === contact.id ? contact : c);
    } else {
      newContacts = [contact, ...newContacts];
    }
    // Maintain descending order by createdAt
    newContacts.sort((a, b) => b.createdAt - a.createdAt);
    set({ contacts: newContacts });
  },

  deleteContact: async (contactId) => {
    try {
      // Remove from database
      await db.contactRecords.delete(contactId);
      await db.captureSessions.delete(contactId); // Clean up associated capture session too

      // Reactively remove from in-memory state
      const filtered = get().contacts.filter(c => c.id !== contactId);
      set({
        contacts: filtered,
        selectedRecord: get().selectedRecord?.id === contactId ? null : get().selectedRecord
      });
    } catch (error) {
      console.error('Failed to delete contact:', error);
      throw error;
    }
  },
}));
