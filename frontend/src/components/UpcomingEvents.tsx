import React from 'react';
import { Event, Employee } from '@/services/apiDatabase';
import moment from 'moment';
import 'moment/locale/th';

interface UpcomingEventsProps {
  events: Event[];
  employees: Employee[];
  filteredEmployeeId?: number | null;
  onNavigateToMonth?: (year: number, month: number) => void;
  onEventHover?: (startDate: string, endDate: string) => void;
  onEventHoverEnd?: () => void;
  onEmployeeFilter?: (employeeId: number) => void;
}

// Info Box Component - แสดงคำแนะนำการใช้งาน
const InfoBox: React.FC = () => (
  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-2 py-1.5">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px]">
        วางเมาส์เหนือชื่อหรือคลิกลงไปที่ชื่อเพื่อแสดงข้อมูลเป็นรายบุคคล
      </span>
    </div>
  </div>
);

// Header Component - แสดงหัวข้อและข้อมูลสรุป
const EventListHeader: React.FC<{ count?: number }> = ({ count }) => (
  <div className="mb-3">
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
      ลำดับเหตุการณ์{count !== undefined ? ` (${count})` : ''}
    </h3>
    <InfoBox />
  </div>
);

const UpcomingEvents: React.FC<UpcomingEventsProps> = ({ events, employees, filteredEmployeeId, onNavigateToMonth, onEventHover, onEventHoverEnd, onEmployeeFilter }) => {
  moment.locale('th');

  // กรองเหตุการณ์ที่จะเกิดขึ้นในอนาคต
  const upcomingEvents = events
    .filter(event => {
      const today = moment().startOf('day');

      // Check both legacy date field and new range fields
      if (event.startDate && event.endDate) {
        // For range events, check if event end date is after today (future only)
        const endDate = moment(event.endDate);
        return endDate.isAfter(today);
      } else if (event.date) {
        // For legacy single-day events, check if date is today or later
        const eventDate = moment(event.date);
        return eventDate.isSameOrAfter(today);
      }

      return false;
    })
    .sort((a, b) => {
      // Sort by start date (either startDate or date)
      const aStart = moment(a.startDate || a.date);
      const bStart = moment(b.startDate || b.date);
      return aStart.diff(bStart);
    })
    .slice(0, 20); // Show more items since they're compact

  // ฟังก์ชันหาชื่อพนักงานจาก ID
  const getEmployeeName = (employeeId: number) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : 'ไม่พบข้อมูลพนักงาน';
  };

  // ฟังก์ชันแปลงประเภทการลาเป็นภาษาไทย (แบบสั้น)
  const getLeaveTypeText = (leaveType: string) => {
    const leaveTypes: { [key: string]: string } = {
      'sick': 'ป่วย',
      'vacation': 'พักร้อน',
      'personal': 'กิจ',
      'unpaid': 'ไม่รับค่าจ้าง',
      'compensatory': 'หยุดชดเชย (OT)',
      'other': 'อื่นๆ'
    };
    return leaveTypes[leaveType] || leaveType;
  };

  // ฟังก์ชันกำหนดสีตามประเภทการลา (แบบเล็ก)
  const getLeaveTypeColor = (leaveType: string) => {
    const colors: { [key: string]: string } = {
      'vacation': 'bg-blue-50 text-blue-600 border-blue-200',
      'personal': 'bg-stone-50 text-stone-600 border-stone-200',
      'sick': 'bg-purple-50 text-purple-600 border-purple-200',
      'unpaid': 'bg-slate-50 text-slate-600 border-slate-200',
      'compensatory': 'bg-emerald-50 text-emerald-600 border-emerald-200',
      'other': 'bg-gray-50 text-gray-600 border-gray-200'
    };
    return colors[leaveType] || colors['other'];
  };

  if (upcomingEvents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <EventListHeader />
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
          ไม่มีเหตุการณ์ที่จะเกิดขึ้น
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 flex flex-col max-h-[calc(100vh-200px)]">
      <EventListHeader count={upcomingEvents.length} />
      <div className="overflow-y-auto flex-1">
        <div className="space-y-1">
          {upcomingEvents.map((event, index) => {
            const startDate = event.startDate || event.date;
            const endDate = event.endDate || event.date;
            const isMultiDay = startDate !== endDate;

            const isFiltered = filteredEmployeeId === event.employeeId;

            const handleClick = () => {
              if (onEmployeeFilter) {
                onEmployeeFilter(event.employeeId);
              }
            };

            const handleMouseEnter = () => {
              if (onEventHover) {
                onEventHover(startDate, endDate);
              }
            };

            const handleMouseLeave = () => {
              if (onEventHoverEnd) {
                onEventHoverEnd();
              }
            };

            return (
              <div
                key={event.id}
                className={`flex items-center gap-2 p-1.5 rounded text-xs transition-colors cursor-pointer ${isFiltered
                  ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-400 dark:border-blue-600'
                  : 'hover:bg-green-50 dark:hover:bg-green-900/30'
                  }`}
                onClick={handleClick}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                {/* Number */}
                <div className="flex-shrink-0 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-medium">
                  {index + 1}
                </div>

                {/* Employee Name */}
                <div
                  className={`flex-shrink-0 font-medium min-w-0 max-w-32 truncate transition-colors ${isFiltered
                    ? 'text-blue-700 dark:text-blue-300 underline'
                    : 'text-gray-900 dark:text-white'
                    }`}
                  title={getEmployeeName(event.employeeId)}
                >
                  {getEmployeeName(event.employeeId)}
                </div>

                {/* Leave Type Badge */}
                <div className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${getLeaveTypeColor(event.leaveType)}`}>
                  {getLeaveTypeText(event.leaveType)}
                </div>

                {/* Date */}
                <div className="flex-shrink-0 text-gray-600 dark:text-gray-400">
                  {isMultiDay ? (
                    <span>{moment(startDate).format('DD/MM')} - {moment(endDate).format('DD/MM')}</span>
                  ) : (
                    <span>{moment(startDate).format('DD/MM')}</span>
                  )}
                </div>

                {/* Year if not current year */}
                <div className="flex-shrink-0 text-gray-500 dark:text-gray-500 text-[10px]">
                  {moment(startDate).year() !== moment().year() ? moment(startDate).format('YYYY') : ''}
                </div>

                {/* Description */}
                {event.description && (
                  <div className="flex-1 text-gray-500 dark:text-gray-400 truncate min-w-0">
                    {event.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default UpcomingEvents;