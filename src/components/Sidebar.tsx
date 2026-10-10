import React, { useState, useEffect } from 'react';
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
  Sun,
  Moon,
  Compass,
  Zap,
  Library,
  ChevronLeft,
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
    userConfig,
    updateUserConfig,
  } = useApp();

  // Desktop collapsed state preference saved to localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('preppilot_sidebar_collapsed');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('preppilot_sidebar_collapsed', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

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
    const showHeader = isDrawer || !isCollapsed;

    return (
      <div key={group.name} className="py-1">
        {showHeader && (
          <div className="px-3 pb-1.5 pt-2 text-[10px] font-bold tracking-wider text-slate-400/90 dark:text-slate-500 uppercase select-none">
            {group.name}
          </div>
        )}
        <div className="space-y-0.5">
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const isSettings = item.id === 'settings';

            return (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => {
                    setActiveSection(item.id);
                    if (isDrawer) {
                      onClose();
                    }
                  }}
                  title={!isDrawer && isCollapsed ? item.label : undefined}
                  className={`flex w-full items-center rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer ${
                    !isDrawer && isCollapsed
                      ? 'justify-center p-2.5'
                      : 'justify-between px-3 py-2'
                  } ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <div className={`flex items-center ${!isDrawer && isCollapsed ? '' : 'gap-2.5'}`}>
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-white'
                          : isSettings
                          ? 'text-slate-400 group-hover:text-slate-200'
                          : 'text-slate-400 group-hover:text-slate-200'
                      }`}
                    />
                    {(isDrawer || !isCollapsed) && (
                      <span className="truncate text-[12px]">{item.label}</span>
                    )}
                  </div>

                  {(isDrawer || !isCollapsed) && isActive && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-200" />
                  )}
                </button>

                {/* Collapsed desktop accessible tooltip */}
                {!isDrawer && isCollapsed && (
                  <div className="pointer-events-none absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 z-50 border border-slate-700">
                    {item.label}
                  </div>
                )}
              </div>
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">PrepPilot</span>
              <span className="block text-xs font-medium text-slate-400">NIMCET 2027</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => updateUserConfig({ darkMode: !userConfig.darkMode })}
              title={userConfig.darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              {userConfig.darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              onClick={onClose}
              title="Close Navigation"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Mobile Streak Strip */}
        <div className="shrink-0 border-b border-slate-800/80 bg-slate-900/60 px-4 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-amber-400 font-medium">
              <Flame className="h-3.5 w-3.5 fill-amber-400" />
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
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
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
      {/* 2. DESKTOP STICKY SIDEBAR (COLLAPSIBLE)                  */}
      {/* ======================================================== */}
      <aside
        className={`hidden lg:flex sticky top-0 h-screen shrink-0 flex-col bg-slate-950 text-slate-200 border-r border-slate-800/80 transition-all duration-200 ease-in-out z-20 ${
          isCollapsed ? 'w-18' : 'w-64'
        }`}
        aria-label="Desktop Navigation"
      >
        {/* Brand Area + Collapse / Expand Toggle */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/90 px-3.5">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                <Compass className="h-5 w-5" />
              </div>
              <div className="truncate">
                <span className="text-sm font-bold tracking-tight text-white block truncate">PrepPilot</span>
                <span className="block text-[11px] font-medium text-slate-400 truncate">NIMCET 2027</span>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <Compass className="h-5 w-5" />
            </div>
          )}

          {/* Collapse / Expand Control */}
          <button
            onClick={toggleCollapsed}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Quick Streak Strip (Expanded only) */}
        {!isCollapsed && (
          <div className="shrink-0 border-b border-slate-800/80 bg-slate-900/60 px-3.5 py-2.5">
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
        )}

        {/* Navigation Items (Grouped) */}
        <nav className="flex-1 overflow-y-auto px-2 py-2.5 space-y-1">
          {NAV_GROUPS.map((group) => renderNavGroup(group, false))}
        </nav>

        {/* Desktop Footer with Theme Toggle & Settings separation */}
        <div className="shrink-0 border-t border-slate-800/80 p-2.5 space-y-2">
          {!isCollapsed && <PWAInstallButton variant="sidebar" />}

          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
            <button
              onClick={() => updateUserConfig({ darkMode: !userConfig.darkMode })}
              title={userConfig.darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            >
              {userConfig.darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {!isCollapsed && (
              <span className="text-[10px] text-slate-500 font-mono">v1.2 • NIMCET</span>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};
