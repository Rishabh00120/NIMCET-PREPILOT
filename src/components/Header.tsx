import React from 'react';
import { Menu, Bell, Play, Calendar as CalendarIcon, Zap } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  onToggleSidebar: () => void;
  onOpenNotifications: () => void;
}

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Preparation Overview',
  focus: 'Distraction-Free Focus Mode & Pomodoro',
  syllabus: 'Official NIMCET Syllabus Tracker',
  roadmap: 'Monthly Preparation Roadmap (Oct 2026 – May 2027)',
  timetable: 'Daily Timetable & Study Sessions',
  tasks: 'Preparation To-Do List & Tasks',
  calendar: 'Study Calendar & Deadlines',
  pyq: 'Previous Year Questions (PYQ) Tracker',
  pyq_library: 'Previous Year Papers Library (2011–2026)',
  mocks: 'Test Series & Mock Exam Tracker',
  revision: 'Spaced Revision Centre & Error Log',
  analytics: 'Preparation Analytics & Reports',
  settings: 'Planner Settings & Data Management',
};

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onOpenNotifications }) => {
  const {
    activeSection,
    continueStudying,
    notifications,
    daysRemainingUntilExam,
    userConfig,
    setActiveSection,
  } = useApp();

  const unreadCount = notifications.filter((n) => !n.read && !n.dismissed).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:px-6">
      {/* Zone 1: Mobile Hamburger & Breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-900 dark:text-white capitalize">
            {activeSection}
          </span>
          <span aria-hidden="true">·</span>
          <span className="hidden sm:inline text-slate-600 dark:text-slate-300">
            {SECTION_TITLES[activeSection] || 'Study Planner'}
          </span>
        </div>
      </div>

      {/* Zone 2: Center Quick Countdown / Status */}
      <div className="hidden md:flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
        <CalendarIcon className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        {userConfig.exactExamDate && daysRemainingUntilExam !== null ? (
          <span>
            NIMCET 2027 in <strong className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">{daysRemainingUntilExam} days</strong>
          </span>
        ) : (
          <button
            onClick={() => setActiveSection('settings')}
            className="hover:underline text-slate-500 dark:text-slate-400 text-xs"
          >
            Exam Target: May 2027 (Click to set exact date)
          </button>
        )}
      </div>

      {/* Zone 3: PWA Install, Focus quick button, Notification Bell & Continue Studying */}
      <div className="flex items-center gap-2">
        <PWAInstallButton />

        <button
          onClick={() => setActiveSection('focus')}
          className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-2xs transition-colors"
          title="Distraction-Free Focus Chamber"
        >
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span>Focus Mode</span>
        </button>

        <button
          onClick={onOpenNotifications}
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
          title="Notification Centre"
          aria-label="View notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={continueStudying}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 whitespace-nowrap active:scale-[0.98]"
        >
          <Play className="h-3.5 w-3.5 fill-white" />
          <span>Continue</span>
        </button>
      </div>
    </header>
  );
};
