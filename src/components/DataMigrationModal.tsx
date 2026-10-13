import React, { useState } from 'react';
import {
  Cloud,
  HardDrive,
  GitMerge,
  ArrowUpCircle,
  ArrowDownCircle,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getDataSummary } from '../services/firebase';

export const DataMigrationModal: React.FC = () => {
  const { migrationPrompt, resolveMigration, syncErrorMessage } = useApp();
  const [loadingStrategy, setLoadingStrategy] = useState<'merge' | 'upload_local' | 'use_cloud' | null>(null);

  if (!migrationPrompt || !migrationPrompt.isOpen) return null;

  const { localData, remoteData, isRemoteEmpty, user } = migrationPrompt;

  const localSummary = getDataSummary(localData);
  const remoteSummary = getDataSummary(remoteData);

  const handleSelect = async (strategy: 'merge' | 'upload_local' | 'use_cloud') => {
    setLoadingStrategy(strategy);
    try {
      await resolveMigration(strategy);
    } finally {
      setLoadingStrategy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="migration-modal-title"
        className="relative w-full max-w-xl rounded-2xl border border-blue-900/60 bg-slate-900 p-6 sm:p-7 text-slate-100 shadow-2xl my-8 overflow-hidden"
      >
        {/* Glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
            <GitMerge className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-400">
                Safe Study Data Migration
              </span>
              <span className="rounded-md bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Local Backup Created
              </span>
            </div>
            <h2 id="migration-modal-title" className="text-base sm:text-lg font-bold text-white mt-0.5">
              {isRemoteEmpty
                ? 'Sync Existing Study Data to Your Cloud Account'
                : 'Choose How to Synchronize Your Preparation'}
            </h2>
          </div>
        </div>

        {/* Reassuring Backup Notice */}
        <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 text-xs text-slate-300">
          <div className="flex items-center gap-2 font-semibold text-white mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Pre-Migration Safety Backup Saved</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Your current preparation records on this browser were automatically backed up to local storage.
            You can view or restore this backup at any time from <strong>Settings &gt; Data Management</strong>.
          </p>
        </div>

        {/* Sync Error Alert if migration write failed */}
        {syncErrorMessage && (
          <div className="mb-4 rounded-xl border border-rose-800/80 bg-rose-950/70 p-3.5 text-xs text-rose-200 animate-fade-in">
            <div className="flex items-center gap-2 font-semibold text-rose-300 mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Migration Synchronization Issue</span>
            </div>
            <p className="text-rose-200/90 leading-relaxed font-mono text-[11px] break-all">
              {syncErrorMessage}
            </p>
            <p className="mt-1.5 text-[11px] text-rose-300">
              Your local records and backup remain completely preserved. You can safely retry below.
            </p>
          </div>
        )}

        {/* Side-by-side data comparison */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-xs">
          {/* Local Device Summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 font-bold text-blue-300 mb-2.5">
              <HardDrive className="w-4 h-4 text-blue-400" />
              <span>This Device (Local)</span>
            </div>
            <ul className="space-y-1.5 text-slate-300 text-[11px]">
              <li className="flex justify-between">
                <span className="text-slate-400">Preparation Tasks:</span>
                <strong className="text-white font-mono">{localSummary.taskCount}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">Completed Topics:</span>
                <strong className="text-white font-mono">{localSummary.completedTopicsCount}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">Study Sessions:</span>
                <strong className="text-white font-mono">{localSummary.sessionCount}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">PYQ Paper Attempts:</span>
                <strong className="text-white font-mono">{localSummary.pyqPaperAttemptCount}</strong>
              </li>
              <li className="flex justify-between">
                <span className="text-slate-400">Mock Tests:</span>
                <strong className="text-white font-mono">{localSummary.mockCount}</strong>
              </li>
            </ul>
          </div>

          {/* Cloud Summary */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center gap-2 font-bold text-indigo-300 mb-2.5">
              <Cloud className="w-4 h-4 text-indigo-400" />
              <span>Cloud Account ({user.email || 'Google'})</span>
            </div>
            {isRemoteEmpty ? (
              <div className="h-full flex flex-col justify-center text-slate-400 text-[11px] py-3">
                <p className="italic">No existing preparation records found in your cloud account.</p>
                <p className="mt-2 text-emerald-400 font-medium">Ready to receive your local preparation!</p>
              </div>
            ) : (
              <ul className="space-y-1.5 text-slate-300 text-[11px]">
                <li className="flex justify-between">
                  <span className="text-slate-400">Preparation Tasks:</span>
                  <strong className="text-white font-mono">{remoteSummary.taskCount}</strong>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-400">Completed Topics:</span>
                  <strong className="text-white font-mono">{remoteSummary.completedTopicsCount}</strong>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-400">Study Sessions:</span>
                  <strong className="text-white font-mono">{remoteSummary.sessionCount}</strong>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-400">PYQ Paper Attempts:</span>
                  <strong className="text-white font-mono">{remoteSummary.pyqPaperAttemptCount}</strong>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-400">Mock Tests:</span>
                  <strong className="text-white font-mono">{remoteSummary.mockCount}</strong>
                </li>
              </ul>
            )}
          </div>
        </div>

        {/* Action Strategy Choices */}
        <div className="space-y-3">
          {/* Option 1: Smart Merge (Recommended if both have data) */}
          {!isRemoteEmpty && (
            <button
              type="button"
              onClick={() => handleSelect('merge')}
              disabled={loadingStrategy !== null}
              className="w-full text-left p-3.5 rounded-xl border border-blue-600/70 bg-gradient-to-r from-blue-950/60 to-slate-900 hover:border-blue-500 hover:bg-blue-950/80 transition-all cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 font-bold text-xs text-white">
                  <GitMerge className="w-4 h-4 text-blue-400" />
                  <span>Smart Merge (Recommended)</span>
                </div>
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Safest Choice
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-300 pl-6.5">
                Combines both datasets without data loss: preserves all unique tasks, merges study hours, and keeps the union of completed syllabus topics and test attempts.
              </p>
              {loadingStrategy === 'merge' && (
                <div className="mt-2 pl-6.5 flex items-center gap-2 text-xs text-blue-400 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Merging and syncing...</span>
                </div>
              )}
            </button>
          )}

          {/* Option 2: Upload Local Data (Primary if remote empty) */}
          <button
            type="button"
            onClick={() => handleSelect('upload_local')}
            disabled={loadingStrategy !== null}
            className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer group disabled:opacity-50 ${
              isRemoteEmpty
                ? 'border-blue-600/70 bg-blue-950/60 hover:bg-blue-900/60'
                : 'border-slate-800 bg-slate-950/50 hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-bold text-xs text-white">
                <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                <span>Upload Local Preparation to Cloud</span>
              </div>
              {isRemoteEmpty && (
                <span className="rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Recommended
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-slate-400 pl-6.5">
              Uploads all study records from this device into Cloud Firestore so they appear on your phone and laptop.
            </p>
            {loadingStrategy === 'upload_local' && (
              <div className="mt-2 pl-6.5 flex items-center gap-2 text-xs text-emerald-400 font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading to Cloud Firestore...</span>
              </div>
            )}
          </button>

          {/* Option 3: Download Cloud Data (Only if remote has data) */}
          {!isRemoteEmpty && (
            <button
              type="button"
              onClick={() => handleSelect('use_cloud')}
              disabled={loadingStrategy !== null}
              className="w-full text-left p-3.5 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-800/60 transition-all cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center gap-2.5 font-bold text-xs text-white">
                <ArrowDownCircle className="w-4 h-4 text-indigo-400" />
                <span>Use Cloud Data (Replace Local)</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 pl-6.5">
                Replaces this browser's records with the current Cloud Firestore records. (A safety backup of this device's records remains saved locally).
              </p>
              {loadingStrategy === 'use_cloud' && (
                <div className="mt-2 pl-6.5 flex items-center gap-2 text-xs text-indigo-400 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Downloading cloud records...</span>
                </div>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
