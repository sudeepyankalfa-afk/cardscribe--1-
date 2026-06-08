/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { type Table } from 'dexie';
import { ContactRecord, CaptureSession, UserAccount } from './types';

export class CardScribeDatabase extends Dexie {
  contactRecords!: Table<ContactRecord>;
  captureSessions!: Table<CaptureSession>;
  users!: Table<UserAccount>;

  constructor() {
    super('CardScribeDatabase');
    // Bump version to support User accounts table & userId querying
    this.version(2).stores({
      contactRecords: 'id, sessionId, userId, createdAt, fullName, company',
      captureSessions: 'id, userId, createdAt, status',
      users: 'id, username',
    });
  }
}

export const db = new CardScribeDatabase();
export default db;
