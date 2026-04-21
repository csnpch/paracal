import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Calendar, FileText, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { Textarea } from '@/components/ui/textarea';
import { Event, LeaveDuration } from '@/services/apiDatabase';
import { LEAVE_TYPE_LABELS, formatDate } from '@/lib/utils';
import moment from 'moment';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: {
    employeeId: number;
    employeeName: string;
    leaveType: string;
    leaveDuration: LeaveDuration;
    startDate: string;
    endDate: string;
    description?: string;
  }) => void;
  selectedDate: Date | null;
  selectedDateRange?: Date[];
  employees: { id: number; name: string }[];
  editingEvent?: Event | null;
  companyHolidays?: any[];
}

const LEAVE_TYPES = Object.entries(LEAVE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label
}));

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedDate,
  selectedDateRange,
  employees,
  editingEvent,
  companyHolidays = []
}) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [leaveType, setLeaveType] = useState('');
  const [leaveDuration, setLeaveDuration] = useState<LeaveDuration>('full');
  const [startLeaveDuration, setStartLeaveDuration] = useState<'full' | 'afternoon'>('full');
  const [endLeaveDuration, setEndLeaveDuration] = useState<'full' | 'morning'>('full');
  const [description, setDescription] = useState('');

  // Date range states
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize form with editing event data
  useEffect(() => {
    if (editingEvent) {
      setSelectedEmployeeId(editingEvent.employeeId);
      setLeaveType(editingEvent.leaveType);

      const isMulti = editingEvent.startDate !== editingEvent.endDate;
      if (isMulti) {
        if (editingEvent.leaveDuration === 'afternoon_full') {
          setStartLeaveDuration('afternoon');
          setEndLeaveDuration('full');
          setLeaveDuration('full');
        } else if (editingEvent.leaveDuration === 'full_morning') {
          setStartLeaveDuration('full');
          setEndLeaveDuration('morning');
          setLeaveDuration('full');
        } else if (editingEvent.leaveDuration === 'afternoon_morning') {
          setStartLeaveDuration('afternoon');
          setEndLeaveDuration('morning');
          setLeaveDuration('full');
        } else {
          setStartLeaveDuration('full');
          setEndLeaveDuration('full');
          setLeaveDuration(editingEvent.leaveDuration || 'full');
        }
      } else {
        setLeaveDuration(editingEvent.leaveDuration || 'full');
        setStartLeaveDuration('full');
        setEndLeaveDuration('full');
      }

      setDescription(editingEvent.description || '');
      setUseCustomDates(false);
    } else {
      setSelectedEmployeeId(null);
      setLeaveType('');
      setLeaveDuration('full');
      setStartLeaveDuration('full');
      setEndLeaveDuration('full');
      setDescription('');

      // Initialize custom dates if we have a date range
      if (selectedDateRange && selectedDateRange.length > 1) {
        setCustomStartDate(moment(selectedDateRange[0]).format('YYYY-MM-DD'));
        setCustomEndDate(moment(selectedDateRange[selectedDateRange.length - 1]).format('YYYY-MM-DD'));
        setUseCustomDates(true);
        setShowAdvanced(false); // Always hidden by default
      } else {
        setCustomStartDate(selectedDate ? moment(selectedDate).format('YYYY-MM-DD') : '');
        setCustomEndDate('');
        setUseCustomDates(false);
        setShowAdvanced(false);
      }
    }
  }, [editingEvent, isOpen, selectedDateRange, selectedDate]);

  const generateDateRange = (startDate: string, endDate: string): Date[] => {
    const dates = [];
    let current = moment(startDate);
    const end = moment(endDate);

    while (current.isSameOrBefore(end)) {
      dates.push(current.toDate());
      current = current.clone().add(1, 'day');
    }

    return dates;
  };

  const handleSave = () => {
    if (!selectedEmployeeId || !leaveType) return;
    if (!Array.isArray(employees)) return;

    // Validate custom dates only when advanced panel is open and in use
    if (useCustomDates && showAdvanced && !customStartDate) {
      alert('กรุณาเลือกวันที่เริ่มต้น');
      return;
    }

    // Validate that we have either selectedDate or custom dates
    if (!selectedDate && (!useCustomDates || !customStartDate)) return;

    const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId);
    if (!selectedEmployee) return;

    let startDate: string;
    let endDate: string;

    // Determine start and end dates
    if (useCustomDates && showAdvanced && customStartDate) {
      // Use custom date range
      startDate = customStartDate;
      endDate = customEndDate || customStartDate;
    } else if (selectedDateRange && selectedDateRange.length > 1) {
      // Use original selected date range
      startDate = moment(selectedDateRange[0]).format('YYYY-MM-DD');
      endDate = moment(selectedDateRange[selectedDateRange.length - 1]).format('YYYY-MM-DD');
    } else if (selectedDate) {
      // Single date event
      startDate = moment(selectedDate).format('YYYY-MM-DD');
      endDate = moment(selectedDate).format('YYYY-MM-DD');
    } else {
      return; // No valid dates
    }

    let finalLeaveDuration: LeaveDuration = leaveDuration;
    if (startDate !== endDate) {
      if (startLeaveDuration === 'afternoon' && endLeaveDuration === 'morning') {
        finalLeaveDuration = 'afternoon_morning';
      } else if (startLeaveDuration === 'afternoon') {
        finalLeaveDuration = 'afternoon_full';
      } else if (endLeaveDuration === 'morning') {
        finalLeaveDuration = 'full_morning';
      } else {
        finalLeaveDuration = 'full';
      }
    }

    // Auto-generate description for multi-day events
    let finalDescription = description;

    // If it's a multi-day event (different start and end dates), add date range info to description
    if (startDate !== endDate) {
      const startFormatted = moment(startDate).format('DD/MM/YYYY');
      const endFormatted = moment(endDate).format('DD/MM/YYYY');
      const dateRangeInfo = `ช่วงวันที่: ${startFormatted} - ${endFormatted}`;

      if (description.trim()) {
        finalDescription = `${dateRangeInfo} - ${description}`;
      } else {
        finalDescription = dateRangeInfo;
      }
    }

    // Create a single multi-day event
    onSave({
      employeeId: selectedEmployeeId,
      employeeName: selectedEmployee.name,
      leaveType,
      leaveDuration: finalLeaveDuration,
      startDate,
      endDate,
      description: finalDescription
    });

    // Reset form
    setSelectedEmployeeId(null);
    setLeaveType('');
    setLeaveDuration('full');
    setStartLeaveDuration('full');
    setEndLeaveDuration('full');
    setDescription('');
    setCustomStartDate('');
    setCustomEndDate('');
    setUseCustomDates(false);
    onClose();
  };


  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[1000] p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-xs sm:max-w-sm md:max-w-md transform transition-all max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-gray-200 dark:border-gray-600 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-700 dark:to-gray-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-blue-600 dark:text-gray-200" />
              <h3 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold text-gray-900 dark:text-white">
                {editingEvent ? 'แก้ไขเหตุการณ์' : 'สร้างเหตุการณ์ใหม่'}
              </h3>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
              <X className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            </Button>
          </div>
          {selectedDateRange && selectedDateRange.length > 1 ? (() => {
            let validDays = 0;
            const startMoment = moment(selectedDateRange[0]);
            const endMoment = moment(selectedDateRange[selectedDateRange.length - 1]);

            if (startMoment.isValid() && endMoment.isValid()) {
              const current = startMoment.clone();
              while (current.isSameOrBefore(endMoment)) {
                const date = current.toDate();
                const isWeekend = current.day() === 0 || current.day() === 6;
                const dateString = moment(date).format('YYYY-MM-DD');
                const isCompanyHoliday = companyHolidays.some((h: any) => h.date === dateString);
                if (!isCompanyHoliday && !isWeekend) {
                  validDays++;
                }
                current.add(1, 'day');
              }
            }

            return (
              <div className="flex flex-col text-xs sm:text-sm text-gray-700 dark:text-gray-200 mt-2 space-y-0.5">
                <span>วันเริ่มต้น: {formatDate(selectedDateRange[0])}</span>
                <span>วันสิ้นสุด: {formatDate(selectedDateRange[selectedDateRange.length - 1])}</span>
                <span className="text-blue-700 dark:text-blue-300 font-medium pt-0.5 flex flex-col gap-0.5">
                  <span>👉 เลือกรวมทั้งหมด {validDays} วัน</span>
                  <span className="text-blue-500 dark:text-blue-400 font-normal opacity-90 text-[11px] sm:text-xs ml-4">* ไม่รวมวันหยุดบริษัทและเสาร์-อาทิตย์</span>
                </span>
              </div>
            );
          })() : (
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 mt-1 sm:mt-2">
              {selectedDate ? formatDate(selectedDate) : ''}
            </p>
          )}
        </div>

        {/* Form */}
        <div className="p-3 sm:p-4 md:p-6 pb-6 sm:pb-8 space-y-4 sm:space-y-6">
          {/* Employee Selection */}
          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="employee" className="flex items-center space-x-2 text-xs sm:text-sm">
              <User className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400" />
              <span>ชื่อพนักงาน</span>
            </Label>
            <Combobox
              options={employees.map(emp => ({ value: emp.id.toString(), label: emp.name }))}
              value={selectedEmployeeId?.toString() || ''}
              onValueChange={(value) => setSelectedEmployeeId(value ? parseInt(value) : null)}
              placeholder="รายชื่อพนักงาน"
              searchPlaceholder="ค้นหาพนักงาน..."
              emptyMessage="ไม่พบพนักงาน"
              className="h-8 sm:h-9 text-xs sm:text-sm"
            />
          </div>

          {/* Event Type */}
          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="leaveType" className="flex items-center space-x-2 text-xs sm:text-sm">
              <FileText className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400" />
              <span>ประเภทเหตุการณ์</span>
            </Label>
            <Combobox
              options={LEAVE_TYPES.map(type => ({ value: type.value, label: type.label }))}
              value={leaveType}
              onValueChange={setLeaveType}
              placeholder="เลือกประเภทเหตุการณ์"
              searchPlaceholder="ค้นหาประเภท..."
              emptyMessage="ไม่พบประเภทเหตุการณ์"
              className="h-8 sm:h-9 text-xs sm:text-sm"
            />
          </div>

          {/* Duration */}
          <div className="space-y-1 sm:space-y-2">
            <Label className="flex items-center space-x-2 text-xs sm:text-sm">
              <span className="text-[16px]">⏱️</span>
              <span>ระยะเวลาการลา</span>
            </Label>

            {(() => {
              let isMultiDay = false;
              if (useCustomDates && showAdvanced && customStartDate) {
                isMultiDay = customEndDate ? customEndDate !== customStartDate : false;
              } else if (selectedDateRange && selectedDateRange.length > 1) {
                isMultiDay = true;
              }

              if (isMultiDay) {
                return (
                  <div className="space-y-2">
                    <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800">
                      <div className="px-3 flex items-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs sm:text-sm border-r border-gray-200 dark:border-gray-600 min-w-[80px]">วันเริ่มต้น</div>
                      <button
                        type="button"
                        className={`flex-1 py-1.5 text-xs sm:text-sm font-medium transition-colors ${startLeaveDuration === 'full' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        onClick={() => setStartLeaveDuration('full')}
                      >
                        ◉ เต็มวัน
                      </button>
                      <div className="w-px bg-gray-200 dark:bg-gray-700"></div>
                      <button
                        type="button"
                        className={`flex-1 py-1.5 text-xs sm:text-sm font-medium transition-colors ${startLeaveDuration === 'afternoon' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        onClick={() => setStartLeaveDuration('afternoon')}
                      >
                        ○ ครึ่งบ่าย
                      </button>
                    </div>

                    <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800">
                      <div className="px-3 flex items-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs sm:text-sm border-r border-gray-200 dark:border-gray-600 min-w-[80px]">วันสิ้นสุด</div>
                      <button
                        type="button"
                        className={`flex-1 py-1.5 text-xs sm:text-sm font-medium transition-colors ${endLeaveDuration === 'full' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        onClick={() => setEndLeaveDuration('full')}
                      >
                        ◉ เต็มวัน
                      </button>
                      <div className="w-px bg-gray-200 dark:bg-gray-700"></div>
                      <button
                        type="button"
                        className={`flex-1 py-1.5 text-xs sm:text-sm font-medium transition-colors ${endLeaveDuration === 'morning' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        onClick={() => setEndLeaveDuration('morning')}
                      >
                        ○ ครึ่งเช้า
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-800">
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-xs sm:text-sm font-medium transition-colors ${leaveDuration === 'full' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    onClick={() => setLeaveDuration('full')}
                  >
                    ◉ เต็มวัน
                  </button>
                  <div className="w-px bg-gray-200 dark:bg-gray-700"></div>
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-xs sm:text-sm font-medium transition-colors ${leaveDuration === 'morning' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    onClick={() => setLeaveDuration('morning')}
                  >
                    ○ ครึ่งเช้า
                  </button>
                  <div className="w-px bg-gray-200 dark:bg-gray-700"></div>
                  <button
                    type="button"
                    className={`flex-1 py-1.5 text-xs sm:text-sm font-medium transition-colors ${leaveDuration === 'afternoon' ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                    onClick={() => setLeaveDuration('afternoon')}
                  >
                    ○ ครึ่งบ่าย
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Description */}
          <div className="space-y-1 sm:space-y-2">
            <Label htmlFor="description" className="text-xs sm:text-sm">หมายเหตุ (ไม่บังคับ)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="เพิ่มรายละเอียดเพิ่มเติม..."
              rows={3}
              className="text-xs sm:text-sm resize-none"
            />
          </div>

          {/* Advanced / Date Range Section */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setShowAdvanced(!showAdvanced);
                if (!showAdvanced) {
                  // When opening advanced, ensure customStartDate is populated
                  setUseCustomDates(true);
                  if (!customStartDate && selectedDate) {
                    setCustomStartDate(moment(selectedDate).format('YYYY-MM-DD'));
                  }
                }
              }}
              className="group flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors font-medium focus:outline-none"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>กำหนดวันที่แบบละเอียด (Advanced)</span>
              {showAdvanced ? (
                <ChevronUp className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-px" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-px" />
              )}
            </button>

            {leaveDuration !== 'full' && (
              <p className="mt-1 text-[10px] sm:text-xs text-orange-600 dark:text-orange-400">
                *หมายเหตุ: เมื่อเลือกลาครึ่งวัน จะไม่สามารถเลือกวันที่แบบล่วงหน้าหลายวันได้
              </p>
            )}

            {showAdvanced && leaveDuration === 'full' && (
              <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center h-5">
                      <Label className="text-xs text-gray-600 dark:text-gray-400">วันเริ่มต้น</Label>
                    </div>
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="text-xs sm:text-sm h-8 w-full block"
                      style={{ WebkitAppearance: 'none' }}
                    />
                  </div>
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between h-5">
                      <Label className="text-xs text-gray-600 dark:text-gray-400">วันสิ้นสุด</Label>
                      {customEndDate && (
                        <button
                          type="button"
                          onClick={() => setCustomEndDate('')}
                          className="text-[10px] text-gray-500 hover:text-red-500"
                        >
                          ล้าง
                        </button>
                      )}
                    </div>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      min={customStartDate}
                      className="text-xs sm:text-sm h-8 w-full block"
                      style={{ WebkitAppearance: 'none' }}
                      placeholder="ไม่ต้องระบุหากเป็นวันเดียว"
                    />
                  </div>
                </div>
                {!customEndDate ? (
                  <p className="mt-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                    * หากไม่ระบุวันสิ้นสุด ระบบจะบันทึกเป็นเหตุการณ์ 1 วัน
                  </p>
                ) : (() => {
                  let validDays = 0;
                  const startMoment = moment(customStartDate);
                  const endMoment = moment(customEndDate);

                  if (startMoment.isValid() && endMoment.isValid() && startMoment.isSameOrBefore(endMoment)) {
                    const current = startMoment.clone();
                    while (current.isSameOrBefore(endMoment)) {
                      const date = current.toDate();
                      const isWeekend = current.day() === 0 || current.day() === 6;

                      const dateString = moment(date).format('YYYY-MM-DD');
                      const isCompanyHoliday = companyHolidays.some((h: any) => h.date === dateString);

                      if (!isCompanyHoliday && !isWeekend) {
                        validDays++;
                      }
                      current.add(1, 'day');
                    }

                    return (
                      <div className="mt-2 text-[10px] sm:text-xs text-blue-800 dark:text-blue-200 font-medium pt-0.5 flex flex-col gap-0.5">
                        <span>👉 เลือกรวมทั้งหมด {validDays} วัน</span>
                        <span className="text-blue-500 dark:text-blue-300 font-normal text-[10px] sm:text-xs ml-4">* ไม่รวมวันหยุดบริษัทและเสาร์-อาทิตย์</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 md:p-6 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 flex flex-row space-x-2 sm:space-x-3">
          <Button variant="outline" onClick={onClose} className="flex-1 text-xs sm:text-sm h-8 sm:h-9">
            ยกเลิก
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedEmployeeId || !leaveType}
            className="flex-1 bg-blue-600 hover:bg-blue-700 dark:bg-gray-700 dark:hover:bg-gray-800 text-white text-xs sm:text-sm h-8 sm:h-9"
          >
            {editingEvent ? 'อัพเดท' : 'บันทึก'}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
