/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CreditCard, ScanLine, FileUser, Info, LogOut, User, Loader2 } from 'lucide-react';
import { HomeScreen } from './components/HomeScreen';
import { CaptureScreen } from './components/CaptureScreen';
import { ReviewScreen } from './components/ReviewScreen';
import { AuthScreen } from './components/AuthScreen';
import { OnlineStatusIndicator } from './components/OnlineStatusIndicator';
import { ContactRecord } from './types';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const [currentView, setCurrentView] = useState<'home' | 'capture' | 'review'>('home');
  const [selectedRecord, setSelectedRecord] = useState<ContactRecord | null>(null);

  const { currentUser, isAuthenticated, isLoading, initialize, logout } = useAuthStore();

  // Initialize Auth state session from localStorage on application mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleNavigate = (view: 'home' | 'capture' | 'review') => {
    if (view !== 'review') {
      setSelectedRecord(null); // clear drill-down selection
    }
    setCurrentView(view);
  };

  const handleSelectRecord = (record: ContactRecord) => {
    setSelectedRecord(record);
    setCurrentView('review');
  };

  // 1. Render Loading splash if Auth is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6" id="auth-loading-viewport">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-sm font-semibold tracking-wide text-slate-500 mt-4 uppercase animate-pulse">
          Initializing Private Registry...
        </p>
      </div>
    );
  }

  // 2. Gatekeeper: Render Login/Signup screen if not authenticated
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans" id="cardscribe-root-container">
      {/* Universal header navigation */}
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-900 h-16 flex items-center" id="navbar-header">
        <div className="max-w-6xl mx-auto w-full px-6 flex items-center justify-between">
          <button
            onClick={() => handleNavigate('home')}
            className="flex items-center gap-3 hover:opacity-90 transition-opacity border-none bg-transparent cursor-pointer"
            style={{ minHeight: 44 }}
            id="brand-logo-trigger"
          >
            <div className="w-8 h-8 bg-slate-900 dark:bg-white dark:text-slate-950 rounded flex items-center justify-center text-white" id="brand-logo-avatar">
              <ScanLine className="w-4 h-4" />
            </div>
            <div className="text-left">
              <span className="font-bold text-slate-800 dark:text-white tracking-tight text-lg block leading-none">
                CardScribe
              </span>
            </div>
          </button>

          {/* Nav Links and connection signals */}
          <div className="flex items-center gap-4 sm:gap-6">
            <nav className="hidden sm:flex items-center gap-6 text-sm font-medium" id="header-nav-links">
              <button
                onClick={() => handleNavigate('home')}
                className={`text-sm font-medium transition-colors cursor-pointer ${
                  currentView === 'home'
                    ? 'text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                style={{ minHeight: 44 }}
                id="nav-link-scans"
              >
                Dashboard
              </button>
              <button
                onClick={() => handleNavigate('capture')}
                className={`text-sm font-medium transition-colors cursor-pointer ${
                  currentView === 'capture'
                    ? 'text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                style={{ minHeight: 44 }}
                id="nav-link-new-scan"
              >
                Scan Card
              </button>
            </nav>

            {/* Profile Avatar & Sign Out Option */}
            {currentUser && (
              <div className="flex items-center gap-3 border-l border-slate-200 dark:border-slate-800 pl-4" id="nav-user-indicator">
                <div className="hidden md:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                    {currentUser.fullName}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono tracking-wider">
                    @{currentUser.username}
                  </span>
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 flex items-center justify-center text-xs font-bold" title={`${currentUser.fullName} (@${currentUser.username})`}>
                  {currentUser.fullName.split(' ').map(n=>n[0]).join('').slice(0, 2).toUpperCase() || <User className="w-3.5 h-3.5" />}
                </div>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg border border-slate-205 dark:border-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/20 text-slate-400 transition-all cursor-pointer"
                  title="Secure Sign Out"
                  id="navbar-logout-btn"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <OnlineStatusIndicator />
          </div>
        </div>
      </header>

      {/* Main page content container */}
      <main className="flex-1 pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView + (selectedRecord ? `-${selectedRecord.id}` : '')}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            id="page-route-view"
          >
            {currentView === 'home' && (
              <HomeScreen
                onNavigate={handleNavigate}
                onSelectRecord={handleSelectRecord}
              />
            )}
            
            {currentView === 'capture' && (
              <CaptureScreen
                onNavigate={handleNavigate}
              />
            )}

            {currentView === 'review' && (
              <ReviewScreen
                onNavigate={handleNavigate}
                viewingSavedRecord={selectedRecord}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Humble Footer section */}
      <footer className="py-6 border-t border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 text-center text-xs text-slate-400" id="footer-section">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 CardScribe applet. All rights reserved.</p>
          <div className="flex items-center gap-1.5 hover:text-slate-600 select-none">
            <Info className="w-3.5 h-3.5" />
            <span>IndexedDB + Web Worker local offline processing sandbox</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
