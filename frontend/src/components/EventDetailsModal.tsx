
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, User, FileText, MessageSquare, Plus, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Event } from '@/services/apiDatabase';
import { LEAVE_TYPE_LABELS, LEAVE_TYPE_THEME_COLORS, formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateEvent: () => void;
  onEditEvent?: (event: Event) => void;
  onDeleteEvent?: (eventId: number) => void;
  events: Event[];
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
  employees,
  selectedDate,
  companyHoliday,
  onEditCompanyHoliday,
  onDeleteCompanyHoliday
}) => {
  const { isAdminAuthenticated } = useAuth();

  const handleCreateEvent = () => {
    onCreateEvent();
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

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg transform transition-all max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-600 dark:text-gray-200" />
              <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white">เหตุการณ์ในวันนี้</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
              <X className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            </Button>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1 sm:mt-2">
            {formatDate(selectedDate)}
          </p>
        </div>

        {/* Events List */}
        <div className="p-3 sm:p-4 md:p-6 max-h-60 sm:max-h-80 overflow-y-auto">
          {(events.length > 0 || companyHoliday) ? (
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
              {events.map((event) => (
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
                      </div>

                      {event.description && (
                        <div className="flex items-start space-x-2">
                          <MessageSquare className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-600 dark:text-gray-300 line-clamp-2">{event.description}</span>
                        </div>
                      )}
                    </div>

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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 sm:py-6 md:py-8 text-gray-500 dark:text-gray-400">
              <Calendar className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mx-auto mb-2 sm:mb-3 text-gray-300 dark:text-gray-600" />
              <p className="text-xs sm:text-sm md:text-base">ไม่มีเหตุการณ์ในวันนี้</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 md:p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <Button
            onClick={handleCreateEvent}
            className="w-full bg-blue-600 hover:bg-blue-700 dark:bg-gray-700 dark:hover:bg-gray-800 text-white text-xs sm:text-sm h-8 sm:h-9"
          >
            <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            สร้างเหตุการณ์ใหม่
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full text-xs sm:text-sm h-8 sm:h-9">
            ปิด
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
