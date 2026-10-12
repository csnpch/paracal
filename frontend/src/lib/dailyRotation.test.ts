import { describe, it, expect } from 'vitest';
import * as rotation from './dailyRotation';

describe('daily meeting calendar data', () => {
  it('uses only the first workday and produces a read-only event with the leader label', () => {
    const events = rotation.toDailyLeaderEvents([{ weekStart: '2026-10-12', date: '2026-10-15', employeeId: 2, employeeName: 'B' }]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ startDate: '2026-10-15', endDate: '2026-10-15', kind: 'daily-meeting', employeeId: 2 });
    // The leader's name remains visible when an ordinary calendar chip truncates.
    expect(rotation.calendarEventName(events[0], 'B')).toBe('B · นำ daily meeting');
    expect(rotation.canEditCalendarEvent(events[0])).toBe(false);
    expect(rotation.canEditCalendarEvent({ ...events[0], kind: undefined })).toBe(true);
  });
  it('keeps existing leave labels unchanged', () => {
    expect(rotation.calendarEventName({ kind: undefined } as any, 'A')).toBe('A');
  });
});
