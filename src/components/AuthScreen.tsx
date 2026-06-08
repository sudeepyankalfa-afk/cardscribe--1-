/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../stores/authStore';
import { 
  KeyRound, 
  UserPlus, 
  LogIn, 
  ScanLine, 
  User, 
  FileText, 
  ArrowRight, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle, 
  BookOpen,
  Eye,
  EyeOff
} from 'lucide-react';

export function AuthScreen() {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('signup'); // Default to signup to help them register initially as instructed!
  
  // Input fields state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { login, signup, authError, clearError, isLoading } = useAuthStore();

  const handleToggleTab = (tab: 'login' | 'signup') => {
    setActiveTab(tab);
    clearError();
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg(null);

    if (activeTab === 'signup') {
      const ok = await signup(username, password, fullName);
      if (ok) {
        setSuccessMsg('Account created successfully! Logging you in...');
      }
    } else {
      const ok = await login(username, password);
      if (ok) {
        setSuccessMsg('Successfully authenticated! Welcome back.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 sm:p-6 md:p-12 font-sans" id="auth-screen-root">
      <div className="max-w-5xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch" id="auth-grid-container">
        
        {/* Left Side: Elegant Guide & Instructions Panel (answers user's specific workflow question) */}
        <div className="md:col-span-5 flex flex-col justify-between bg-zinc-900 text-white p-6 sm:p-8 rounded-2xl shadow-xl relative overflow-hidden" id="auth-guide-panel">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.1),transparent_40%)]" />
          
          <div className="relative z-10 flex-1 flex flex-col justify-between">
            {/* Logo */}
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-950" id="auth-brand-badge">
                  <ScanLine className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">CardScribe</h1>
                  <p className="text-[10px] text-zinc-400 font-medium tracking-widest uppercase">Safe Business Scan</p>
                </div>
              </div>

              <h2 className="text-xl font-bold text-slate-100 tracking-tight leading-snug">
                Private Business Card Indexer
              </h2>
              <p className="text-xs text-zinc-400 mt-2.5 leading-relaxed">
                Scan, analyze, and catalog physical cards locally. Build your private directory securely stored inside your local sandboxed browser instance. No external trackers, total ownership.
              </p>
            </div>

            {/* Privacy Shield Info block */}
            <div className="mt-8 pt-4 border-t border-zinc-800 flex items-start gap-2 text-[10px] text-zinc-500 leading-relaxed">
              <BookOpen className="w-4 h-4 text-zinc-400 shrink-0" />
              <span>
                All credentials and scanned business profiles are securely stored locally inside your browser's dedicated sandboxed database. No sensitive plain passwords ever leave your client device.
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Interactive Forms Panel */}
        <div className="md:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md flex flex-col justify-center p-6 sm:p-10" id="auth-forms-panel">
          
          {/* Tab Selector Buttons */}
          <div className="flex items-center border-b border-slate-100 dark:border-slate-800 mb-8" id="auth-tab-row">
            <button
              onClick={() => handleToggleTab('signup')}
              className={`flex-1 pb-4 text-center text-sm font-bold tracking-tight transition-all relative border-none bg-transparent cursor-pointer ${
                activeTab === 'signup'
                  ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                  : 'text-slate-450 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-350'
              }`}
              id="auth-signup-tab-btn"
            >
              <div className="flex items-center justify-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </div>
              {activeTab === 'signup' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 dark:bg-blue-500 rounded-full"
                />
              )}
            </button>
            <button
              onClick={() => handleToggleTab('login')}
              className={`flex-1 pb-4 text-center text-sm font-bold tracking-tight transition-all relative border-none bg-transparent cursor-pointer ${
                activeTab === 'login'
                  ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                  : 'text-slate-450 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-350'
              }`}
              id="auth-login-tab-btn"
            >
              <div className="flex items-center justify-center gap-2">
                <LogIn className="w-4 h-4" />
                <span>Login</span>
              </div>
              {activeTab === 'login' && (
                <motion.div
                  layoutId="activeTabUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-blue-600 dark:bg-blue-500 rounded-full"
                />
              )}
            </button>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
              {activeTab === 'signup' ? (
                <>
                  <UserPlus className="w-5 h-5 text-blue-500" />
                  <span>Interactive Account Signup</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5 text-blue-500" />
                  <span>Secure Account login</span>
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === 'signup' 
                ? 'Register your unique local profile ID here to isolate and save parsed contacts.'
                : 'Input your established credentials to decode and fetch your scans inventory.'}
            </p>
          </div>

          {/* Feedback Indicators */}
          <div className="space-y-3 mb-6" id="auth-alert-indicators">
            {authError && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-950/30 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-455" id="auth-error-block">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-semibold">{authError}</div>
              </div>
            )}

            {successMsg && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-950/30 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-455" id="auth-success-block">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <div className="leading-relaxed font-semibold">{successMsg}</div>
              </div>
            )}
          </div>

          {/* Core inputs Form */}
          <form onSubmit={handleSubmit} className="space-y-4" id="credentials-main-form">
            
            {activeTab === 'signup' && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Full Name
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Sudeep Yankalfa"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-205 dark:border-slate-800 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 bg-transparent text-sm text-slate-850 dark:text-slate-100"
                    id="signup-input-fullname"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                User ID (Username)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={activeTab === 'signup' ? 'Choose User ID (e.g. sudeep123)' : 'Enter User ID'}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-205 dark:border-slate-800 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 bg-transparent text-sm text-slate-850 dark:text-slate-100"
                  id="auth-input-username"
                />
              </div>
              {activeTab === 'signup' && (
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Letters, numbers, and underscores only. Minimum 3 characters.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={activeTab === 'signup' ? 'Set secret code (at least 5 chars)' : 'Enter password'}
                  className="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-205 dark:border-slate-800 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 bg-transparent text-sm text-slate-850 dark:text-slate-100"
                  id="auth-input-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  title={showPassword ? "Hide password" : "Show password"}
                  id="password-visibility-toggler"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Form submission Trigger */}
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-3.5 px-4 mt-6 rounded-xl font-bold text-sm tracking-wide text-white uppercase shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                isLoading 
                  ? 'bg-slate-350 dark:bg-slate-800 border border-slate-250 dark:border-slate-750'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99] border-none'
              }`}
              id="auth-submission-action"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-slate-100 border-t-transparent animate-spin" />
                  <span>Processing Registry...</span>
                </>
              ) : (
                <>
                  {activeTab === 'signup' ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Account Initially</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Log In securely</span>
                    </>
                  )}
                </>
              )}
            </button>
          </form>

          {/* Context help switch */}
          <div className="mt-6 text-center border-t border-slate-100 dark:border-slate-800 pt-5">
            <p className="text-xs text-slate-450 dark:text-slate-450">
              {activeTab === 'signup' ? (
                <>
                  Already registered an initial password account?{' '}
                  <button
                    onClick={() => handleToggleTab('login')}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
                    id="switch-to-login-inline-btn"
                  >
                    Click to Login
                  </button>
                </>
              ) : (
                <>
                  Do not have your user workspace yet?{' '}
                  <button
                    onClick={() => handleToggleTab('signup')}
                    className="text-blue-600 dark:text-blue-400 font-bold hover:underline bg-transparent border-none p-0 cursor-pointer"
                    id="switch-to-signup-inline-btn"
                  >
                    Click to Create Account
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
