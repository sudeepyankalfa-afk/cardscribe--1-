/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { UserAccount } from '../types';
import { db } from '../db';
import { hashPassword } from '../utils/crypto';

interface AuthState {
  currentUser: UserAccount | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<boolean>;
  signup: (username: string, password: string, fullName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: null,
  isAuthenticated: false,
  isLoading: true,
  authError: null,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const savedUserId = localStorage.getItem('cardscribe_session_userid');
      if (savedUserId) {
        const user = await db.users.get(savedUserId);
        if (user) {
          set({ currentUser: user, isAuthenticated: true, authError: null });
        } else {
          localStorage.removeItem('cardscribe_session_userid');
        }
      }
    } catch (error) {
      console.error('Failed to restore active auth session:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, authError: null });
    try {
      const normalizedUsername = username.trim().toLowerCase();
      if (!normalizedUsername || !password) {
        set({ authError: 'UserId and Password are required.' });
        return false;
      }

      const user = await db.users.get(normalizedUsername);
      if (!user) {
        set({ authError: 'No account found with this UserId. Please sign up first!' });
        return false;
      }

      // Hash entered password to match stored hash
      const passwordHash = await hashPassword(password);
      if (user.passwordHash !== passwordHash) {
        set({ authError: 'Invalid password. Please double check and try again.' });
        return false;
      }

      // Migrating pre-existing guest contacts
      try {
        const unboundContacts = await db.contactRecords.where('userId').noneOf([user.id]).toArray();
        // Also migration of contacts with untracked fields (undefined)
        const allLocal = await db.contactRecords.toArray();
        const unassigned = allLocal.filter(c => !c.userId);
        
        for (const contact of unassigned) {
          contact.userId = user.id;
          await db.contactRecords.put(contact);
        }

        const unassignedSessions = (await db.captureSessions.toArray()).filter(s => !s.userId);
        for (const session of unassignedSessions) {
          session.userId = user.id;
          await db.captureSessions.put(session);
        }
      } catch (migrationErr) {
        console.warn('Silent local records migration skip:', migrationErr);
      }

      localStorage.setItem('cardscribe_session_userid', user.id);
      set({ currentUser: user, isAuthenticated: true, authError: null });
      return true;
    } catch (error) {
      console.error('Error during login transaction:', error);
      set({ authError: 'An unexpected authentication error occurred.' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  signup: async (username, password, fullName) => {
    set({ isLoading: true, authError: null });
    try {
      const normalizedUsername = username.trim().toLowerCase();
      const trimmedName = fullName.trim();

      // Basic field checks
      if (!normalizedUsername) {
        set({ authError: 'UserId is required.' });
        return false;
      }
      if (normalizedUsername.length < 3) {
        set({ authError: 'UserId must be at least 3 characters long.' });
        return false;
      }
      if (!/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
        set({ authError: 'UserId can only contain alphanumeric characters and underscores.' });
        return false;
      }
      if (!password || password.length < 5) {
        set({ authError: 'Password must be at least 5 characters long.' });
        return false;
      }
      if (!trimmedName) {
        set({ authError: 'Full Name is required.' });
        return false;
      }

      // Check duplicate usernames
      const existingUser = await db.users.get(normalizedUsername);
      if (existingUser) {
        set({ authError: 'This UserId is already taken. Try logging in or use another id!' });
        return false;
      }

      // Password hashing securely with SHA-256
      const passwordHash = await hashPassword(password);

      const newUser: UserAccount = {
        id: normalizedUsername,
        username: normalizedUsername,
        passwordHash,
        fullName: trimmedName,
        createdAt: Date.now(),
      };

      await db.users.put(newUser);

      // Migrating pre-existing guest contacts automatically
      try {
        const allLocal = await db.contactRecords.toArray();
        const unassigned = allLocal.filter(c => !c.userId);
        for (const contact of unassigned) {
          contact.userId = newUser.id;
          await db.contactRecords.put(contact);
        }

        const unassignedSessions = (await db.captureSessions.toArray()).filter(s => !s.userId);
        for (const session of unassignedSessions) {
          session.userId = newUser.id;
          await db.captureSessions.put(session);
        }
      } catch (migrationErr) {
        console.warn('Silent local records migration skip:', migrationErr);
      }

      localStorage.setItem('cardscribe_session_userid', newUser.id);
      set({ currentUser: newUser, isAuthenticated: true, authError: null });
      return true;
    } catch (error) {
      console.error('Error during signup transaction:', error);
      set({ authError: 'An unexpected signup database error occurred.' });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    localStorage.removeItem('cardscribe_session_userid');
    set({ currentUser: null, isAuthenticated: false, authError: null });
  },

  clearError: () => {
    set({ authError: null });
  },
}));
