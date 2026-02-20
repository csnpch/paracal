import React, { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateEventPopover } from '@/components/CreateEventPopover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHolidays } from '@/hooks/useHolidays';
import { ViewMode } from '@/pages/CalendarEvents';
import { Event } from '@/services/apiDatabase';
import { DAYS_OF_WEEK, MONTHS, LEAVE_TYPE_COLORS_SOLID, LEAVE_TYPE_LABELS, formatDate } from '@/lib/utils';
import moment from 'moment';

interface CalendarGridProps {
  currentDate: Date;
  viewMode?: ViewMode;
  events: Event[];
  employees: { id: number; name: string }[];
  companyHolidays: any[];
  highlightedDates?: string[];
  filteredEmployeeId?: number | null;
  onViewModeChange?: (viewMode: ViewMode) => void;
  onDateClick: (date: Date) => void;
  onCreateEvent: (date: Date, dateRange?: Date[]) => void;
  onHolidayAdded?: () => void;
  onPrevDate: () => void;
  onNextDate: () => void;
  onTodayClick: () => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentDate,
  viewMode = 'month',
  events,
  employees,
  companyHolidays,
  highlightedDates = [],
  filteredEmployeeId = null,
  onViewModeChange,
  onDateClick,
  onCreateEvent,
  onHolidayAdded,
  onPrevDate,
  onNextDate,
  onTodayClick
}) => {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedPopoverDate, setSelectedPopoverDate] = useState<Date | null>(null);
  const [maxVisibleEvents, setMaxVisibleEvents] = useState(2);
  const [popoverJustOpened, setPopoverJustOpened] = useState(false);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [holidayDate, setHolidayDate] = useState<Date | null>(null);
  const [holidayName, setHolidayName] = useState('');
  const [holidayDescription, setHolidayDescription] = useState('');


  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const [dragEndDate, setDragEndDate] = useState<Date | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<Date[]>([]);
  const [hoverDateRange, setHoverDateRange] = useState<Date[]>([]);

  // Safely handle window resize
  React.useEffect(() => {
    const updateMaxEvents = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth;
        setMaxVisibleEvents(width < 640 ? 1 : width < 768 ? 1 : 2);
      }
    };

    updateMaxEvents();
    window.addEventListener('resize', updateMaxEvents);

    return () => window.removeEventListener('resize', updateMaxEvents);
  }, []);

  const year = moment(currentDate).year();
  const month = moment(currentDate).month();

  // Calculate the range of years that will be visible in the calendar grid
  let startDate = moment(currentDate);
  let endDate = moment(currentDate);

  if (viewMode === 'month') {
    const firstDay = moment().year(year).month(month).date(1);
    startDate = firstDay.clone().subtract(firstDay.day(), 'days');
    endDate = startDate.clone().add(41, 'days'); // 42 days total (6 weeks)
  } else if (viewMode === 'week') {
    startDate = moment(currentDate).startOf('week');
    endDate = startDate.clone().add(6, 'days');
  } else {
    // Day view displays 2 days: Today and Tomorrow
    startDate = moment(currentDate).startOf('day');
    endDate = startDate.clone().add(1, 'day').endOf('day');
  }

  const startYear = startDate.year();
  const endYear = endDate.year();

  // Load holidays for all years that appear in the calendar grid
  const { holidays: currentYearHolidays, isHoliday: isCurrentYearHoliday, isWeekend } = useHolidays(year);
  const { holidays: startYearHolidays, isHoliday: isStartYearHoliday } = useHolidays(startYear);
  const { holidays: endYearHolidays, isHoliday: isEndYearHoliday } = useHolidays(endYear);

  // Combine all holidays and create a unified holiday checker
  const allHolidays = React.useMemo(() => {
    const combined = [...currentYearHolidays];
    if (startYear !== year) {
      combined.push(...startYearHolidays);
    }
    if (endYear !== year && endYear !== startYear) {
      combined.push(...endYearHolidays);
    }
    return combined;
  }, [currentYearHolidays, startYearHolidays, endYearHolidays, year, startYear, endYear]);

  const isHoliday = (date: Date) => {
    const dateString = moment(date).format('YYYY-MM-DD');
    return allHolidays.find(holiday => holiday.date === dateString) || null;
  };

  const holidays = allHolidays;

  const isCompanyHoliday = (date: Date) => {
    if (!Array.isArray(companyHolidays)) return null;
    const dateString = moment(date).format('YYYY-MM-DD');
    return companyHolidays.find(holiday => holiday.date === dateString) || null;
  };

  const handleHolidayAdded = () => {
    // Refresh company holidays when a new one is added
    if (onHolidayAdded) {
      onHolidayAdded();
    }
  };

  const getDaysArray = () => {
    const days = [];
    let currentDay = moment(startDate);
    const numDays = viewMode === 'month' ? 42 : viewMode === 'week' ? 7 : 2; // Day view shows 2 days now

    for (let i = 0; i < numDays; i++) {
      days.push(currentDay.toDate());
      currentDay = currentDay.clone().add(1, 'day');
    }

    return days;
  };

  const getEventsForDate = (date: Date) => {
    if (!Array.isArray(events)) return [];
    const dateString = moment(date).format('YYYY-MM-DD');
    const filteredEvents = events.filter(event => {
      // Filter by employee if filteredEmployeeId is set
      if (filteredEmployeeId !== null && event.employeeId !== filteredEmployeeId) {
        return false;
      }

      // Check both legacy date field and new date range fields
      if (event.date === dateString) return true;
      if (event.startDate && event.endDate) {
        return dateString >= event.startDate && dateString <= event.endDate;
      }
      return false;
    });

    // Sort events for consistent layering
    return filteredEvents.sort((a, b) => {
      // First sort by start date (earlier events first)
      const aStart = a.startDate || a.date;
      const bStart = b.startDate || b.date;
      if (aStart !== bStart) {
        return aStart < bStart ? -1 : 1;
      }

      // Then by duration (longer events first)
      const aEnd = a.endDate || a.date;
      const bEnd = b.endDate || b.date;
      const aDuration = moment(aEnd).diff(moment(aStart), 'days');
      const bDuration = moment(bEnd).diff(moment(bStart), 'days');
      if (aDuration !== bDuration) {
        return bDuration - aDuration;
      }

      // Finally by employee ID for consistency
      return a.employeeId - b.employeeId;
    });
  };

  const getEmployeeName = (employeeId: number) => {
    if (!Array.isArray(employees)) return 'Unknown Employee';
    const employee = employees.find(emp => emp.id === employeeId);
    return employee?.name || 'Unknown Employee';
  };

  const isCurrentMonth = (date: Date) => {
    return moment(date).month() === month;
  };

  const isToday = (date: Date) => {
    return moment(date).isSame(moment(), 'day');
  };

  const handleDateClick = (date: Date) => {
    // If we have a date range selected (either valid dates or just hover range), create events for the range
    if (selectedDateRange.length > 1 || hoverDateRange.length > 1) {
      const popoverDate = selectedDateRange.length > 0 ? selectedDateRange[0] : hoverDateRange[0];
      setSelectedPopoverDate(popoverDate);
      setPopoverOpen(true);
      return;
    }

    const dayEvents = getEventsForDate(date);
    const companyHoliday = isCompanyHoliday(date);
    const thaiHoliday = isHoliday(date);

    if (dayEvents.length > 0 || companyHoliday || thaiHoliday) {
      onDateClick(date);
    } else {
      // Clear any previous selections for clean single-day click
      clearSelection();
      setTimeout(() => {
        setSelectedPopoverDate(date);
        setPopoverOpen(true);
        setPopoverJustOpened(true);
        // Allow normal closing after a short delay
        setTimeout(() => setPopoverJustOpened(false), 100);
      }, 0);
    }
  };

  const handleMouseDown = (date: Date) => {
    setIsDragging(true);
    setDragStartDate(date);
    setDragEndDate(date);

    // Check if starting date is valid for event creation (only block company holidays)
    const companyHoliday = isCompanyHoliday(date);

    if (!companyHoliday) {
      // Valid starting date (allow overlapping with existing events)
      setSelectedDateRange([date]);
      setHoverDateRange([date]);
    } else {
      // Invalid starting date, but allow drag to continue
      setSelectedDateRange([]);
      setHoverDateRange([date]);
    }
  };

  const handleMouseEnter = (date: Date) => {
    if (!isDragging || !dragStartDate) return;

    setDragEndDate(date);

    // Calculate all dates in the drag range for visual feedback
    const startMoment = moment(dragStartDate);
    const endMoment = moment(date);
    const allDatesInRange = [];
    const validDatesInRange = [];

    if (startMoment.isBefore(endMoment) || startMoment.isSame(endMoment)) {
      const current = startMoment.clone();
      while (current.isSameOrBefore(endMoment)) {
        const currentDate = current.toDate();
        allDatesInRange.push(currentDate);

        // Only exclude company holidays (allow overlapping with existing events)
        const currentHoliday = isCompanyHoliday(currentDate);

        if (!currentHoliday) {
          validDatesInRange.push(currentDate);
        }
        current.add(1, 'day');
      }
    } else {
      const current = endMoment.clone();
      while (current.isSameOrBefore(startMoment)) {
        const currentDate = current.toDate();
        allDatesInRange.push(currentDate);

        // Only exclude company holidays (allow overlapping with existing events)
        const currentHoliday = isCompanyHoliday(currentDate);

        if (!currentHoliday) {
          validDatesInRange.push(currentDate);
        }
        current.add(1, 'day');
      }
      allDatesInRange.reverse();
      validDatesInRange.reverse();
    }

    // Set hover range for visual feedback (all dates)
    setHoverDateRange(allDatesInRange);
    // Set selected range for final selection (only valid dates)
    setSelectedDateRange(validDatesInRange);
  };

  const handleMouseUp = () => {
    if (isDragging && hoverDateRange.length > 1) {
      // Show popover for multi-day selection (use hoverDateRange to include all dragged dates)
      // Use the first valid date from selectedDateRange, or first date from hoverDateRange if no valid dates
      const popoverDate = selectedDateRange.length > 0 ? selectedDateRange[0] : hoverDateRange[0];
      setSelectedPopoverDate(popoverDate);
      setPopoverOpen(true);
    }
    setIsDragging(false);
    // Keep hoverDateRange to show the full drag selection until cleared
  };

  // Add global mouse up event listener
  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);

  const isDateInSelectedRange = (date: Date) => {
    return selectedDateRange.some(rangeDate =>
      moment(rangeDate).isSame(moment(date), 'day')
    );
  };

  const isDateInHoverRange = (date: Date) => {
    return hoverDateRange.some(rangeDate =>
      moment(rangeDate).isSame(moment(date), 'day')
    );
  };

  const clearSelection = () => {
    setSelectedDateRange([]);
    setHoverDateRange([]);
    setDragStartDate(null);
    setDragEndDate(null);
  };

  // Helper function to check if an event continues to adjacent days
  const getEventContinuity = (event: Event, date: Date) => {
    // For multi-day events, check if this date is at the start, middle, or end of the range
    if (event.startDate && event.endDate && event.startDate !== event.endDate) {
      const currentDateStr = moment(date).format('YYYY-MM-DD');
      const prevDateStr = moment(date).subtract(1, 'day').format('YYYY-MM-DD');
      const nextDateStr = moment(date).add(1, 'day').format('YYYY-MM-DD');

      // Check if this is a multi-day event that spans multiple dates
      const hasPrevious = prevDateStr >= event.startDate && prevDateStr <= event.endDate && !isWeekend(moment(date).subtract(1, 'day').toDate());
      const hasNext = nextDateStr >= event.startDate && nextDateStr <= event.endDate && !isWeekend(moment(date).add(1, 'day').toDate());

      return { hasPrevious, hasNext };
    }

    // Fallback to legacy logic for single-day events or old data
    const currentDate = moment(date);
    const prevDate = currentDate.clone().subtract(1, 'day');
    const nextDate = currentDate.clone().add(1, 'day');

    const prevEvents = getEventsForDate(prevDate.toDate());
    const nextEvents = getEventsForDate(nextDate.toDate());

    const hasPrevious = prevEvents.some(e =>
      e.employeeId === event.employeeId &&
      e.leaveType === event.leaveType &&
      !isWeekend(prevDate.toDate()) // Don't connect over weekends
    );

    const hasNext = nextEvents.some(e =>
      e.employeeId === event.employeeId &&
      e.leaveType === event.leaveType &&
      !isWeekend(nextDate.toDate()) // Don't connect over weekends
    );

    return { hasPrevious, hasNext };
  };

  const handleCreateEvent = () => {
    if (selectedDateRange.length > 1) {
      // Create event for date range
      onCreateEvent(selectedDateRange[0], selectedDateRange);
    } else if (selectedPopoverDate) {
      onCreateEvent(selectedPopoverDate);
    }
    clearSelection();
  };

  const days = getDaysArray();

  // Group days into weeks or specific layouts
  const weeks = [];
  const daysPerWeek = viewMode === 'day' ? 2 : 7; // Day mode has 2 days side-by-side or block
  for (let i = 0; i < days.length; i += daysPerWeek) {
    const week = days.slice(i, i + daysPerWeek);
    weeks.push(week);
  }

  const allVisibleDays = weeks.flat();

  return (
    <TooltipProvider>
      <div className="bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
        {/* Header */}
        <div className="p-2 sm:p-3 md:p-4 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-gray-200" />
              <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white">
                {MONTHS[month]} {year}
              </h2>
              {filteredEmployeeId && (
                <div className="flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/50 border border-blue-400 dark:border-blue-600 rounded px-2 py-1">
                  <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                    กรอง: {getEmployeeName(filteredEmployeeId)}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-8">
              {/* Leave Type Legend */}
              <div className="hidden xl:flex items-center gap-2 text-xs mr-4">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-blue-100 dark:bg-blue-800 border border-blue-200 dark:border-blue-600"></div>
                  <span className="text-gray-600 dark:text-gray-300">{LEAVE_TYPE_LABELS.vacation}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-purple-100 dark:bg-purple-800 border border-purple-200 dark:border-purple-600"></div>
                  <span className="text-gray-600 dark:text-gray-300">{LEAVE_TYPE_LABELS.sick}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-stone-50 dark:bg-stone-600 border border-stone-200 dark:border-stone-400"></div>
                  <span className="text-gray-600 dark:text-gray-300">{LEAVE_TYPE_LABELS.personal}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-500"></div>
                  <span className="text-gray-600 dark:text-gray-300">{LEAVE_TYPE_LABELS.other}</span>
                </div>
              </div>

              {onViewModeChange && (
                <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)} className="w-[200px] h-8 hidden sm:block">
                  <TabsList className="grid w-full grid-cols-3 h-8 p-1 bg-white/50 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700">
                    <TabsTrigger value="month" className="text-xs h-6 px-2 rounded data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600 data-[state=active]:shadow-sm">เดือน</TabsTrigger>
                    <TabsTrigger value="week" className="text-xs h-6 px-2 rounded data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600 data-[state=active]:shadow-sm">สัปดาห์</TabsTrigger>
                    <TabsTrigger value="day" className="text-xs h-6 px-2 rounded data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600 data-[state=active]:shadow-sm">วัน</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              <div className="flex space-x-1">
                <Button variant="outline" size="sm" onClick={onTodayClick} className="h-6 sm:h-7 px-2 text-xs sm:text-sm text-gray-500 hover:text-gray-700 dark:text-white dark:hover:text-gray-300 border-gray-200 dark:border-gray-600">
                  วันนี้
                </Button>
                <Button variant="outline" size="sm" onClick={onPrevDate} className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-gray-500 hover:text-gray-700 dark:text-white dark:hover:text-gray-300 border-gray-200 dark:border-gray-600">
                  <ChevronLeft className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={onNextDate} className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-gray-500 hover:text-gray-700 dark:text-white dark:hover:text-gray-300 border-gray-200 dark:border-gray-600">
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile View Mode Tabs */}
        {onViewModeChange && (
          <div className="sm:hidden px-2 pt-2 pb-1 bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700">
            <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
                <TabsTrigger value="month" className="text-sm py-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-300">เดือน</TabsTrigger>
                <TabsTrigger value="week" className="text-sm py-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-300">สัปดาห์</TabsTrigger>
                <TabsTrigger value="day" className="text-sm py-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-300">วัน</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        )}

        {/* Calendar Grid */}
        <div className="p-1 sm:p-2 md:p-3">
          {viewMode === 'month' ? (
            <>
              {/* Days of week header */}
              <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
                {DAYS_OF_WEEK.map((day, index) => (
                  <div key={day} className={`p-1 sm:p-2 text-center text-xs font-medium rounded ${index === 0 || index === 6
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar weeks */}
              <div className="space-y-0.5 sm:space-y-1">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-7 gap-0.5 sm:gap-1">
                    {week.map((date, index) => {
                      const dayEvents = getEventsForDate(date);
                      const isOtherMonth = !isCurrentMonth(date);
                      const isTodayDate = isToday(date);
                      const hasEvents = dayEvents.length > 0;
                      const thaiHoliday = isHoliday(date);
                      const companyHoliday = isCompanyHoliday(date);
                      const weekend = isWeekend(date);
                      const isHighlighted = highlightedDates.includes(moment(date).format('YYYY-MM-DD'));

                      let bgColor = 'bg-white dark:bg-gray-700';
                      let textColor = 'text-gray-900 dark:text-white';
                      let borderColor = 'border-gray-200 dark:border-gray-600';

                      if (isOtherMonth) {
                        bgColor = 'bg-gray-50 dark:bg-gray-800';
                        textColor = 'text-gray-400 dark:text-gray-500'; // Adjusted for better visibility
                        borderColor = 'border-gray-300 dark:border-gray-600';
                      } else { // For current month days
                        // Apply weekend styling first if applicable
                        if (weekend) {
                          bgColor = 'bg-red-50 dark:bg-red-800/30';
                          textColor = 'text-red-700 dark:text-red-300';
                          borderColor = 'border-red-200 dark:border-red-600';
                        } else if (companyHoliday) {
                          // Company holidays get red styling (old Thai holiday colors)
                          textColor = 'text-red-600 dark:text-red-500';
                          borderColor = 'border-red-100 dark:border-red-800';
                        } else if (thaiHoliday) {
                          // Thai holidays get dark gray styling
                          textColor = 'text-gray-600 dark:text-gray-400';
                          borderColor = 'border-gray-300 dark:border-gray-600';
                        }

                        // Today's styling (overrides previous settings for the current day)
                        if (isTodayDate) {
                          bgColor = 'bg-yellow-50 dark:bg-yellow-900/20';
                          borderColor = 'border-yellow-400 dark:border-yellow-500 ring-2 ring-yellow-200 dark:ring-yellow-600';
                          textColor = 'text-yellow-900 dark:text-yellow-200 font-semibold';
                        }

                        // Event styling (modifies border and bgColor if it's a plain day with events)
                        if (hasEvents) {
                          borderColor = 'border-blue-400 dark:border-gray-500';
                          // Only change bgColor for events if it's not today, not a weekend,
                          // and not a non-weekend holiday (which now has default background).
                          if (!isTodayDate && !weekend && !thaiHoliday && !companyHoliday) {
                            bgColor = 'bg-blue-25 dark:bg-gray-800/20';
                          }
                        }

                        // Highlight styling (overrides other styling when highlighted)
                        if (isHighlighted && !isOtherMonth) {
                          bgColor = 'bg-green-100 dark:bg-green-900/30';
                          borderColor = 'border-green-400 dark:border-green-600 ring-1 ring-green-300 dark:ring-green-700';
                        }
                      }

                      const dayContent = (
                        <div
                          key={`${weekIndex}-${index}`}
                          className={`min-h-[45px] sm:min-h-[60px] md:min-h-[75px] lg:min-h-[90px] p-0.5 sm:p-1 border rounded cursor-pointer transition-all duration-200 select-none hover:shadow-sm hover:scale-[1.01] transform ${!isOtherMonth ? 'hover:bg-blue-50 dark:hover:bg-gray-800/30 hover:border-blue-300 dark:hover:border-gray-500' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} ${isDateInSelectedRange(date) || isDateInHoverRange(date) ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-700' : bgColor} ${textColor} ${!(isDateInSelectedRange(date) || isDateInHoverRange(date)) ? borderColor : ''}`}
                          onClick={() => handleDateClick(date)}
                          onMouseDown={() => handleMouseDown(date)}
                          onMouseEnter={() => handleMouseEnter(date)}
                          onMouseUp={handleMouseUp}
                        >
                          <div className={`text-xs font-medium mb-0.5 flex justify-between items-center ${isTodayDate && !isOtherMonth ? 'dark:text-white' : ''}`}>
                            <span>{moment(date).date()}{thaiHoliday ? '*' : ''}</span>
                          </div>

                          {/* Only show events if it's not a weekend and not a company holiday */}
                          {!weekend && !companyHoliday && (
                            <div className={`space-y-0.5 ${isOtherMonth ? 'opacity-40' : ''}`}>
                              {dayEvents.slice(0, maxVisibleEvents).map((event, eventIndex) => {
                                const employeeName = getEmployeeName(event.employeeId);
                                const { hasPrevious, hasNext } = getEventContinuity(event, date);

                                // Determine border radius based on continuity
                                let borderRadius = 'rounded';
                                if (hasPrevious && hasNext) {
                                  borderRadius = 'rounded-none';
                                } else if (hasPrevious && !hasNext) {
                                  borderRadius = 'rounded-l-none rounded-r';
                                } else if (!hasPrevious && hasNext) {
                                  borderRadius = 'rounded-l rounded-r-none';
                                }

                                // Display text formatting - add dashes for middle days
                                let displayText = employeeName;
                                if (hasPrevious && hasNext) {
                                  displayText = `- ${employeeName} -`;
                                }

                                // Z-index based on sorted position to ensure proper layering
                                // Events that appear first in sorted order get lower z-index (appear below)
                                const zIndex = hasPrevious || hasNext ? 10 + eventIndex : 1 + eventIndex;

                                return (
                                  <div
                                    key={event.id}
                                    className={`
                                    text-xs py-0.5 ${borderRadius} border text-center font-normal
                                    ${LEAVE_TYPE_COLORS_SOLID[event.leaveType as keyof typeof LEAVE_TYPE_COLORS_SOLID] || LEAVE_TYPE_COLORS_SOLID.other}
                                    ${hasPrevious ? 'border-l-0' : 'px-0.5 sm:px-1'}
                                    ${hasNext ? 'border-r-0' : 'px-0.5 sm:px-1'}
                                    ${hasPrevious ? '-ml-1 sm:-ml-2 pl-1 sm:pl-2' : ''}
                                    ${hasNext ? '-mr-1 sm:-mr-2 pr-1 sm:pr-2' : ''}
                                    relative overflow-visible
                                  `}
                                    style={{ zIndex }}
                                    title={`${employeeName} - ${LEAVE_TYPE_LABELS[event.leaveType as keyof typeof LEAVE_TYPE_LABELS] || event.leaveType}`}
                                  >
                                    <span className="sm:inline truncate block">
                                      {displayText.length > 12 ? displayText.substring(0, 12) + '...' : displayText}
                                    </span>
                                    <span className="sm:hidden truncate block">
                                      {hasPrevious && hasNext
                                        ? `- ${(employeeName.split(' ')[0] || employeeName).substring(0, 4)} -`
                                        : (employeeName.split(' ')[0] || employeeName).substring(0, 6)
                                      }
                                    </span>
                                  </div>
                                );
                              })}
                              {dayEvents.length > maxVisibleEvents && (
                                <div className="text-xs text-gray-600 text-center font-normal">
                                  +{dayEvents.length - maxVisibleEvents}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Show holidays after events (lower priority) */}
                          {companyHoliday && (
                            <div className={`text-xs bg-red-200 dark:bg-red-600 text-black dark:text-red-100 px-1 py-0.5 rounded mb-0.5 font-normal leading-tight cursor-pointer ${isOtherMonth ? 'opacity-40' : ''}`}>
                              <div className="break-words overflow-hidden leading-tight" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical'
                              }}>
                                {companyHoliday.name}
                              </div>
                            </div>
                          )}

                        </div>
                      );

                      const dayElement = (thaiHoliday || companyHoliday) ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {dayContent}
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <div className="space-y-1">
                              {thaiHoliday && (
                                <div className="text-sm">
                                  {thaiHoliday.name}
                                </div>
                              )}
                              {companyHoliday && (
                                <div className="text-sm">
                                  {companyHoliday.name}
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ) : dayContent;

                      // Check if this date should show the popover for multi-day selection
                      const shouldShowPopover = popoverOpen && selectedPopoverDate && (
                        moment(selectedPopoverDate).isSame(moment(date), 'day') ||
                        (selectedDateRange.length > 1 && isDateInSelectedRange(date) && moment(selectedDateRange[0]).isSame(moment(date), 'day')) ||
                        (hoverDateRange.length > 1 && selectedDateRange.length === 0 && isDateInHoverRange(date) && moment(hoverDateRange[0]).isSame(moment(date), 'day'))
                      );

                      // For multi-day selection, show popover even if the date has events
                      const isMultiDaySelection = (selectedDateRange.length > 1) || (hoverDateRange.length > 1);

                      const isEmptyDate = !hasEvents && !companyHoliday && !thaiHoliday;
                      const isThisDateSelected = selectedPopoverDate && moment(selectedPopoverDate).isSame(moment(date), 'day');
                      const isPopoverOpenForThisDate = shouldShowPopover ||
                        (isEmptyDate && popoverOpen && isThisDateSelected);

                      // Only render popover for the specific date that should show it
                      const shouldUsePopover = isPopoverOpenForThisDate;


                      return shouldUsePopover ? (
                        <CreateEventPopover
                          key={`${weekIndex}-${index}`}
                          isOpen={isPopoverOpenForThisDate}
                          showHolidayDialog={showHolidayDialog}
                          onHolidayDialogChange={(value, date) => {
                            setShowHolidayDialog(value);
                            if (value && date) {
                              setHolidayDate(date);
                            }
                          }}
                          onOpenChange={(open) => {
                            // Prevent immediate close only if just opened
                            if (!open && popoverJustOpened) {
                              return;
                            }
                            setPopoverOpen(open);
                            if (!open) {
                              setSelectedPopoverDate(null);
                              setPopoverJustOpened(false);
                              // Don't reset holiday dialog immediately when popover closes
                              // setShowHolidayDialog(false); 
                              if (isMultiDaySelection) {
                                clearSelection();
                              }
                            }
                          }}
                          onCreateEvent={handleCreateEvent}
                          onHolidayAdded={handleHolidayAdded}
                          selectedDate={selectedPopoverDate}
                          triggerElement={dayElement}
                          isRangeSelection={isMultiDaySelection}
                        />
                      ) : (
                        dayElement
                      );
                    })}
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* Agenda View for Week and Day */
            <div className={`flex ${viewMode === 'day' ? 'flex-col md:flex-row gap-4 lg:gap-6' : 'flex-col gap-3 sm:gap-4'} p-1 sm:p-2 bg-slate-50/50 dark:bg-gray-800/30 rounded-xl min-h-[30vh]`}>
              {days.map((date, dayIndex) => {
                const dayEvents = getEventsForDate(date);
                const thaiHoliday = isHoliday(date);
                const compHoliday = isCompanyHoliday(date);
                const isTodayDate = isToday(date);
                const isTomorrow = moment(date).isSame(moment().add(1, 'day'), 'day');
                const dateKey = moment(date).format('YYYY-MM-DD');
                const isPopoverOpenForThisDate = popoverOpen && selectedPopoverDate && moment(selectedPopoverDate).isSame(moment(date), 'day');

                // In day mode, format the header to clearly distinguish today vs tomorrow
                let dayBadge = null;
                if (isTodayDate) {
                  dayBadge = <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 text-xs px-2 py-0.5 rounded-full font-medium shadow-sm border border-blue-200 dark:border-blue-800">วันนี้</span>;
                } else if (viewMode === 'day' && isTomorrow) {
                  dayBadge = <span className="bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 text-xs px-2 py-0.5 rounded-full font-medium shadow-sm border border-purple-200 dark:border-purple-800">พรุ่งนี้</span>;
                } else if (viewMode === 'day' && dayIndex === 1) {
                  dayBadge = <span className="bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium shadow-sm border border-gray-200 dark:border-gray-600">วันถัดไป</span>;
                }

                const agendaDayHeader = (
                  <div className="flex justify-between items-center mb-0 px-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-200">
                        {formatDate(date)}{thaiHoliday ? '*' : ''}
                      </h3>
                      {dayBadge}
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => { setSelectedPopoverDate(date); setPopoverOpen(true); }}
                          className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>เพิ่มรายการบนวันนี้</TooltipContent>
                    </Tooltip>
                  </div>
                );

                return (
                  <div
                    key={dateKey}
                    className="flex-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-visible transition-colors"
                  >
                    <div className="p-3 sm:p-5 h-full">

                      {isPopoverOpenForThisDate ? (
                        <CreateEventPopover
                          isOpen={isPopoverOpenForThisDate}
                          showHolidayDialog={showHolidayDialog}
                          onHolidayDialogChange={(val, d) => { setShowHolidayDialog(val); if (val && d) setHolidayDate(d); }}
                          onOpenChange={(open) => { setPopoverOpen(open); if (!open) setSelectedPopoverDate(null); }}
                          onCreateEvent={() => { onCreateEvent(date); setPopoverOpen(false); }}
                          onHolidayAdded={handleHolidayAdded}
                          selectedDate={date}
                          triggerElement={agendaDayHeader}
                          isRangeSelection={false}
                        />
                      ) : agendaDayHeader}

                      <div className="flex flex-col gap-2 mt-3">
                        {/* Company Holiday */}
                        {compHoliday && (
                          <div
                            className="flex items-start gap-3 p-3 sm:p-4 rounded-xl bg-red-50/80 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-800 dark:text-red-300 cursor-pointer hover:bg-red-100/80 dark:hover:bg-red-900/40 transition-colors shadow-sm"
                            onClick={() => onDateClick(date)}
                          >
                            <div className="mt-0.5 text-red-500 dark:text-red-400 bg-white dark:bg-red-950 p-1.5 rounded-full shadow-sm">
                              <Calendar size={18} />
                            </div>
                            <div className="w-full">
                              <div className="flex justify-between items-start">
                                <p className="font-semibold text-sm">วันหยุดบริษัท</p>
                              </div>
                              <p className="text-sm mt-0.5 font-medium">{compHoliday.name}</p>
                              {compHoliday.description && <p className="text-xs mt-1.5 opacity-90 leading-relaxed border-t border-red-200 dark:border-red-800 pt-1.5">{compHoliday.description}</p>}
                            </div>
                          </div>
                        )}

                        {/* Events */}
                        {dayEvents.map((event) => {
                          const employeeName = getEmployeeName(event.employeeId);
                          const colorClass = LEAVE_TYPE_COLORS_SOLID[event.leaveType as keyof typeof LEAVE_TYPE_COLORS_SOLID] || LEAVE_TYPE_COLORS_SOLID.other;
                          const label = LEAVE_TYPE_LABELS[event.leaveType as keyof typeof LEAVE_TYPE_LABELS] || event.leaveType;

                          return (
                            <div
                              key={event.id}
                              onClick={() => onDateClick(date)}
                              className="cursor-pointer group flex items-stretch gap-3 p-3 sm:p-4 rounded-xl border border-gray-100 dark:border-gray-700/60 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all bg-white dark:bg-gray-800 relative overflow-hidden"
                            >
                              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${colorClass}`} />
                              <div className="pl-1.5 flex-1 flex flex-col justify-center">
                                <div className="flex justify-between items-center gap-2">
                                  <p className="font-semibold text-sm sm:text-base text-gray-900 dark:text-gray-100 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors">{employeeName}</p>
                                  <span className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap font-medium ${colorClass}`}>{label}</span>
                                </div>
                                {event.description && (
                                  <div className="mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800 leading-relaxed">
                                    {event.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {dayEvents.length === 0 && !compHoliday && (
                          <div className="p-3 sm:p-4 flex items-center justify-center gap-2 text-center rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 min-h-[60px]">
                            <p className="text-sm text-gray-400 dark:text-gray-500">ไม่มีรายการใดๆ</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Holiday Modal - rendered at CalendarGrid level */}
      {showHolidayDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => {
            setShowHolidayDialog(false);
            setHolidayDate(null);
            setHolidayName('');
            setHolidayDescription('');
          }}
        >
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg max-w-md w-[90%]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">
              เพิ่มวันหยุดบริษัท
            </h2>
            <p className="mb-4 text-gray-600 dark:text-gray-400">
              วันที่: {holidayDate ? holidayDate.toLocaleDateString('th-TH') : 'ไม่ระบุ'}
            </p>
            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">ชื่อวันหยุด:</label>
              <input
                type="text"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="เช่น วันหยุดบริษัท"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <div className="mb-6">
              <label className="block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">คำอธิบาย:</label>
              <input
                type="text"
                value={holidayDescription}
                onChange={(e) => setHolidayDescription(e.target.value)}
                placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowHolidayDialog(false);
                  setHolidayDate(null);
                  setHolidayName('');
                  setHolidayDescription('');
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                ยกเลิก
              </button>
              <button
                onClick={async () => {
                  try {
                    const { createCompanyHoliday } = await import('@/services/companyHolidayService');

                    if (!holidayDate) return;

                    // Use local date format to avoid timezone issues
                    const year = holidayDate.getFullYear();
                    const month = String(holidayDate.getMonth() + 1).padStart(2, '0');
                    const day = String(holidayDate.getDate()).padStart(2, '0');
                    const dateString = `${year}-${month}-${day}`;
                    await createCompanyHoliday({
                      name: holidayName,
                      date: dateString,
                      description: holidayDescription || ''
                    });

                    // Refresh calendar data
                    if (onHolidayAdded) {
                      onHolidayAdded();
                    }

                    setShowHolidayDialog(false);
                    setHolidayDate(null);
                    setHolidayName('');
                    setHolidayDescription('');
                  } catch (error) {
                    console.error('Error creating holiday:', error);
                    alert('เกิดข้อผิดพลาดในการเพิ่มวันหยุด');
                  }
                }}
                disabled={!holidayName.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                เพิ่ม
              </button>
            </div>
          </div>
        </div>
      )}
    </TooltipProvider>
  );
};
