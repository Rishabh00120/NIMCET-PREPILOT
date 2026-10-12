import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Compass,
  Laptop,
  Smartphone,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalMode,
    closeAuthModal,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    sendPasswordReset,
    resendVerificationEmail,
    checkEmailVerification,
    currentUser,
    syncStatusState,
    isFirebaseConfigured,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'login' | 'signup' | 'forgot_password' | 'verify_email'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync tab with context mode
  useEffect(() => {
    if (authModalMode) {
      setActiveTab(authModalMode);
    }
  }, [authModalMode]);

  // Reset inputs on modal open/close & handle Escape key
  useEffect(() => {
    if (!authModalOpen) {
      setErrorMsg(null);
      setSuccessMsg(null);
      setPassword('');
      setConfirmPassword('');
      return;
    }

    if (currentUser && !currentUser.emailVerified && activeTab === 'verify_email') {
      setEmail(currentUser.email || '');
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authModalOpen, currentUser, activeTab, closeAuthModal]);

  if (!authModalOpen) return null;

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setGoogleLoading(true);

    try {
      const res = await signInWithGoogle();
      if (res.success) {
        closeAuthModal();
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google sign-in could not be completed.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await signInWithEmail(email, password);
      if (res.success) {
        closeAuthModal();
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('Please enter an email address and choose a password.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await signUpWithEmail(email, password, displayName);
      if (res.success) {
        if (res.verificationSent) {
          setSuccessMsg('Account created successfully! A verification link has been sent to your email address.');
        } else {
          setSuccessMsg('Account created successfully! Please verify your email to enable password recovery.');
        }
        setActiveTab('verify_email');
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Account registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setErrorMsg('Please enter the email address associated with your account.');
      return;
    }

    setLoading(true);
    try {
      const res = await sendPasswordReset(email);
      if (res.success) {
        setSuccessMsg(
          'Password reset link has been dispatched! Please check your email inbox and spam folder.'
        );
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await resendVerificationEmail();
      if (res.success) {
        setSuccessMsg('A new verification email has been sent. Please check your inbox.');
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send verification email.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await checkEmailVerification();
      if (res.verified) {
        setSuccessMsg('Email verified successfully! You are all set.');
        setTimeout(() => {
          closeAuthModal();
        }, 1200);
      } else {
        setErrorMsg('Email is not verified yet. Please click the link in your email first.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not refresh verification status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 lg:p-6 bg-slate-950/85 backdrop-blur-md overflow-y-auto auth-modal-scroll"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-command-center-title"
        className="relative w-full max-w-5xl rounded-2xl sm:rounded-3xl border border-slate-800/90 bg-[#080d1a] shadow-2xl shadow-blue-950/30 text-slate-100 overflow-hidden my-auto flex flex-col"
        style={{
          maxHeight: 'min(92vh, calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 1.25rem))',
        }}
      >
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-20 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Close authentication dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Split Screen Container — Dedicated vertical scrolling element with .auth-modal-scroll */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 overflow-y-auto overflow-x-hidden auth-modal-scroll min-h-0">
          {/* =============================================================== */}
          {/* LEFT BRANDING PANEL — PrepPilot Study Command Center           */}
          {/* =============================================================== */}
          <div className="lg:col-span-5 relative bg-gradient-to-b from-[#0b1329] via-[#091024] to-[#060a17] border-b lg:border-b-0 lg:border-r border-slate-800/80 p-5 sm:p-7 lg:p-7.5 flex flex-col justify-between overflow-hidden">
            {/* Background Decorative Grid Accent */}
            <div
              className="absolute inset-0 opacity-[0.035] pointer-events-none bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]"
              aria-hidden="true"
            />

            {/* Top Brand Identity */}
            <div>
              <div className="flex items-center gap-3 mb-4 sm:mb-5">
                <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 ring-1 ring-blue-400/30">
                  <Compass className="h-5 w-5 sm:h-6 sm:w-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="text-[11px] font-mono font-bold tracking-widest uppercase text-blue-400">
                    PREPPILOT • NIMCET 2027
                  </div>
                  <div className="text-xs font-medium text-slate-400">
                    Study Command Center
                  </div>
                </div>
              </div>

              {/* Large Headline & Supporting Copy */}
              <h1
                id="auth-command-center-title"
                className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-tight mb-2 sm:mb-2.5"
              >
                Your next milestone starts here.
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md">
                Keep your NIMCET preparation organised. Sign in to connect your syllabus milestones,
                revision schedules, PYQ tracker, and mock test analytics across devices.
              </p>
            </div>

            {/* Middle: Abstract Study Journey Geometric Illustration (Desktop/Tablet) */}
            <div className="my-3 sm:my-4 lg:my-3.5 hidden sm:block relative">
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3.5 sm:p-4 relative overflow-hidden">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-2">
                  <span className="flex items-center gap-1.5 text-blue-400 font-mono text-[10px] uppercase tracking-wider">
                    <Layers className="w-3.5 h-3.5" />
                    Study Roadmap &amp; Device Bridge
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                    <ShieldCheck className="w-3 h-3" />
                    Local-First
                  </span>
                </div>

                {/* Inline SVG Vector: Command Center Orbital Trajectory */}
                <svg
                  className="w-full h-26 sm:h-28 text-slate-700"
                  viewBox="0 0 380 130"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#2563eb" stopOpacity="0.8" />
                      <stop offset="50%" stopColor="#6366f1" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
                    </linearGradient>
                    <linearGradient id="glowPulse" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Coordinate grid lines */}
                  <line x1="20" y1="105" x2="360" y2="105" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="20" y1="65" x2="360" y2="65" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                  <line x1="20" y1="25" x2="360" y2="25" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />

                  {/* Primary Trajectory Curve */}
                  <path
                    d="M 25 105 C 100 95, 140 45, 210 50 C 270 55, 310 30, 355 25"
                    stroke="url(#orbitGrad)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  {/* Area fill under curve */}
                  <path
                    d="M 25 105 C 100 95, 140 45, 210 50 C 270 55, 310 30, 355 25 L 355 105 Z"
                    fill="url(#glowPulse)"
                  />

                  {/* Node 1: Concepts */}
                  <circle cx="25" cy="105" r="4" fill="#3b82f6" />
                  <circle cx="25" cy="105" r="8" stroke="#3b82f6" strokeWidth="1" strokeOpacity="0.4" />
                  <text x="32" y="118" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                    Foundation
                  </text>

                  {/* Node 2: Speed Practice */}
                  <circle cx="150" cy="58" r="4.5" fill="#6366f1" />
                  <circle cx="150" cy="58" r="9" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.4" />
                  <text x="135" y="76" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                    PYQs 2011–26
                  </text>

                  {/* Node 3: Simulation */}
                  <circle cx="275" cy="46" r="4.5" fill="#0ea5e9" />
                  <circle cx="275" cy="46" r="9" stroke="#0ea5e9" strokeWidth="1" strokeOpacity="0.4" />
                  <text x="250" y="34" fill="#94a3b8" fontSize="9" fontFamily="monospace">
                    Mock Series
                  </text>

                  {/* Node 4: Target Exam */}
                  <circle cx="355" cy="25" r="5" fill="#38bdf8" />
                  <circle cx="355" cy="25" r="11" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="2 2" />
                  <text x="325" y="14" fill="#38bdf8" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    NIMCET 2027
                  </text>
                </svg>

                {/* Device sync status strip */}
                <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Laptop className="w-3.5 h-3.5 text-blue-400" />
                    <span>Laptop</span>
                    <span className="text-slate-600">↔</span>
                    <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                    <span>Phone</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[10px]">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        !currentUser
                          ? 'bg-amber-400'
                          : syncStatusState === 'synced'
                          ? 'bg-emerald-400'
                          : syncStatusState === 'syncing' || syncStatusState === 'signing_in'
                          ? 'bg-blue-400 animate-pulse'
                          : syncStatusState === 'error'
                          ? 'bg-rose-400'
                          : 'bg-slate-500'
                      }`}
                    />
                    <span
                      className={
                        !currentUser
                          ? 'text-slate-400'
                          : syncStatusState === 'synced'
                          ? 'text-emerald-400 font-semibold'
                          : syncStatusState === 'syncing' || syncStatusState === 'signing_in'
                          ? 'text-blue-400'
                          : syncStatusState === 'error'
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }
                    >
                      {!currentUser
                        ? 'Cloud sync available after sign-in'
                        : syncStatusState === 'synced'
                        ? 'Cloud Synced'
                        : syncStatusState === 'syncing' || syncStatusState === 'signing_in'
                        ? 'Synchronising...'
                        : syncStatusState === 'error'
                        ? 'Sync Issue'
                        : 'Local-only'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom: Four NIMCET Subjects & Feature Strip */}
            <div className="pt-3 sm:pt-3.5 border-t border-slate-800/70">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-1.5 sm:mb-2">
                NIMCET Syllabus Coverage
              </div>
              {/* Clean unboxed typography for subjects — Zero static candy pills */}
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 text-xs text-slate-300">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="truncate">Mathematics</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <span className="truncate">Analytical Reasoning</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                  <span className="truncate">Computer Awareness</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">General English</span>
                </div>
              </div>

              {/* Concise non-numeric feature strip */}
              <div className="mt-3 sm:mt-3.5 pt-2 sm:pt-2.5 border-t border-slate-800/50 flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-400 tracking-wide">
                  Plan <span className="text-blue-500">·</span> Practise <span className="text-blue-500">·</span> Improve
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  v1.0 Ready
                </span>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* RIGHT AUTHENTICATION PANEL — Interactive Form Controls         */}
          {/* =============================================================== */}
          <div className="lg:col-span-7 p-5 sm:p-7 lg:p-7.5 flex flex-col justify-center bg-[#080d1a]">
            {/* Header copy based on activeTab */}
            <div className="mb-3.5 sm:mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {activeTab === 'login' && 'Welcome back'}
                {activeTab === 'signup' && 'Create your account'}
                {activeTab === 'forgot_password' && 'Reset your password'}
                {activeTab === 'verify_email' && 'Verify your email'}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed">
                {activeTab === 'login' && 'Pick up where your NIMCET preparation left off.'}
                {activeTab === 'signup' && 'Connect your preparation progress across phone and laptop.'}
                {activeTab === 'forgot_password' &&
                  'Enter your registered email address to receive password reset instructions.'}
                {activeTab === 'verify_email' &&
                  'Confirm your email to enable password recovery and protect your account.'}
              </p>
            </div>

            {/* Notification & Status Alerts */}
            {errorMsg && (
              <div className="mb-3.5 sm:mb-4 flex items-start gap-3 rounded-2xl border border-rose-900/60 bg-rose-950/40 p-3 sm:p-3.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-3.5 sm:mb-4 flex items-start gap-3 rounded-2xl border border-emerald-900/60 bg-emerald-950/40 p-3 sm:p-3.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successMsg}</span>
              </div>
            )}

            {!isFirebaseConfigured && (
              <div className="mb-3.5 sm:mb-4 flex items-start gap-3 rounded-2xl border border-amber-900/50 bg-amber-950/30 p-3 sm:p-3.5 text-xs text-amber-300">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <span className="font-semibold text-white">Local-First Mode Active:</span> Firebase environment configuration is pending. You can continue studying in Guest Mode with full local persistence.
                </div>
              </div>
            )}

            {/* Google Authentication Button (Login and Sign-up modes) */}
            {(activeTab === 'login' || activeTab === 'signup') && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-2.5 sm:gap-3 py-2.5 sm:py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm text-white bg-slate-900 hover:bg-slate-800/90 border border-slate-700/80 hover:border-blue-500/50 transition-all cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {googleLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
                  ) : (
                    <svg className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                  )}
                  <span>{googleLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
                </button>

                {/* Single-Line Email Divider — Strictly prevents awkward word wrapping */}
                <div className="relative my-3 sm:my-3.5 flex items-center">
                  <div className="flex-grow border-t border-slate-800" />
                  <span className="shrink-0 px-2.5 sm:px-3 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-500 whitespace-nowrap select-none">
                    OR CONTINUE WITH EMAIL
                  </span>
                  <div className="flex-grow border-t border-slate-800" />
                </div>

                {/* Segmented Switcher: Sign In vs Create Account */}
                <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800 mb-3 sm:mb-3.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className={`py-1.5 sm:py-2 rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'login'
                        ? 'bg-blue-600 text-white shadow-xs font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signup');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className={`py-1.5 sm:py-2 rounded-lg transition-colors cursor-pointer ${
                      activeTab === 'signup'
                        ? 'bg-blue-600 text-white shadow-xs font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              </>
            )}

            {/* TAB: LOGIN FORM */}
            {activeTab === 'login' && (
              <form onSubmit={handleEmailSignIn} className="space-y-3.5 sm:space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="aspirant@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-xs font-medium text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('forgot_password');
                        setErrorMsg(null);
                        setSuccessMsg(null);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer focus-visible:outline-hidden"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full mt-1.5 sm:mt-2 py-2.5 sm:py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{loading ? 'Signing in...' : 'Sign In with Email'}</span>
                </button>
              </form>
            )}

            {/* TAB: SIGN UP FORM */}
            {activeTab === 'signup' && (
              <form onSubmit={handleEmailSignUp} className="space-y-3 sm:space-y-3.5">
                <div>
                  <label htmlFor="signup-name" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Full Name <span className="text-slate-500">(Optional)</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Arjun Sharma"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="signup-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      id="signup-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="aspirant@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                  <div>
                    <label htmlFor="signup-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Password <span className="text-slate-500">(min 6)</span>
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                      <input
                        id="signup-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="signup-confirm-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                      <input
                        id="signup-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-0.5"
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || googleLoading}
                  className="w-full mt-1.5 sm:mt-2 py-2.5 sm:py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/30 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{loading ? 'Creating Account...' : 'Create Account'}</span>
                </button>
              </form>
            )}

            {/* TAB: FORGOT PASSWORD */}
            {activeTab === 'forgot_password' && (
              <form onSubmit={handlePasswordReset} className="space-y-3.5 sm:space-y-4">
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                    Registered Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-500" />
                    <input
                      id="reset-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="aspirant@example.com"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-hidden focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-md shadow-blue-600/25 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                  <span>{loading ? 'Sending Instructions...' : 'Send Password Reset Email'}</span>
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('login');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            )}

            {/* TAB: EMAIL VERIFICATION */}
            {activeTab === 'verify_email' && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-blue-900/60 bg-blue-950/30 p-4 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-blue-300 text-sm">
                    <Mail className="w-4 h-4" />
                    <span>Verification Link Sent</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed">
                    A confirmation link was dispatched to{' '}
                    <strong className="text-white font-mono break-all">{email || currentUser?.email}</strong>. Please check your inbox
                    and spam folders, and click the link to verify your account.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleCheckVerification}
                    disabled={loading}
                    className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                    <span>I&apos;ve Verified My Email</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={loading}
                    className="w-full py-2 sm:py-2.5 px-4 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-750 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Resend Verification Link
                  </button>

                  <button
                    type="button"
                    onClick={closeAuthModal}
                    className="w-full py-1.5 sm:py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Continue to App for Now
                  </button>
                </div>
              </div>
            )}

            {/* GUEST MODE: Secondary, Honest, Non-Destructive Action */}
            {(activeTab === 'login' || activeTab === 'signup') && (
              <div className="mt-4 pt-3.5 sm:mt-5 sm:pt-4 border-t border-slate-800/80 text-center pb-1 sm:pb-2">
                <button
                  type="button"
                  onClick={closeAuthModal}
                  className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer inline-flex items-center gap-1.5 group"
                >
                  <span>Continue in Guest Mode (Local Only)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5" />
                </button>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-normal">
                  Your preparation records remain saved securely in this browser&apos;s local storage until you link a cloud account.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
