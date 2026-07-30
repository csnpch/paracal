import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, User, FileText, MessageSquare, Plus, Edit, Trash2, Clock3, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Event } from '@/services/apiDatabase';
import type { JiraWorklogEntry } from '@/services/api';
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_THEME_COLORS, formatDate, EVENT_CONTACT_ADMIN_MESSAGE } from '@/lib/utils';
import { formatWorklogDuration, formatWorklogHours, getJiraIssueUrl, getWorklogDayTotalSeconds, WORKLOG_TARGET_SECONDS } from '@/lib/worklog';
import moment from 'moment';
import { useAuth } from '@/contexts/AuthContext';

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateEvent?: () => void;
  onEditEvent?: (event: Event) => void;
  onDeleteEvent?: (eventId: number) => void;
  events: Event[];
  worklogs?: JiraWorklogEntry[];
  worklogMode?: boolean;
  employees: { id: number; name: string }[];
  selectedDate: Date | null;
  companyHoliday?: { id: number; name: string; description?: string } | null;
  onEditCompanyHoliday?: (holiday: { id: number; name: string; description?: string }) => void;
  onDeleteCompanyHoliday?: (holidayId: number) => void;
}

export const EventDetailsModal: React.FC<EventDetailsModalProps> = ({
  isOpen,
  onClose,
  onCreateEvent,
  onEditEvent,
  onDeleteEvent,
  events,
  worklogs = [],
  worklogMode = false,
  employees,
  selectedDate,
  companyHoliday,
  onEditCompanyHoliday,
  onDeleteCompanyHoliday
}) => {
  const { isAdminAuthenticated } = useAuth();

  const handleCreateEvent = () => {
    onCreateEvent?.();
    onClose();
  };

  const getEmployeeName = (employeeId: number) => {
    if (!Array.isArray(employees)) return 'Unknown Employee';
    const employee = employees.find(emp => emp.id === employeeId);
    return employee?.name || 'Unknown Employee';
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen || !selectedDate) return null;

  const worklogTotalSeconds = getWorklogDayTotalSeconds(worklogs);
  const worklogDayComplete = worklogTotalSeconds >= WORKLOG_TARGET_SECONDS;
  const hasContent = events.length > 0 || !!companyHoliday || worklogs.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg transform transition-all max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-600 dark:text-gray-200" />
              <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white">
                {worklogMode ? 'Day details' : 'เหตุการณ์ในวันนี้'}
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
              <X className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1 sm:mt-2">
            {formatDate(selectedDate)}
            {worklogMode && worklogs.length > 0 && (
              <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${worklogDayComplete ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100'}`}>
                {formatWorklogHours(worklogTotalSeconds)}h logged
              </span>
            )}
          </p>
        </div>

        {/* Events List */}
        <div className="p-3 sm:p-4 md:p-6 flex-1 min-h-0 max-h-[60vh] sm:max-h-80 md:max-h-96 overflow-y-auto">
          {hasContent ? (
            <div className="space-y-2">
              {/* Company Holiday */}
              {companyHoliday && (
                <div className="p-3 rounded-lg border-l-4 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-500 dark:border-red-400">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        <span className="font-normal text-sm">{companyHoliday.name}</span>
                      </div>
                      {companyHoliday.description && (
                        <div className="flex items-start space-x-2">
                          <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="text-xs line-clamp-2">{companyHoliday.description}</span>
                        </div>
                      )}
                    </div>

                    {isAdminAuthenticated && (
                      <div className="flex space-x-1 ml-2">
                        {onEditCompanyHoliday && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditCompanyHoliday(companyHoliday)}
                            className="h-7 w-7 p-0 text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-gray-100"
                            title="แก้ไขวันหยุด"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                        {onDeleteCompanyHoliday && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (window.confirm('คุณต้องการลบวันหยุดนี้หรือไม่?')) {
                                onDeleteCompanyHoliday(companyHoliday.id);
                              }
                            }}
                            className="h-7 w-7 p-0 text-gray-600 hover:text-red-600 dark:text-gray-300 dark:hover:text-red-400"
                            title="ลบวันหยุด"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Employee Events */}
              {events.map((event) => {
                const isStart = selectedDate ? moment(selectedDate).isSame(event.startDate, 'day') : false;
                const isEnd = selectedDate ? moment(selectedDate).isSame(event.endDate, 'day') : false;
                const dayIsMorning = (event.leaveDuration === 'morning' && isEnd) || ((event.leaveDuration === 'full_morning' || event.leaveDuration === 'afternoon_morning') && isEnd);
                const dayIsAfternoon = (event.leaveDuration === 'afternoon' && isStart) || ((event.leaveDuration === 'afternoon_full' || event.leaveDuration === 'afternoon_morning') && isStart);
                const durationLabel = dayIsMorning && dayIsAfternoon ? '🌤️🌥️ ครึ่งเช้า-บ่าย' : dayIsMorning ? '🌤️ ครึ่งเช้า' : dayIsAfternoon ? '🌥️ ครึ่งบ่าย' : null;

                return (
                <div
                  key={event.id}
                  className="p-3 rounded-lg border-l-4 transition-all hover:shadow-sm bg-gray-50 dark:bg-gray-700"
                  style={{ borderLeftColor: LEAVE_TYPE_THEME_COLORS[event.leaveType as keyof typeof LEAVE_TYPE_THEME_COLORS] || LEAVE_TYPE_THEME_COLORS.other }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <User className="w-3 h-3 flex-shrink-0" />
                        <span className="font-normal text-sm truncate">{getEmployeeName(event.employeeId)}</span>
                      </div>

                      <div className="flex items-center space-x-2 mb-1">
                        <FileText className="w-3 h-3 flex-shrink-0" />
                        <span className="text-xs">{LEAVE_TYPE_LABELS[event.leaveType as keyof typeof LEAVE_TYPE_LABELS]}</span>
                        {durationLabel && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700 whitespace-nowrap">
                            {durationLabel}
                          </span>
                        )}
                      </div>

                      {event.description && (
                        <div className="flex items-start space-x-2">
                          <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{event.description}</span>
                        </div>
                      )}
                    </div>

                    {isAdminAuthenticated && (
                      <div className="flex space-x-1 ml-2">
                        {onEditEvent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditEvent(event)}
                            className="h-7 w-7 p-0 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-gray-200"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                        {onDeleteEvent && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteEvent(event.id)}
                            className="h-7 w-7 p-0 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                );
              })}

              {worklogMode && worklogs.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 px-1">Jira Worklogs ({worklogs.length})</p>
                  {worklogs.map((entry) => (
                    <a
                      key={entry.id}
                      href={getJiraIssueUrl(entry)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block p-3 rounded-lg border transition-all hover:shadow-md ${worklogDayComplete ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 dark:hover:bg-emerald-950/50' : 'bg-gray-100 border-gray-200 hover:bg-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600/80'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{entry.projectKey}</span>
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-blue-300">
                              {entry.issueKey}
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 dark:text-gray-100 line-clamp-2">{entry.issueSummary}</p>
                          {entry.comment && (
                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 line-clamp-2">{entry.comment}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-200">
                            <Clock3 className="w-3 h-3" />
                            {formatWorklogDuration(entry.seconds)}
                          </span>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                            {moment(entry.started).format('HH:mm')}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 sm:py-6 md:py-8 text-gray-500 dark:text-gray-400">
              <Calendar className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mx-auto mb-2 sm:mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-xs sm:text-sm md:text-base">
                {worklogMode ? 'No worklogs or events on this day' : 'ไม่มีเหตุการณ์ในวันนี้'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {!isAdminAuthenticated && !worklogMode ? (
          <div className="p-3 sm:p-4 md:p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex items-center justify-between gap-3">
            <p className="flex-1 min-w-0 text-sm text-gray-500 dark:text-gray-400 text-left leading-relaxed break-words">
              {EVENT_CONTACT_ADMIN_MESSAGE}
            </p>
            <Button
              variant="outline"
              onClick={onClose}
              className="shrink-0 text-xs sm:text-sm h-8 sm:h-9 min-w-28"
            >
              ปิด
            </Button>
          </div>
        ) : (
          <div className={`p-3 sm:p-4 md:p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex flex-col ${isAdminAuthenticated && onCreateEvent && !worklogMode ? 'sm:flex-row sm:space-y-0 sm:space-x-3' : 'items-end'}`}>
            {isAdminAuthenticated && onCreateEvent && !worklogMode && (
              <Button
                onClick={handleCreateEvent}
                className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-gray-700 dark:hover:bg-gray-800 text-white text-xs sm:text-sm h-8 sm:h-9"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                สร้างเหตุการณ์ใหม่
              </Button>
            )}
            <Button
              variant="outline"
              onClick={onClose}
              className={`text-xs sm:text-sm h-8 sm:h-9 ${isAdminAuthenticated && onCreateEvent && !worklogMode ? 'w-full' : 'w-full sm:w-auto sm:min-w-28'}`}
            >
              ปิด
            </Button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
