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
import { deleteCompanyHoliday, updateCompanyHoliday } from '@/services/companyHolidayService';
import moment from 'moment';

export type ViewMode = 'month' | 'week' | 'day';

const CalendarEvents = () => {
  const [currentDate, setCurrentDate] = useState(moment().toDate());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCompanyHolidayModalOpen, setIsCompanyHolidayModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<Date[]>([]);
  const [selectedDateEvents, setSelectedDateEvents] = useState<Event[]>([]);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingCompanyHoliday, setEditingCompanyHoliday] = useState<{ id: number; name: string; description?: string } | null>(null);
  const [highlightedDates, setHighlightedDates] = useState<string[]>([]);
  const [currentHoverEvent, setCurrentHoverEvent] = useState<{ startDate: string; endDate: string } | null>(null);
  const [filteredEmployeeId, setFilteredEmployeeId] = useState<number | null>(null);

  const {
    employees,
    events,
    loading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    loadEventsForMonth,
    loadData
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
    setSelectedDate(date);
    const dayEvents = getEventsForDate(date);
    setSelectedDateEvents(dayEvents);
    setIsDetailsModalOpen(true);
  };

  const handleCreateEvent = (date: Date, dateRange?: Date[]) => {
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
    if (window.confirm('คุณต้องการลบเหตุการณ์นี้หรือไม่?')) {
      try {
        await deleteEvent(eventId);
        await loadData();
        if (selectedDate) {
          const dayEvents = getEventsForDate(selectedDate);
          setSelectedDateEvents(dayEvents);
        }
      } catch (error) {
        console.error('Failed to delete event:', error);
      }
    }
  };

  const handleEventSave = async (eventData: {
    employeeId: number;
    employeeName: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    description?: string;
  }) => {
    try {
      if (editingEvent) {
        await updateEvent(editingEvent.id, {
          employeeId: eventData.employeeId,
          leaveType: eventData.leaveType as any,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          description: eventData.description
        });
      } else {
        await addEvent({
          employeeId: eventData.employeeId,
          employeeName: eventData.employeeName,
          leaveType: eventData.leaveType as any,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          description: eventData.description
        });
      }

      await loadData();

      if (selectedDate) {
        const dayEvents = getEventsForDate(selectedDate);
        setSelectedDateEvents(dayEvents);
      }

      setEditingEvent(null);
      setSelectedDateRange([]);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Failed to save event:', err);
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

  const handleEventHoverEnd = () => {
    setCurrentHoverEvent(null);
    setHighlightedDates([]);
  };

  const handleEmployeeFilter = (employeeId: number) => {
    // Toggle filter - if same employee clicked, clear filter
    if (filteredEmployeeId === employeeId) {
      setFilteredEmployeeId(null);
    } else {
      setFilteredEmployeeId(employeeId);
    }
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
        const dayEvents = getEventsForDate(selectedDate);
        setSelectedDateEvents(dayEvents);
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
        const dayEvents = getEventsForDate(selectedDate);
        setSelectedDateEvents(dayEvents);
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
      const dayEvents = getEventsForDate(selectedDate);
      setSelectedDateEvents(dayEvents);
    }
  }, [events, selectedDate, getEventsForDate]);

  // Re-trigger highlight when currentDate changes if there's a hover event
  useEffect(() => {
    if (currentHoverEvent) {
      updateHighlightedDates(currentHoverEvent.startDate, currentHoverEvent.endDate);
    }
  }, [currentDate, currentHoverEvent, updateHighlightedDates]);

  return (
    <Layout currentPage="calendar-events">
      <div className="max-w-[1920px] mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4 md:py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-800/30 border border-red-200 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
            Error: {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500 dark:text-gray-300">Loading calendar data...</div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Calendar Grid - 70% width */}
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
                    filteredEmployeeId={filteredEmployeeId}
                    onViewModeChange={setViewMode}
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

            {/* Upcoming Events Section - 30% width */}
            <div className="lg:w-[30%]">
              <UpcomingEvents
                events={events}
                employees={employees}
                filteredEmployeeId={filteredEmployeeId}
                onNavigateToMonth={handleNavigateToMonth}
                onEventHover={handleEventHover}
                onEventHoverEnd={handleEventHoverEnd}
                onEmployeeFilter={handleEmployeeFilter}
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
      />

      {/* Event Details Modal */}
      <EventDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        onCreateEvent={handleCreateEventFromDetails}
        onEditEvent={handleEditEvent}
        onDeleteEvent={handleDeleteEvent}
        events={selectedDateEvents}
        employees={employees}
        selectedDate={selectedDate}
        companyHoliday={selectedDate ? isCompanyHoliday(selectedDate) : null}
        onEditCompanyHoliday={handleEditCompanyHoliday}
        onDeleteCompanyHoliday={handleDeleteCompanyHoliday}
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
