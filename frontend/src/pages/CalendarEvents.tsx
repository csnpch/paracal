import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarGrid } from '@/components/CalendarGrid';
import { EventModal } from '@/components/EventModal';
import { EventDetailsModal } from '@/components/EventDetailsModal';
import { CompanyHolidayModal } from '@/components/CompanyHolidayModal';
import UpcomingEvents from '@/components/UpcomingEvents';
import { useCalendarData } from '@/hooks/useCalendarData';
import { useCompanyHolidays } from '@/hooks/useCompanyHolidays';
import { Event } from '@/services/apiDatabase';
import { Layout } from '@/components/Layout';
import type { CalendarMode } from '@/components/Navbar';
import { FeatureTourWelcome, SpotlightTargetTour } from '@/components/SpotlightTour';
import {
  FEATURE_TOUR_WELCOME_KEY,
  hasSeenOnboarding,
  JIRA_WORKLOG_PERSON_TOUR_KEY,
  JIRA_WORKLOG_RELOAD_TOUR_KEY,
} from '@/lib/onboarding';
import { deleteCompanyHoliday, updateCompanyHoliday } from '@/services/companyHolidayService';
import { useWorklogs } from '@/hooks/useWorklogs';
import { findEmployeeByAuthorName } from '@/lib/nameMatch';
import { getStoredWorklogAuthorId, setStoredWorklogAuthorId } from '@/lib/worklog';
import type { JiraWorklogEntry } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { LEAVE_TYPE_LABELS } from '@/lib/utils';
import moment from 'moment';
import { useAuth } from '@/contexts/AuthContext';

export type ViewMode = 'month' | 'week' | 'day';

const CalendarEvents = () => {
  const { isAdminAuthenticated } = useAuth();
  const [currentDate, setCurrentDate] = useState(moment().toDate());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('events');
  const [selectedWorklogAuthorId, setSelectedWorklogAuthorId] = useState(getStoredWorklogAuthorId);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCompanyHolidayModalOpen, setIsCompanyHolidayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<Date[]>([]);
  const [selectedDateEvents, setSelectedDateEvents] = useState<Event[]>([]);
  const [selectedDateWorklogs, setSelectedDateWorklogs] = useState<JiraWorklogEntry[]>([]);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingCompanyHoliday, setEditingCompanyHoliday] = useState<{ id: number; name: string; description?: string } | null>(null);
  const [highlightedDates, setHighlightedDates] = useState<string[]>([]);
  const [currentHoverEvent, setCurrentHoverEvent] = useState<{ startDate: string; endDate: string } | null>(null);
  const [filteredEmployeeIds, setFilteredEmployeeIds] = useState<number[]>([]);
  const [jiraPersonTourDone, setJiraPersonTourDone] = useState(() => hasSeenOnboarding(JIRA_WORKLOG_PERSON_TOUR_KEY));
  const [featureTourStarted, setFeatureTourStarted] = useState(() => hasSeenOnboarding(FEATURE_TOUR_WELCOME_KEY));
  const [reloadTourActive, setReloadTourActive] = useState(false);
  const [reloadTourDismissSignal, setReloadTourDismissSignal] = useState(0);
  const [mockWorklogsLoading, setMockWorklogsLoading] = useState(false);

  const {
    employees,
    events,
    loading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
  } = useCalendarData();

  // Calculate the range of years that will be visible in the calendar grid
  const currentYear = moment(currentDate).year();
  const currentMonth = moment(currentDate).month();

  let startDate = moment(currentDate);
  let endDate = moment(currentDate);

  if (viewMode === 'month') {
    const firstDay = moment().year(currentYear).month(currentMonth).date(1);
    startDate = firstDay.clone().subtract(firstDay.day(), 'days');
    endDate = startDate.clone().add(41, 'days'); // 42 days total (6 weeks)
  } else if (viewMode === 'week') {
    startDate = moment(currentDate).startOf('week');
    endDate = startDate.clone().add(6, 'days');
  } else {
    startDate = moment(currentDate).startOf('day');
    endDate = startDate.clone().endOf('day');
  }

  const startYear = startDate.year();
  const endYear = endDate.year();

  const worklogQueryRange = useMemo(() => {
    let rangeStart = moment(currentDate);
    let rangeEnd = moment(currentDate);

    if (viewMode === 'month') {
      const firstDay = moment(currentDate).startOf('month');
      rangeStart = firstDay.clone().subtract(firstDay.day(), 'days');
      rangeEnd = rangeStart.clone().add(41, 'days');
    } else if (viewMode === 'week') {
      rangeStart = moment(currentDate).startOf('week');
      rangeEnd = rangeStart.clone().add(6, 'days');
    } else {
      rangeStart = moment(currentDate).startOf('day');
      rangeEnd = rangeStart.clone().add(1, 'day').endOf('day');
    }

    return {
      start: rangeStart.format('YYYY-MM-DD'),
      end: rangeEnd.format('YYYY-MM-DD'),
    };
  }, [currentDate, viewMode]);

  const { data: worklogData, loading: worklogsLoading, error: worklogsError, refetch: refetchWorklogs } = useWorklogs({
    enabled: calendarMode === 'worklogs',
    startDate: worklogQueryRange.start,
    endDate: worklogQueryRange.end,
  });

  const showWorklogsLoading = calendarMode === 'worklogs' && (worklogsLoading || mockWorklogsLoading);

  const handleWorklogRefresh = useCallback(() => {
    if (reloadTourActive) {
      setReloadTourDismissSignal((current) => current + 1);
      setMockWorklogsLoading(true);
      window.setTimeout(() => setMockWorklogsLoading(false), 700);
      return;
    }

    refetchWorklogs();
  }, [reloadTourActive, refetchWorklogs]);

  const selectedWorklogAuthor = useMemo(
    () => worklogData?.authors.find((author) => author.id === selectedWorklogAuthorId),
    [worklogData?.authors, selectedWorklogAuthorId],
  );

  const matchedWorklogEmployeeId = useMemo(() => {
    if (!selectedWorklogAuthor) return null;
    return findEmployeeByAuthorName(selectedWorklogAuthor.name, employees)?.id ?? null;
  }, [selectedWorklogAuthor, employees]);

  const calendarFilteredEmployeeIds = useMemo(() => {
    if (calendarMode !== 'worklogs') return filteredEmployeeIds;
    if (!selectedWorklogAuthorId || !matchedWorklogEmployeeId) return [];
    return [matchedWorklogEmployeeId];
  }, [calendarMode, filteredEmployeeIds, selectedWorklogAuthorId, matchedWorklogEmployeeId]);

  const suppressWorklogEvents = calendarMode === 'worklogs' && (!selectedWorklogAuthorId || !matchedWorklogEmployeeId);

  const getModalEventsForDate = useCallback((date: Date): Event[] => {
    const dayEvents = getEventsForDate(date);
    if (calendarMode === 'worklogs') {
      if (!selectedWorklogAuthorId || !matchedWorklogEmployeeId) return [];
      return dayEvents.filter((event) => event.employeeId === matchedWorklogEmployeeId);
    }
    if (filteredEmployeeIds.length > 0) {
      return dayEvents.filter((event) => filteredEmployeeIds.includes(event.employeeId));
    }
    return dayEvents;
  }, [calendarMode, selectedWorklogAuthorId, matchedWorklogEmployeeId, filteredEmployeeIds, getEventsForDate]);

  const visibleWorklogEntries = useMemo(() => {
    if (calendarMode !== 'worklogs' || !selectedWorklogAuthorId) return [];
    return (worklogData?.entries || []).filter((entry) => entry.authorId === selectedWorklogAuthorId);
  }, [calendarMode, selectedWorklogAuthorId, worklogData?.entries]);

  const handleWorklogAuthorChange = useCallback((authorId: string) => {
    setSelectedWorklogAuthorId(authorId);
    setStoredWorklogAuthorId(authorId);
  }, []);

  const handleCalendarModeChange = (mode: CalendarMode) => {
    setCalendarMode(mode);
    if (mode === 'worklogs') {
      setFilteredEmployeeIds([]);
      setSelectedWorklogAuthorId((current) => current || getStoredWorklogAuthorId());
    }
  };

  useEffect(() => {
    if (calendarMode !== 'worklogs' || !worklogData?.authors?.length || !selectedWorklogAuthorId) return;

    const authorExists = worklogData.authors.some((author) => author.id === selectedWorklogAuthorId);
    if (!authorExists) {
      setSelectedWorklogAuthorId('');
      setStoredWorklogAuthorId('');
    }
  }, [calendarMode, worklogData?.authors, selectedWorklogAuthorId]);

  // Load company holidays for all years that appear in the calendar grid
  const { holidays: currentYearHolidays, refresh: refreshCurrentYear } = useCompanyHolidays(currentYear);
  const { holidays: startYearHolidays, refresh: refreshStartYear } = useCompanyHolidays(startYear);
  const { holidays: endYearHolidays, refresh: refreshEndYear } = useCompanyHolidays(endYear);

  // Combine all company holidays
  const companyHolidays = useMemo(() => {
    const combined = [...currentYearHolidays];
    if (startYear !== currentYear) {
      combined.push(...startYearHolidays);
    }
    if (endYear !== currentYear && endYear !== startYear) {
      combined.push(...endYearHolidays);
    }
    return combined;
  }, [currentYearHolidays, startYearHolidays, endYearHolidays, currentYear, startYear, endYear]);

  const isCompanyHoliday = (date: Date) => {
    if (!Array.isArray(companyHolidays)) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateString = `${year}-${month}-${day}`;
    return companyHolidays.find(holiday => holiday.date === dateString) || null;
  };

  const refreshCompanyHolidays = () => {
    refreshCurrentYear();
    if (startYear !== currentYear) {
      refreshStartYear();
    }
    if (endYear !== currentYear && endYear !== startYear) {
      refreshEndYear();
    }
  };

  const handleDateClick = (date: Date) => {
    if (calendarMode === 'worklogs' && (!selectedWorklogAuthorId || showWorklogsLoading)) {
      return;
    }

    setSelectedDate(date);
    setSelectedDateEvents(getModalEventsForDate(date));

    if (calendarMode === 'worklogs') {
      const dateString = moment(date).format('YYYY-MM-DD');
      setSelectedDateWorklogs(
        visibleWorklogEntries.filter((entry) => entry.date === dateString),
      );
    } else {
      setSelectedDateWorklogs([]);
    }

    setIsDetailsModalOpen(true);
  };

  const handleCreateEvent = (date: Date, dateRange?: Date[]) => {
    if (!isAdminAuthenticated) return;

    setSelectedDate(date);
    setSelectedDateRange(dateRange || []);
    setIsModalOpen(true);
  };

  const handleCreateEventFromDetails = () => {
    setIsDetailsModalOpen(false);
    setEditingEvent(null);
    setIsModalOpen(true);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setIsDetailsModalOpen(false);
    setIsModalOpen(true);
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!isAdminAuthenticated) return;

    if (window.confirm('คุณต้องการลบเหตุการณ์นี้หรือไม่?')) {
      try {
        await deleteEvent(eventId);
        toast({ title: 'ลบเหตุการณ์เรียบร้อย', description: 'ลบเหตุการณ์ออกจากระบบแล้ว' });
      } catch (error) {
        console.error('Failed to delete event:', error);
        toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถลบเหตุการณ์ได้', variant: 'destructive' });
      }
    }
  };

  const handleEventSave = async (eventData: {
    employeeId: number;
    employeeName: string;
    leaveType: string;
    leaveDuration?: string;
    startDate: string;
    endDate: string;
    description?: string;
  }) => {
    if (!isAdminAuthenticated) return;

    const leaveLabel = LEAVE_TYPE_LABELS[eventData.leaveType as keyof typeof LEAVE_TYPE_LABELS] || eventData.leaveType;
    const durationMap: Record<string, string> = {
      morning: ' (ครึ่งเช้า)',
      afternoon: ' (ครึ่งบ่าย)',
      afternoon_full: ' (บ่ายวันเริ่ม)',
      full_morning: ' (เช้าวันสิ้นสุด)',
      afternoon_morning: ' (บ่ายวันเริ่ม-เช้าวันสิ้นสุด)',
    };
    const durationSuffix = eventData.leaveDuration ? (durationMap[eventData.leaveDuration] || '') : '';

    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, {
          employeeId: eventData.employeeId,
          leaveType: eventData.leaveType as any,
          leaveDuration: eventData.leaveDuration as any,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          description: eventData.description
        });
        toast({
          title: 'อัพเดทเหตุการณ์เรียบร้อย',
          description: `${eventData.employeeName} — ${leaveLabel}${durationSuffix}`,
        });
      } else {
        await addEvent({
          employeeId: eventData.employeeId,
          employeeName: eventData.employeeName,
          leaveType: eventData.leaveType as any,
          leaveDuration: eventData.leaveDuration as any,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          description: eventData.description
        });
        toast({
          title: 'บันทึกเหตุการณ์เรียบร้อย',
          description: `${eventData.employeeName} — ${leaveLabel}${durationSuffix}`,
        });
      }

      setEditingEvent(null);
      setSelectedDateRange([]);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save event:', err);
      toast({ title: 'เกิดข้อผิดพลาด', description: 'ไม่สามารถบันทึกเหตุการณ์ได้', variant: 'destructive' });
    }
  };

  const handlePrevDate = () => {
    let newDate;
    if (viewMode === 'month') {
      newDate = moment(currentDate).subtract(1, 'month').startOf('month').toDate();
    } else if (viewMode === 'week') {
      newDate = moment(currentDate).subtract(1, 'week').startOf('week').toDate();
    } else {
      newDate = moment(currentDate).subtract(1, 'day').startOf('day').toDate();
    }
    setCurrentDate(newDate);
  };

  const handleNextDate = () => {
    let newDate;
    if (viewMode === 'month') {
      newDate = moment(currentDate).add(1, 'month').startOf('month').toDate();
    } else if (viewMode === 'week') {
      newDate = moment(currentDate).add(1, 'week').startOf('week').toDate();
    } else {
      newDate = moment(currentDate).add(1, 'day').startOf('day').toDate();
    }
    setCurrentDate(newDate);
  };

  const handleTodayClick = () => {
    let newDate;
    if (viewMode === 'month') {
      newDate = moment().startOf('month').toDate();
    } else if (viewMode === 'week') {
      newDate = moment().startOf('week').toDate();
    } else {
      newDate = moment().startOf('day').toDate();
    }
    setCurrentDate(newDate);
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'month') {
      setCurrentDate(moment().startOf('month').toDate());
    } else if (mode === 'week') {
      setCurrentDate(moment().startOf('week').toDate());
    } else {
      setCurrentDate(moment().startOf('day').toDate());
    }
  };

  const handleNavigateToMonth = (year: number, month: number) => {
    const newDate = moment().year(year).month(month).startOf('month').toDate();
    setCurrentDate(newDate);
    // Don't reload events - keep all events visible
  };

  const handleEventHover = (startDate: string, endDate: string) => {
    setCurrentHoverEvent({ startDate, endDate });
    updateHighlightedDates(startDate, endDate);
  };

  const updateHighlightedDates = useCallback((startDate: string, endDate: string) => {
    const dates = [];
    const start = moment(startDate);
    const end = moment(endDate);
    const current = start.clone();

    while (current.isSameOrBefore(end)) {
      // Only highlight if date is in current calendar month view
      if (current.month() === moment(currentDate).month() && current.year() === moment(currentDate).year()) {
        const currentDate = current.toDate();

        // Skip weekends (Saturday = 6, Sunday = 0)
        const dayOfWeek = current.day();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Skip company holidays
        const dateString = current.format('YYYY-MM-DD');
        const isCompanyHolidayDate = companyHolidays.find(holiday => holiday.date === dateString);

        // Only add to highlight if it's not weekend and not company holiday
        if (!isWeekend && !isCompanyHolidayDate) {
          dates.push(current.format('YYYY-MM-DD'));
        }
      }
      current.add(1, 'day');
    }

    setHighlightedDates(dates);
  }, [currentDate, companyHolidays]);

  const handleWorklogDatesHover = (dates: string[]) => {
    if (dates.length === 0) return;
    const sortedDates = [...dates].sort();
    setCurrentHoverEvent({ startDate: sortedDates[0], endDate: sortedDates[sortedDates.length - 1] });
    setHighlightedDates(sortedDates);
  };

  const handleEventHoverEnd = () => {
    setCurrentHoverEvent(null);
    setHighlightedDates([]);
  };

  const handleEmployeeFilter = (employeeId: number) => {
    // Toggle filter - if same employee clicked, remove from array
    setFilteredEmployeeIds(prev => 
      prev.includes(employeeId) 
        ? prev.filter(id => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleEditCompanyHoliday = (holiday: { id: number; name: string; description?: string }) => {
    setEditingCompanyHoliday(holiday);
    setIsDetailsModalOpen(false);
    setIsCompanyHolidayModalOpen(true);
  };

  const handleDeleteCompanyHoliday = async (holidayId: number) => {
    try {
      await deleteCompanyHoliday(holidayId);
      refreshCompanyHolidays();
      // Refresh events for the selected date to update the modal
      if (selectedDate) {
        setSelectedDateEvents(getModalEventsForDate(selectedDate));
      }
    } catch (error) {
      console.error('Failed to delete company holiday:', error);
    }
  };

  const handleCompanyHolidaySave = async (holidayData: {
    name: string;
    date: string;
    description?: string;
  }) => {
    try {
      if (editingCompanyHoliday) {
        // Update existing company holiday
        await updateCompanyHoliday(editingCompanyHoliday.id, {
          name: holidayData.name,
          description: holidayData.description
        });
      }
      // Note: Creating new holiday is handled by CreateEventPopover

      refreshCompanyHolidays();
      setEditingCompanyHoliday(null);
      setIsCompanyHolidayModalOpen(false);

      // Refresh events for the selected date to update the modal
      if (selectedDate) {
        setSelectedDateEvents(getModalEventsForDate(selectedDate));
      }
    } catch (error) {
      console.error('Failed to save company holiday:', error);
    }
  };

  useEffect(() => {
    if (!isModalOpen && !isDetailsModalOpen && !isCompanyHolidayModalOpen) {
      document.body.style.overflow = 'unset';
    }
  }, [isModalOpen, isDetailsModalOpen, isCompanyHolidayModalOpen]);

  useEffect(() => {
    if (selectedDate) {
      setSelectedDateEvents(getModalEventsForDate(selectedDate));

      if (calendarMode === 'worklogs') {
        const dateString = moment(selectedDate).format('YYYY-MM-DD');
        setSelectedDateWorklogs(
          visibleWorklogEntries.filter((entry) => entry.date === dateString),
        );
      }
    }
  }, [events, selectedDate, getModalEventsForDate, calendarMode, visibleWorklogEntries]);

  // Re-trigger highlight when currentDate changes if there's a hover event
  useEffect(() => {
    if (currentHoverEvent) {
      updateHighlightedDates(currentHoverEvent.startDate, currentHoverEvent.endDate);
    }
  }, [currentDate, currentHoverEvent, updateHighlightedDates]);

  return (
    <Layout
      currentPage="calendar-events"
      calendarMode={calendarMode}
      onCalendarModeChange={handleCalendarModeChange}
      onWorklogRefresh={handleWorklogRefresh}
      worklogsLoading={showWorklogsLoading}
      featureTourStarted={featureTourStarted}
    >
      {!featureTourStarted && (
        <FeatureTourWelcome onStart={() => setFeatureTourStarted(true)} />
      )}
      <SpotlightTargetTour
        storageKey={JIRA_WORKLOG_PERSON_TOUR_KEY}
        enabled={featureTourStarted && calendarMode === 'worklogs'}
        targetSelector='[data-tour="jira-worklog-person-select"]'
        title="เลือกชื่อเพื่อดู worklog บนปฏิทิน"
        onComplete={() => setJiraPersonTourDone(true)}
      />
      <SpotlightTargetTour
        storageKey={JIRA_WORKLOG_RELOAD_TOUR_KEY}
        enabled={featureTourStarted && calendarMode === 'worklogs' && !!selectedWorklogAuthorId && jiraPersonTourDone}
        targetSelector='[data-tour="jira-worklog-reload"]'
        title="ปุ่มสำหรับดึงข้อมูล jira ล่าสุด"
        dismissSignal={reloadTourDismissSignal}
        onOpenChange={setReloadTourActive}
      />
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-8">
        {(error || (calendarMode === 'worklogs' && worklogsError)) && (
          <div className="bg-red-50 dark:bg-red-800/30 border border-red-200 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
            Error: {error || worklogsError}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500 dark:text-gray-300">Loading calendar data...</div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            <div className="flex-1 lg:w-[70%]">
              <div className="w-full pb-2">
                <div className="w-full">
                  <CalendarGrid
                    currentDate={currentDate}
                    viewMode={viewMode}
                    events={events}
                    employees={employees}
                    companyHolidays={companyHolidays}
                    highlightedDates={highlightedDates}
                    filteredEmployeeIds={calendarFilteredEmployeeIds}
                    worklogMode={calendarMode === 'worklogs'}
                    worklogEntries={visibleWorklogEntries}
                    worklogAuthors={worklogData?.authors || []}
                    selectedWorklogAuthorId={selectedWorklogAuthorId}
                    worklogsLoading={showWorklogsLoading}
                    suppressEvents={suppressWorklogEvents}
                    onWorklogAuthorChange={handleWorklogAuthorChange}
                    onViewModeChange={handleViewModeChange}
                    onDateClick={handleDateClick}
                    onCreateEvent={handleCreateEvent}
                    onHolidayAdded={refreshCompanyHolidays}
                    onPrevDate={handlePrevDate}
                    onNextDate={handleNextDate}
                    onTodayClick={handleTodayClick}
                  />
                </div>
              </div>
            </div>

            <div className="lg:w-[30%]">
              <UpcomingEvents
                events={events}
                employees={employees}
                filteredEmployeeIds={calendarMode === 'worklogs' ? calendarFilteredEmployeeIds : filteredEmployeeIds}
                worklogMode={calendarMode === 'worklogs'}
                worklogs={visibleWorklogEntries}
                worklogsLoading={showWorklogsLoading}
                selectedWorklogAuthorId={selectedWorklogAuthorId}
                onNavigateToMonth={handleNavigateToMonth}
                onEventHover={handleEventHover}
                onEventHoverEnd={handleEventHoverEnd}
                onWorklogDatesHover={handleWorklogDatesHover}
                onEmployeeFilter={calendarMode === 'worklogs' ? undefined : handleEmployeeFilter}
              />
            </div>
          </div>
        )}
      </div>

      {/* Event Creation Modal */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEvent(null);
          setSelectedDateRange([]);
        }}
        onSave={handleEventSave}
        selectedDate={selectedDate}
        selectedDateRange={selectedDateRange}
        employees={employees}
        editingEvent={editingEvent}
        companyHolidays={companyHolidays}
      />

      {/* Event Details Modal */}
      <EventDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onCreateEvent={isAdminAuthenticated ? handleCreateEventFromDetails : undefined}
        onEditEvent={isAdminAuthenticated ? handleEditEvent : undefined}
        onDeleteEvent={isAdminAuthenticated ? handleDeleteEvent : undefined}
        events={selectedDateEvents}
        worklogs={selectedDateWorklogs}
        worklogMode={calendarMode === 'worklogs'}
        employees={employees}
        selectedDate={selectedDate}
        companyHoliday={selectedDate ? isCompanyHoliday(selectedDate) : null}
        onEditCompanyHoliday={isAdminAuthenticated ? handleEditCompanyHoliday : undefined}
        onDeleteCompanyHoliday={isAdminAuthenticated ? handleDeleteCompanyHoliday : undefined}
      />

      {/* Company Holiday Modal */}
      <CompanyHolidayModal
        isOpen={isCompanyHolidayModalOpen}
        onClose={() => { setIsCompanyHolidayModalOpen(false); setEditingCompanyHoliday(null); }}
        onSave={handleCompanyHolidaySave}
        selectedDate={selectedDate}
        editingHoliday={editingCompanyHoliday}
      />
    </Layout>
  );
};

export default CalendarEvents;
