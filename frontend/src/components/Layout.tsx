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
  showMobileJiraVpnNotice?: boolean;
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
  showMobileJiraVpnNotice = false,
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
      {showMobileJiraVpnNotice && (
        <div
          role="status"
          className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-100"
        >
          ฟีเจอร์ Jira Worklog ต้องเชื่อมต่อ VPN ก่อนจึงจะใช้งานได้
        </div>
      )}
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
