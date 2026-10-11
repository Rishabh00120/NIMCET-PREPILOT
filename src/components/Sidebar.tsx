import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  Map,
  Clock,
  CheckSquare,
  Calendar,
  BookMarked,
  Award,
  RotateCcw,
  BarChart3,
  Settings,
  Flame,
  ChevronRight,
  Compass,
  Zap,
  Library,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NavSection } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.FC<{ className?: string }>;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    name: 'OVERVIEW',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'focus', label: 'Focus Mode', icon: Zap },
    ],
  },
  {
    name: 'STUDY PLAN',
    items: [
      { id: 'syllabus', label: 'My Syllabus', icon: BookOpen },
      { id: 'roadmap', label: 'Monthly Roadmap', icon: Map },
      { id: 'timetable', label: 'Daily Timetable', icon: Clock },
      { id: 'tasks', label: 'To-Do List', icon: CheckSquare },
      { id: 'calendar', label: 'Calendar', icon: Calendar },
    ],
  },
  {
    name: 'PRACTICE',
    items: [
      { id: 'pyq_library', label: 'PYQ Library', icon: Library },
      { id: 'pyq', label: 'PYQ Tracker', icon: BookMarked },
      { id: 'mocks', label: 'Test Series & Mocks', icon: Award },
    ],
  },
  {
    name: 'REVIEW & INSIGHTS',
    items: [
      { id: 'revision', label: 'Revision & Errors', icon: RotateCcw },
      { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
    ],
  },
  {
    name: 'SETTINGS',
    items: [
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const {
    activeSection,
    setActiveSection,
    currentStudyStreak,
    daysRemainingUntilExam,
  } = useApp();

  // Clean up any previously stored collapsed preference so it cannot affect layout
  useEffect(() => {
    try {
      localStorage.removeItem('preppilot_sidebar_collapsed');
    } catch {
      // ignore
    }
  }, []);

  // Close drawer with Escape key on mobile / overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const renderNavGroup = (group: NavGroup, isDrawer: boolean) => {
    return (
      <div key={group.name} className="py-1">
        <div className="px-3 pb-1.5 pt-2 text-[10px] font-bold tracking-wider text-slate-400/90 dark:text-slate-500 uppercase select-none">
          {group.name}
        </div>
        <div className="space-y-0.5">
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const isSettings = item.id === 'settings';

            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  if (isDrawer) {
                    onClose();
                  }
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-medium transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive
                        ? 'text-white'
                        : isSettings
                        ? 'text-slate-400 group-hover:text-slate-200'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  />
                  <span className="truncate text-[12px]">{item.label}</span>
                </div>

                {isActive && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-200 ml-1.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ======================================================== */}
      {/* 1. MOBILE SLIDE-OUT DRAWER                               */}
      {/* ======================================================== */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-slate-950 text-slate-200 transition-transform duration-200 ease-in-out lg:hidden ${
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
        aria-label="Mobile Navigation"
      >
        {/* Mobile Header with brand & Close button */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/90 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs shrink-0">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">PrepPilot</span>
              <span className="block text-xs font-medium text-slate-400">NIMCET 2027</span>
            </div>
          </div>

          <button
            onClick={onClose}
            title="Close Navigation"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mobile Streak Strip */}
        <div className="shrink-0 border-b border-slate-800/80 bg-slate-900/60 px-4 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <Flame className="h-3.5 w-3.5 fill-amber-400 shrink-0" />
              <span>{currentStudyStreak} Day Streak</span>
            </div>
            <div className="text-slate-400 tabular-nums text-[11px]">
              {daysRemainingUntilExam !== null ? (
                <span>{daysRemainingUntilExam}d to Exam</span>
              ) : (
                <span className="text-blue-400">May 2027</span>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Navigation List (Scrolls independently) */}
        <nav className="sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-1">
          {NAV_GROUPS.map((group) => renderNavGroup(group, true))}
        </nav>

        {/* Mobile Footer */}
        <div className="shrink-0 border-t border-slate-800/80 p-3.5 space-y-2">
          <PWAInstallButton variant="sidebar" />
          <div className="rounded-lg bg-slate-900/80 p-2.5 text-[11px] border border-slate-800/90 text-slate-400">
            <div className="text-slate-300 font-medium">Target Exam: May 2027</div>
            <div className="mt-0.5 text-[10px]">Window: 14:00–21:00 &amp; 23:00–00:00</div>
          </div>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. DESKTOP PERMANENTLY EXPANDED SIDEBAR                  */}
      {/* ======================================================== */}
      <aside
        className="hidden lg:flex sticky top-0 h-screen w-64 min-w-[16rem] shrink-0 flex-col bg-slate-950 text-slate-200 border-r border-slate-800/80 z-20 overflow-hidden"
        aria-label="Desktop Navigation"
      >
        {/* Brand Area */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/90 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Compass className="h-5 w-5" />
            </div>
            <div className="truncate">
              <span className="text-sm font-bold tracking-tight text-white block truncate">PrepPilot</span>
              <span className="block text-[11px] font-medium text-slate-400 truncate">NIMCET 2027</span>
            </div>
          </div>
        </div>

        {/* Quick Streak Strip */}
        <div className="shrink-0 border-b border-slate-800/80 bg-slate-900/60 px-4 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <Flame className="h-3.5 w-3.5 fill-amber-400 shrink-0" />
              <span>{currentStudyStreak} Day Streak</span>
            </div>
            <div className="text-slate-400 tabular-nums text-[11px]">
              {daysRemainingUntilExam !== null ? (
                <span>{daysRemainingUntilExam}d left</span>
              ) : (
                <span className="text-blue-400">May 2027</span>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Items (Grouped, thin custom scrollbar, no horizontal overflow) */}
        <nav className="sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 py-3 space-y-1">
          {NAV_GROUPS.map((group) => renderNavGroup(group, false))}
        </nav>

        {/* Desktop Footer with PWA button & version info */}
        <div className="shrink-0 border-t border-slate-800/80 p-3 space-y-2">
          <PWAInstallButton variant="sidebar" />

          <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 font-mono">
            <span>PrepPilot v1.2</span>
            <span>NIMCET 2027</span>
          </div>
        </div>
      </aside>
    </>
  );
};
