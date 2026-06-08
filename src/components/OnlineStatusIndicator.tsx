/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wifi, WifiOff, Cloud, FileText, X } from 'lucide-react';

export function OnlineStatusIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'online' | 'offline';
    id: number;
  } | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setNotification({
        message: 'You are back online. High-accuracy Cloud OCR with structured parsing is available.',
        type: 'online',
        id: Date.now(),
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setNotification({
        message: 'You are offline. CardScribe has switched to Local OCR (fully functional on-device model).',
        type: 'offline',
        id: Date.now(),
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  return (
    <>
      {/* Mini state badge for header */}
      <div className="flex items-center gap-1.5 cursor-default transition-all" id="network-status-badge">
        {isOnline ? (
          <span className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/60">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Online • Cloud OCR</span>
          </span>
        ) : (
          <span className="flex items-center gap-2 text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/60">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Offline • Local Only</span>
          </span>
        )}
      </div>

      {/* Floating Transition Notification Banner */}
      <div className="fixed bottom-4 left-4 right-4 z-50 pointer-events-none md:left-auto md:max-w-md">
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg ${
                notification.type === 'online'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-slate-900 dark:text-emerald-100 dark:border-emerald-900'
                  : 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-slate-900 dark:text-amber-100 dark:border-amber-900'
              }`}
              id={`connection-toast-${notification.id}`}
            >
              <div className="mt-0.5">
                {notification.type === 'online' ? (
                  <Cloud className="w-5 h-5 text-emerald-600" />
                ) : (
                  <FileText className="w-5 h-5 text-amber-600" />
                )}
              </div>
              <div className="flex-1 text-sm leading-relaxed">
                <p className="font-semibold text-xs uppercase tracking-wider mb-0.5 opacity-80">
                  {notification.type === 'online' ? 'Cloud Enabled' : 'Offline Mode'}
                </p>
                <p className="text-xs">{notification.message}</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="p-1 rounded-sm hover:bg-black/5 dark:hover:bg-white/10 text-current/60 hover:text-current transition-colors"
                aria-label="Dismiss Notification"
                style={{ width: 44, height: 44 }}
                id="dismiss-connection-toast"
              >
                <X className="w-4 h-4 mx-auto" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
