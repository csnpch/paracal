import type { DailyLeaderAssignment, Event } from '../../../shared/types';

export function toDailyLeaderEvents(assignments: DailyLeaderAssignment[]): Event[] {
  return assignments.map(a => ({
    id: -Number(a.weekStart.replace(/-/g, '')), kind: 'daily-meeting',
    employeeId: a.employeeId, employeeName: a.employeeName, leaveType: 'other',
    date: a.date, startDate: a.date, endDate: a.date,
    description: `ผู้นำ daily meeting ประจำสัปดาห์เริ่มวันที่ ${a.weekStart}`,
    createdAt: a.weekStart, updatedAt: a.weekStart,
  }));
}

export function calendarEventName(event: Pick<Event, 'kind' | 'employeeName'>, name: string): string {
  return event.kind === 'daily-meeting' ? `${event.employeeName || name} · นำ daily meeting` : name;
}

export function canEditCalendarEvent(event: Pick<Event, 'kind'>): boolean {
  return event.kind !== 'daily-meeting';
}
