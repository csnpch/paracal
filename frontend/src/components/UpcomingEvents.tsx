import React, { useMemo } from 'react';
import { Clock3, ExternalLink } from 'lucide-react';
import { Event, Employee } from '@/services/apiDatabase';
import type { JiraWorklogEntry } from '@/services/api';
import { formatWorklogDuration, getJiraIssueUrl } from '@/lib/worklog';
import moment from 'moment';
import 'moment/locale/th';

interface UpcomingEventsProps {
  events: Event[];
  employees: Employee[];
  filteredEmployeeIds?: number[];
  worklogMode?: boolean;
  worklogs?: JiraWorklogEntry[];
  worklogsLoading?: boolean;
  selectedWorklogAuthorId?: string;
  onNavigateToMonth?: (year: number, month: number) => void;
  onEventHover?: (startDate: string, endDate: string) => void;
  onEventHoverEnd?: () => void;
  onWorklogDatesHover?: (dates: string[]) => void;
  onEmployeeFilter?: (employeeId: number) => void;
}

type WorklogDayLog = {
  date: string;
  totalSeconds: number;
};

type GroupedWorklogIssue = {
  issueKey: string;
  entry: JiraWorklogEntry;
  days: WorklogDayLog[];
  totalSeconds: number;
  firstDate: string;
};

const InfoBox: React.FC<{ worklogMode?: boolean }> = ({ worklogMode }) => (
  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-2 py-1.5">
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <div className="flex flex-col gap-0.5">
      <span className="text-[12px]">
        {worklogMode
          ? 'วางเมาส์เหนือการ์ดเพื่อไฮไลต์ทุกวันที่ log หรือวางบนวันที่เพื่อดูรายวัน'
          : 'วางเมาส์เหนือชื่อหรือคลิกลงไปที่ชื่อเพื่อแสดงข้อมูลเป็นรายบุคคล'}
      </span>
    </div>
  </div>
);

const ListHeader: React.FC<{ count?: number; worklogMode?: boolean }> = ({ count, worklogMode }) => (
  <div className="mb-3">
    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
      {worklogMode ? 'ลำดับ Worklog' : 'ลำดับเหตุการณ์'}{count !== undefined ? ` (${count})` : ''}
    </h3>
    <InfoBox worklogMode={worklogMode} />
  </div>
);

const UpcomingEvents: React.FC<UpcomingEventsProps> = ({
  events,
  employees,
  filteredEmployeeIds = [],
  worklogMode = false,
  worklogs = [],
  worklogsLoading = false,
  selectedWorklogAuthorId = '',
  onNavigateToMonth,
  onEventHover,
  onEventHoverEnd,
  onWorklogDatesHover,
  onEmployeeFilter,
}) => {
  moment.locale('th');

  const sortedWorklogs = useMemo(
    () => [...worklogs].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return moment(a.started).valueOf() - moment(b.started).valueOf();
    }),
    [worklogs],
  );

  const groupedWorklogs = useMemo(() => {
    const groups = new Map<string, GroupedWorklogIssue>();

    for (const entry of sortedWorklogs) {
      let group = groups.get(entry.issueKey);
      if (!group) {
        group = {
          issueKey: entry.issueKey,
          entry,
          days: [],
          totalSeconds: 0,
          firstDate: entry.date,
        };
        groups.set(entry.issueKey, group);
      }

      group.totalSeconds += entry.seconds;
      if (entry.date < group.firstDate) {
        group.firstDate = entry.date;
      }

      const existingDay = group.days.find((day) => day.date === entry.date);
      if (existingDay) {
        existingDay.totalSeconds += entry.seconds;
      } else {
        group.days.push({ date: entry.date, totalSeconds: entry.seconds });
      }
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        days: [...group.days].sort((a, b) => a.date.localeCompare(b.date)),
      }))
      .sort((a, b) => {
        const dateCompare = a.firstDate.localeCompare(b.firstDate);
        if (dateCompare !== 0) return dateCompare;
        return a.issueKey.localeCompare(b.issueKey);
      });
  }, [sortedWorklogs]);

  const upcomingEvents = events
    .filter(event => {
      const today = moment().startOf('day');

      if (event.startDate && event.endDate) {
        const endDate = moment(event.endDate);
        return endDate.isAfter(today);
      }
      if (event.date) {
        const eventDate = moment(event.date);
        return eventDate.isSameOrAfter(today);
      }

      return false;
    })
    .sort((a, b) => {
      const aStart = moment(a.startDate || a.date);
      const bStart = moment(b.startDate || b.date);
      return aStart.diff(bStart);
    })
    .slice(0, 20);

  const getEmployeeName = (employeeId: number) => {
    const employee = employees.find(emp => emp.id === employeeId);
    return employee ? employee.name : 'ไม่พบข้อมูลพนักงาน';
  };

  const getLeaveTypeText = (leaveType: string) => {
    const leaveTypes: { [key: string]: string } = {
      sick: 'ป่วย',
      vacation: 'พักร้อน',
      personal: 'กิจ',
      unpaid: 'ไม่รับค่าจ้าง',
      compensatory: 'หยุดชดเชย (OT)',
      other: 'อื่นๆ',
    };
    return leaveTypes[leaveType] || leaveType;
  };

  const getLeaveTypeColor = (leaveType: string) => {
    const colors: { [key: string]: string } = {
      vacation: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
      personal: 'bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-900/30 dark:text-stone-300 dark:border-stone-700',
      sick: 'bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
      unpaid: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700',
      compensatory: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
      other: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600',
    };
    return colors[leaveType] || colors.other;
  };

  if (worklogMode) {
    if (worklogsLoading) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
          <ListHeader worklogMode />
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
            กำลังโหลด worklog...
          </p>
        </div>
      );
    }

    if (!selectedWorklogAuthorId) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
          <ListHeader worklogMode />
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
            เลือกบุคคลเพื่อดูลำดับ worklog
          </p>
        </div>
      );
    }

    if (groupedWorklogs.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
          <ListHeader worklogMode count={0} />
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
            ไม่มี worklog ในช่วงนี้
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 flex flex-col max-h-[calc(100vh-200px)]">
        <ListHeader worklogMode count={groupedWorklogs.length} />
        <div className="overflow-y-auto flex-1">
          <div className="space-y-2">
            {groupedWorklogs.map((group, index) => {
              const loggedDates = group.days.map((day) => day.date);

              return (
                <a
                  key={group.issueKey}
                  href={getJiraIssueUrl(group.entry)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 p-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                  onMouseEnter={() => onWorklogDatesHover?.(loggedDates)}
                  onMouseLeave={onEventHoverEnd}
                >
                  <div className="flex-shrink-0 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white text-[10px] font-medium mt-0.5">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 shrink-0">
                        {group.entry.projectKey}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 dark:text-blue-300 truncate">
                        {group.issueKey}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </span>
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 shrink-0">
                        <Clock3 className="h-3 w-3" />
                        {formatWorklogDuration(group.totalSeconds)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-900 dark:text-gray-100 line-clamp-2 leading-snug">
                      {group.entry.issueSummary}
                    </p>

                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                        บันทึกวันที่ ({group.days.length})
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.days.map((day) => (
                          <span
                            key={`${group.issueKey}-${day.date}`}
                            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                          >
                            {moment(day.date).format('DD/MM/YYYY')}
                            <span className="text-gray-500 dark:text-gray-400">
                              {formatWorklogDuration(day.totalSeconds)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (upcomingEvents.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
        <ListHeader />
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-4">
          ไม่มีเหตุการณ์ที่จะเกิดขึ้น
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 flex flex-col max-h-[calc(100vh-200px)]">
      <ListHeader count={upcomingEvents.length} />
      <div className="overflow-y-auto flex-1">
        <div className="space-y-1">
          {upcomingEvents.map((event, index) => {
            const startDate = event.startDate || event.date;
            const endDate = event.endDate || event.date;
            const isMultiDay = startDate !== endDate;

            const isFiltered = filteredEmployeeIds.includes(event.employeeId);

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
                <div className="flex-shrink-0 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center text-white text-[10px] font-medium">
                  {index + 1}
                </div>

                <div
                  className={`flex-shrink-0 font-medium min-w-0 max-w-32 truncate transition-colors ${isFiltered
                    ? 'text-blue-700 dark:text-blue-300 underline'
                    : 'text-gray-900 dark:text-white'
                    }`}
                  title={getEmployeeName(event.employeeId)}
                >
                  {getEmployeeName(event.employeeId)}
                </div>

                <div className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium border ${getLeaveTypeColor(event.leaveType)}`}>
                  {getLeaveTypeText(event.leaveType)}
                </div>

                <div className="flex-shrink-0 text-gray-600 dark:text-gray-400">
                  {isMultiDay ? (
                    <span>{moment(startDate).format('DD/MM')} - {moment(endDate).format('DD/MM')}</span>
                  ) : (
                    <span>{moment(startDate).format('DD/MM')}</span>
                  )}
                </div>

                <div className="flex-shrink-0 text-gray-500 dark:text-gray-500 text-[10px]">
                  {moment(startDate).year() !== moment().year() ? moment(startDate).format('YYYY') : ''}
                </div>

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
