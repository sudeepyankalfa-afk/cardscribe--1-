/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, ArrowRight, Download, Trash2, Mail, Phone, 
  MapPin, Globe, CreditCard, Sparkles, Building, Briefcase, FileSpreadsheet 
} from 'lucide-react';
import { useContactListStore } from '../stores/contactListStore';
import { VcfGenerator } from '../utils/VcfGenerator';
import { ExcelGenerator } from '../utils/ExcelGenerator';
import { ContactRecord } from '../types';
import { useAuthStore } from '../stores/authStore';

interface HomeScreenProps {
  onNavigate: (view: 'home' | 'capture' | 'review') => void;
  onSelectRecord: (record: ContactRecord) => void;
}

export function HomeScreen({ onNavigate, onSelectRecord }: HomeScreenProps) {
  const { contacts, isLoading, loadContacts, deleteContact } = useContactListStore();
  const { currentUser } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All');

  // Fetch contacts whenever active user id changes
  useEffect(() => {
    loadContacts();
  }, [loadContacts, currentUser?.id]);

  // Compile unique domains from saved records dynamically
  const uniqueDomains = React.useMemo(() => {
    const list = new Set<string>();
    contacts.forEach(c => {
      const dom = c.businessDomain ? c.businessDomain.trim() : 'Other';
      list.add(dom);
    });
    return Array.from(list).sort();
  }, [contacts]);

  const filteredContacts = contacts.filter(c => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      c.fullName.toLowerCase().includes(query) ||
      (c.company || '').toLowerCase().includes(query) ||
      (c.title || '').toLowerCase().includes(query) ||
      (c.businessDomain || '').toLowerCase().includes(query) ||
      c.emails.some(e => e.toLowerCase().includes(query)) ||
      c.phones.some(p => p.toLowerCase().includes(query))
    );

    const contactDomain = c.businessDomain || 'Other';
    const matchesDomain = selectedDomain === 'All' || contactDomain === selectedDomain;

    return matchesSearch && matchesDomain;
  });

  const handleDelete = async (e: React.MouseEvent, record: ContactRecord) => {
    e.stopPropagation(); // prevent card drilldown click
    if (window.confirm(`Are you sure you want to delete ${record.fullName}?`)) {
      await deleteContact(record.id);
    }
  };

  const handleExport = (e: React.MouseEvent, record: ContactRecord) => {
    e.stopPropagation(); // prevent card drilldown click
    VcfGenerator.download(record);
  };

  const handleExportExcel = () => {
    // Export either all or the filtered contacts depending on search
    const listToExport = filteredContacts.length > 0 ? filteredContacts : contacts;
    ExcelGenerator.download(listToExport);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8" id="home-screen-container">
      {/* Search and Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8" id="home-top-controls">
        <div>
          <h1 className="text-2xl font-semibold text-slate-850 dark:text-slate-100 tracking-tight" id="home-main-title">
            Your Scans
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Access and manage digital contact records scanned on-device.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {contacts.length > 0 && (
            <button
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-tight transition-all active:scale-[0.98] cursor-pointer"
              style={{ minHeight: 44 }}
              title="Download saved contacts as Excel Spreadsheet (.csv)"
              id="btn-export-excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Export Excel</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('capture')}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-white font-bold text-sm tracking-tight transition-all active:scale-[0.98] cursor-pointer"
            style={{ minHeight: 44, minWidth: 160 }}
            id="btn-scan-card-launch"
          >
            <Plus className="w-5 h-5" />
            <span>Scan Business Card</span>
          </button>
        </div>
      </div>

      {/* Real-time search filter */}
      {contacts.length > 0 && (
        <div className="relative mb-6 max-w-md" id="search-bar-wrapper">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-500 text-sm bg-white dark:bg-slate-900 outline-none"
            placeholder="Search by name, company, position..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="contacts-search-input"
            aria-label="Search Contacts"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-3 flex items-center text-xs font-semibold text-slate-400 hover:text-slate-600"
              style={{ width: 44, height: 44 }}
              id="clear-search-btn"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Business Domain Filter Chips */}
      {contacts.length > 0 && (
        <div className="mb-6" id="domain-filters-bar">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedDomain('All')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                selectedDomain === 'All'
                  ? 'bg-blue-600 border border-blue-600 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-300'
              }`}
              id="filter-chip-all"
            >
              All Scans ({contacts.length})
            </button>
            {uniqueDomains.map((dom) => {
              const count = contacts.filter(c => (c.businessDomain || 'Other') === dom).length;
              return (
                <button
                  key={dom}
                  onClick={() => setSelectedDomain(dom)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                    selectedDomain === dom
                      ? 'bg-blue-600 border border-blue-600 text-white shadow-sm'
                      : 'bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-350'
                  }`}
                  id={`filter-chip-${dom.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {dom} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main contacts deck */}
      {isLoading ? (
        <div className="text-center py-20" id="contacts-loading-indicator">
          <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-sm text-slate-500">Retrieving offline wallet...</p>
        </div>
      ) : contacts.length === 0 ? (
        // Empty state landing card (Requirement 9.2)
        <div className="text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-12 max-w-md mx-auto bg-white dark:bg-slate-950" id="contacts-empty-state">
          <div className="w-16 h-16 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 mx-auto mb-6">
            <CreditCard className="w-8 h-8 stroke-1" />
          </div>
          <h3 className="text-slate-800 dark:text-slate-200 font-bold text-base tracking-tight">Scan Your First Business Card</h3>
          <p className="text-xs text-slate-550 dark:text-slate-400 mt-2 max-w-xs mx-auto leading-relaxed">
            CardScribe performs automatic text extraction from physical business cards and formats them into a neat digital Rolodex.
          </p>
          <button
            onClick={() => onNavigate('capture')}
            className="mt-6 font-bold text-xs uppercase tracking-wider px-6 py-3 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-950 text-white transition-all active:scale-[0.98]"
            style={{ minHeight: 44 }}
            id="empty-state-scan-btn"
          >
            Start scan session
          </button>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-16 text-slate-500" id="search-no-results">
          <p className="text-sm">No results match your search parameters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="contacts-grid-list">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => onSelectRecord(contact)}
              className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 hover:border-slate-350 dark:hover:border-slate-800 rounded-xl p-5 shadow-xs hover:shadow-sm transition-all cursor-pointer flex flex-col justify-between group h-full"
              id={`contact-card-${contact.id}`}
            >
              <div>
                <div className="flex gap-4 items-start pb-4 border-b border-slate-100 dark:border-slate-900">
                  {/* Thumbnail Frame (Requirement 9.3) */}
                  <div className="w-12 h-12 bg-slate-50 border border-slate-200 dark:border-slate-850 rounded overflow-hidden flex-shrink-0 flex items-center justify-center relative bg-slate-950">
                    {contact.thumbnailUrl ? (
                      <img
                        src={contact.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        id={`contact-thumb-${contact.id}`}
                      />
                    ) : (
                      <CreditCard className="w-5 h-5 text-slate-400 stroke-1" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 dark:text-slate-50 truncate text-sm leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" id={`contact-name-${contact.id}`}>
                      {contact.fullName}
                    </h3>
                    
                    {contact.title && (
                      <p className="text-xs text-slate-500 font-medium truncate flex items-center gap-1 mt-1" id={`contact-title-${contact.id}`}>
                        <Briefcase className="w-3 h-3 text-slate-400" />
                        <span>{contact.title}</span>
                      </p>
                    )}
                    
                    {contact.company && (
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-1 mt-0.5" id={`contact-company-${contact.id}`}>
                        <Building className="w-3 h-3 text-slate-400" />
                        <span>{contact.company}</span>
                      </p>
                    )}
                    
                    {contact.businessDomain && (
                      <div className="mt-1.5 flex" id={`contact-domain-wrapper-${contact.id}`}>
                        <span className="inline-flex text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-950/50">
                          {contact.businessDomain}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Primary emails or phone indicator */}
                <div className="py-4 space-y-2 text-xs text-slate-500" id={`contact-details-${contact.id}`}>
                  {contact.emails.length > 0 && (
                    <div className="flex items-center gap-2 truncate" id={`contact-email-${contact.id}`}>
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{contact.emails[0]}</span>
                    </div>
                  )}
                  {contact.phones.length > 0 && (
                    <div className="flex items-center gap-2 truncate" id={`contact-phone-${contact.id}`}>
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{contact.phones[0]}</span>
                    </div>
                  )}
                  {contact.addresses.length > 0 && (
                    <div className="flex items-center gap-2 truncate" id={`contact-address-${contact.id}`}>
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{contact.addresses[0]}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action rail (Requirement 8, Row Deletes) */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-900 pt-4 mt-2">
                <span className="text-[10px] text-slate-400 font-mono">
                  Scanned {new Date(contact.createdAt).toLocaleDateString()}
                </span>
                
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => handleExport(e, contact)}
                    className="p-2 text-slate-450 hover:text-slate-800 dark:hover:text-white rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
                    style={{ width: 40, height: 40 }}
                    title="Export vCard (.vcf)"
                    id={`vcard-export-direct-${contact.id}`}
                  >
                    <Download className="w-4 h-4 mx-auto" />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, contact)}
                    className="p-2 text-slate-450 hover:text-rose-600 rounded-lg transition-colors hover:bg-rose-50/50 dark:hover:bg-rose-950/20"
                    style={{ width: 40, height: 40 }}
                    title="Delete Contact"
                    id={`delete-direct-${contact.id}`}
                  >
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                  <span className="p-2 text-blue-600 hover:text-blue-700" style={{ width: 40, height: 40 }}>
                    <ArrowRight className="w-4 h-4 mx-auto group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default HomeScreen;
