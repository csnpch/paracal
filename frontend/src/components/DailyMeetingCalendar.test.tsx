// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CalendarGrid } from './CalendarGrid';
import { EventDetailsModal } from './EventDetailsModal';
import { toDailyLeaderEvents } from '../lib/dailyRotation';
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ isAdminAuthenticated: true }) }));
vi.mock('../hooks/useHolidays', () => ({ useHolidays: () => ({ holidays: [], isHoliday: () => null, isWeekend: (date: Date) => [0, 6].includes(date.getDay()) }) }));
vi.mock('./CreateEventPopover', () => ({ CreateEventPopover: () => null }));
afterEach(cleanup);
const employees = [{ id: 2, name: 'B', createdAt: '2026-01-02', updatedAt: '2026-01-02' }];
const events = toDailyLeaderEvents([{ weekStart: '2026-10-12', date: '2026-10-15', employeeId: 2, employeeName: 'B' }]);

describe('ordinary calendar leader events', () => {
  for (const viewMode of ['month', 'week', 'day'] as const) {
    it(`shows one leader event in the existing ${viewMode} view`, () => {
      render(<CalendarGrid currentDate={new Date('2026-10-15T10:00:00')} viewMode={viewMode} events={events} employees={employees} companyHolidays={[]} onDateClick={vi.fn()} onCreateEvent={vi.fn()} onPrevDate={vi.fn()} onNextDate={vi.fn()} onTodayClick={vi.fn()} />);
      expect(screen.getAllByText('B · นำ daily meeting')).toHaveLength(1);
    });
  }
  it('shows the leader in existing details while hiding edit/delete actions even for an admin', () => {
    render(<EventDetailsModal isOpen onClose={vi.fn()} onEditEvent={vi.fn()} onDeleteEvent={vi.fn()} events={events} employees={employees} selectedDate={new Date('2026-10-15T10:00:00')} />);
    expect(screen.getByText('B · นำ daily meeting')).toBeTruthy();
    // Only Close remains, unlike a real leave event's edit and delete controls.
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
