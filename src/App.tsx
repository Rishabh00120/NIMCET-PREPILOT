import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FirstRunModal } from './components/FirstRunModal';
import { NotificationModal } from './components/NotificationModal';
import { TopicDetailModal } from './components/TopicDetailModal';
import { MilestoneCelebrationModal } from './components/MilestoneCelebrationModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { AuthModal } from './components/AuthModal';
import { DataMigrationModal } from './components/DataMigrationModal';

// Views
import { DashboardView } from './views/DashboardView';
import { FocusModeView } from './views/FocusModeView';
import { SyllabusView } from './views/SyllabusView';
import { MonthlyRoadmapView } from './views/MonthlyRoadmapView';
import { DailyTimetableView } from './views/DailyTimetableView';
import { TodoListView } from './views/TodoListView';
import { CalendarView } from './views/CalendarView';
import { PYQTrackerView } from './views/PYQTrackerView';
import { PYQLibraryView } from './views/PYQLibraryView';
import { TestSeriesView } from './views/TestSeriesView';
import { RevisionCentreView } from './views/RevisionCentreView';
import { AnalyticsView } from './views/AnalyticsView';
import { SettingsView } from './views/SettingsView';

const MainLayout: React.FC = () => {
  const { activeSection, uncelebratedBadge, dismissCelebration } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const renderActiveView = () => {
    switch (activeSection) {
      case 'dashboard':
        return <DashboardView />;
      case 'focus':
        return <FocusModeView />;
      case 'syllabus':
        return <SyllabusView />;
      case 'roadmap':
        return <MonthlyRoadmapView />;
      case 'timetable':
        return <DailyTimetableView />;
      case 'tasks':
        return <TodoListView />;
      case 'calendar':
        return <CalendarView />;
      case 'pyq':
        return <PYQTrackerView />;
      case 'pyq_library':
        return <PYQLibraryView />;
      case 'mocks':
        return <TestSeriesView />;
      case 'revision':
        return <RevisionCentreView />;
      case 'analytics':
        return <AnalyticsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-blue-600 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenNotifications={() => setNotificationsOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 max-w-7xl w-full mx-auto">
          {renderActiveView()}
        </main>
      </div>

      {/* Global Modals & Indicators */}
      <FirstRunModal />
      <NotificationModal
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
      <TopicDetailModal />
      <MilestoneCelebrationModal
        badge={uncelebratedBadge}
        onClose={dismissCelebration}
      />
      <OfflineIndicator />
      <PWAUpdatePrompt />
      <AuthModal />
      <DataMigrationModal />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
