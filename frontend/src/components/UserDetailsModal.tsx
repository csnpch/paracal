import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar, Clock, User, TrendingUp } from 'lucide-react';
import { getEventsByEmployee, EmployeeEvent } from '@/services/api';
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_THEME_COLORS } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  employeeData: {
    name: string;
    totalEvents: number;
    eventTypes: Record<string, number>;
  } | null;
  dateRange?: {
    from: string;
    to: string;
  };
}

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

const formatTime = (dateString: string) => {
  return new Date(dateString).toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  isOpen,
  onClose,
  employeeName,
  employeeData,
  dateRange,
}) => {
  const { theme } = useTheme();
  const [events, setEvents] = useState<EmployeeEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && employeeName) {
      loadEmployeeEvents();
    }
  }, [isOpen, employeeName, dateRange]);

  const loadEmployeeEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        employeeName: employeeName,
      };

      if (dateRange) {
        params.startDate = dateRange.from;
        params.endDate = dateRange.to;
      }

      const eventData = await getEventsByEmployee(params);
      setEvents(eventData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load employee events');
    } finally {
      setLoading(false);
    }
  };

  // Group events by year, month, then date
  const groupedEvents = events.reduce((groups: Record<string, Record<string, Record<string, EmployeeEvent[]>>>, event) => {
    // Use startDate for multi-day events, fallback to date for legacy single-day events
    const dateToUse = event.date || event.startDate;
    const eventDate = new Date(dateToUse);
    const year = eventDate.getFullYear().toString();
    const month = eventDate.toLocaleDateString('th-TH', { month: 'long' });
    const date = dateToUse;

    if (!groups[year]) {
      groups[year] = {};
    }
    if (!groups[year][month]) {
      groups[year][month] = {};
    }
    if (!groups[year][month][date]) {
      groups[year][month][date] = [];
    }

    groups[year][month][date].push(event);
    return groups;
  }, {});

  // Sort years, months, and dates
  const sortedYears = Object.keys(groupedEvents).sort((a, b) => parseInt(b) - parseInt(a));

  const getSortedMonths = (year: string) => {
    const months = Object.keys(groupedEvents[year]);
    return months.sort((a, b) => {
      const monthsOrder = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      return monthsOrder.indexOf(b) - monthsOrder.indexOf(a);
    });
  };

  const getSortedDates = (year: string, month: string) => {
    return Object.keys(groupedEvents[year][month]).sort((a, b) =>
      new Date(b).getTime() - new Date(a).getTime()
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            รายละเอียดของ {employeeName}
          </DialogTitle>
        </DialogHeader>

        {employeeData && (
          <div className="space-y-4">
            {/* Timeline */}
            <div className="space-y-2">
              <h4 className="font-normal text-gray-900 dark:text-white flex items-center gap-2">
                <Clock className="h-4 w-4" />
                เส้นเวลาเหตุการณ์
              </h4>

              <ScrollArea className="h-[75vh] w-full">
                {loading && (
                  <div className="flex justify-center py-8">
                    <div className="text-gray-500">กำลังโหลดข้อมูล...</div>
                  </div>
                )}

                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    เกิดข้อผิดพลาด: {error}
                  </div>
                )}

                {!loading && !error && (
                  <div className="space-y-2 pr-4">
                    {sortedYears.length === 0 ? (
                      <div className="text-center py-4 text-gray-500">
                        ไม่พบเหตุการณ์ในช่วงเวลาที่เลือก
                      </div>
                    ) : (
                      sortedYears.map((year, yearIndex) => (
                        <div key={year} className="relative">
                          {/* Year Header */}
                          <div className="sticky top-0 bg-white dark:bg-gray-800 z-30 py-1 mb-2">
                            <div className="text-lg font-normal text-gray-900 dark:text-white border-l-4 border-purple-500 pl-4 bg-purple-50 dark:bg-purple-900/20 rounded-r-lg py-1">
                              ปี {parseInt(year) + 543}
                            </div>
                          </div>

                          {/* Months in this year */}
                          <div className="ml-4 space-y-2">
                            {getSortedMonths(year).map((month, monthIndex) => (
                              <div key={month} className="relative">
                                {/* Month Header */}
                                <div className="sticky top-12 bg-white dark:bg-gray-800 z-20 py-1 mb-1">
                                  <div className="text-base font-normal text-gray-800 dark:text-gray-200 border-l-4 border-green-500 pl-3 bg-green-50 dark:bg-green-900/20 rounded-r py-0.5">
                                    {month} {parseInt(year) + 543}
                                  </div>
                                </div>

                                {/* Dates in this month */}
                                <div className="ml-3 space-y-1">
                                  {getSortedDates(year, month).map((date, dateIndex) => (
                                    <div key={date} className="relative">
                                      {/* Date Header */}
                                      <div className="sticky top-16 bg-white dark:bg-gray-800 z-10 py-1 mb-1">
                                        <div className="text-sm font-normal text-gray-700 dark:text-gray-300 border-l-4 border-blue-500 pl-3 bg-blue-50 dark:bg-blue-900/20 rounded-r py-0.5">
                                          {formatDate(date)}
                                        </div>
                                      </div>

                                      {/* Events for this date */}
                                      <div className="ml-4 space-y-1">
                                        {groupedEvents[year][month][date].map((event, eventIndex) => {
                                          const isLastEvent = yearIndex === sortedYears.length - 1 &&
                                            monthIndex === getSortedMonths(year).length - 1 &&
                                            dateIndex === getSortedDates(year, month).length - 1 &&
                                            eventIndex === groupedEvents[year][month][date].length - 1;

                                          return (
                                            <div key={event.id} className="relative">
                                              {/* Timeline line */}
                                              {!isLastEvent && (
                                                <div className="absolute left-2 top-6 w-0.5 h-full bg-gray-200 dark:bg-gray-600" />
                                              )}

                                              {/* Timeline dot */}
                                              <div className="absolute left-0 top-2 w-4 h-4 bg-blue-500 border-2 border-white dark:border-gray-800 rounded-full" />

                                              {/* Event content */}
                                              <div className="ml-6 pb-2">
                                                <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">
                                                  <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                      <h5 className="font-normal text-gray-900 dark:text-white">
                                                        {LEAVE_TYPE_LABELS[event.leaveType as keyof typeof LEAVE_TYPE_LABELS] || event.leaveType}
                                                      </h5>
                                                      {event.description && (
                                                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
                                                          {event.description}
                                                        </p>
                                                      )}
                                                    </div>
                                                    <Badge
                                                      variant="outline"
                                                      style={{
                                                        backgroundColor: theme === 'dark'
                                                          ? (LEAVE_TYPE_THEME_COLORS[event.leaveType as keyof typeof LEAVE_TYPE_THEME_COLORS] || LEAVE_TYPE_THEME_COLORS.other)
                                                          : `${LEAVE_TYPE_THEME_COLORS[event.leaveType as keyof typeof LEAVE_TYPE_THEME_COLORS] || LEAVE_TYPE_THEME_COLORS.other}30`,
                                                        borderColor: LEAVE_TYPE_THEME_COLORS[event.leaveType as keyof typeof LEAVE_TYPE_THEME_COLORS] || LEAVE_TYPE_THEME_COLORS.other,
                                                        color: theme === 'dark'
                                                          ? '#ffffff'
                                                          : (LEAVE_TYPE_THEME_COLORS[event.leaveType as keyof typeof LEAVE_TYPE_THEME_COLORS] || LEAVE_TYPE_THEME_COLORS.other)
                                                      }}
                                                    >
                                                      {LEAVE_TYPE_LABELS[event.leaveType as keyof typeof LEAVE_TYPE_LABELS] || event.leaveType}
                                                    </Badge>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};