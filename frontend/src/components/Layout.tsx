import React from 'react';
import { Navbar } from './Navbar';
import type { CalendarMode } from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
  currentPage?: 'calendar-events' | 'dashboard' | 'employees' | 'cronjob-config' | 'company-holidays' | 'events-management';
  calendarMode?: CalendarMode;
  onCalendarModeChange?: (mode: CalendarMode) => void;
  onWorklogRefresh?: () => void;
  worklogsLoading?: boolean;
  featureTourStarted?: boolean;
  onboardingEnabled?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  currentPage = 'calendar-events',
  calendarMode,
  onCalendarModeChange,
  onWorklogRefresh,
  worklogsLoading,
  featureTourStarted = true,
  onboardingEnabled = true,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-700 flex flex-col">
      <Navbar
        currentPage={currentPage}
        calendarMode={calendarMode}
        onCalendarModeChange={onCalendarModeChange}
        onWorklogRefresh={onWorklogRefresh}
        worklogsLoading={worklogsLoading}
        featureTourStarted={featureTourStarted}
        onboardingEnabled={onboardingEnabled}
      />
      <main className="flex-1">
        {children}
      </main>
      <footer className="-mt-3 -mr-3 flex flex-col items-end pt-8 pb-4 px-6 text-xs text-gray-500 dark:text-gray-400">
        <p>Version 2.0</p>
        <p>
          ©2025 loveable x claude x cursor agent x chitsanuphong.cha. All rights reserved
        </p>
      </footer>
    </div>
  );
};

export default Layout;
