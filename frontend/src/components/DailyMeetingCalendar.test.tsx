// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarGrid } from './CalendarGrid';
import { EventDetailsModal } from './EventDetailsModal';
import { toDailyLeaderEvents } from '../lib/dailyRotation';
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ isAdminAuthenticated: true }) }));
vi.mock('../hooks/useHolidays', () => ({ useHolidays: () => ({ holidays: [], isHoliday: () => null, isWeekend: (date: Date) => [0, 6].includes(date.getDay()) }) }));
vi.mock('./CreateEventPopover', () => ({ CreateEventPopover: () => null }));
afterEach(cleanup);
const employees = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
const events = toDailyLeaderEvents([{ weekStart: '2026-10-12', date: '2026-10-15', employeeId: 2, employeeName: 'B' }]);
const baseProps = { currentDate: new Date('2026-10-15T10:00:00'), events, employees, companyHolidays: [],
  onDateClick: vi.fn(), onCreateEvent: vi.fn(), onPrevDate: vi.fn(), onNextDate: vi.fn(), onTodayClick: vi.fn() };
const leaderLabel = 'ผู้นำ Daily Meeting: B';

describe('daily leader date indicators', () => {
  for (const viewMode of ['month', 'week', 'day'] as const) {
    it(`uses one date-header indicator instead of a leader event item in ${viewMode} view`, async () => {
      const user = userEvent.setup();
      render(<CalendarGrid {...baseProps} viewMode={viewMode} />);
      const dot = screen.getByRole('button', { name: leaderLabel });
      expect(screen.getAllByRole('button', { name: leaderLabel })).toHaveLength(1);
      expect(screen.queryByText('B · นำ daily meeting')).toBeNull();
      if (viewMode === 'month') {
        expect(dot.closest('[data-date]')?.getAttribute('data-date')).toBe('2026-10-15');
        expect(dot.previousElementSibling?.textContent).toBe('15');
      }
      await user.hover(dot);
      const tooltip = await screen.findByRole('tooltip');
      expect(tooltip.textContent).toContain('B จะนำ Daily Meeting ในสัปดาห์นี้');
      expect(tooltip.closest('.calendar-day-cell')).toBeNull();
    });
  }
  it('supports keyboard focus and does not open date details or creation when clicking the dot', async () => {
    const onDateClick = vi.fn();
    const onCreateEvent = vi.fn();
    const user = userEvent.setup();
    render(<CalendarGrid {...baseProps} onDateClick={onDateClick} onCreateEvent={onCreateEvent} />);
    const dot = screen.getByRole('button', { name: leaderLabel });
    fireEvent.focus(dot);
    expect((await screen.findByRole('tooltip')).textContent).toContain('B จะนำ Daily Meeting ในสัปดาห์นี้');
    await user.click(dot);
    expect(onDateClick).not.toHaveBeenCalled();
    expect(onCreateEvent).not.toHaveBeenCalled();
  });
  it('leaves both ordinary event rows visible and counts only leave events in the day tooltip', async () => {
    const user = userEvent.setup();
    const leave = (id: number, name: string) => ({ ...events[0], id, kind: undefined, employeeId: id, employeeName: name, leaveType: 'vacation' as const });
    const { container } = render(<CalendarGrid {...baseProps} events={[leave(1, 'A'), ...events, leave(3, 'C')]} />);
    const day = container.querySelector('[data-date="2026-10-15"]') as HTMLElement;
    expect(within(day).getByText('A')).toBeTruthy();
    expect(within(day).getByText('C')).toBeTruthy();
    expect(within(day).queryByText('+1')).toBeNull();
    await user.hover(day);
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('Events today (2)');
    expect(tooltip.textContent).not.toContain('นำ daily meeting');
    await user.hover(screen.getByRole('button', { name: leaderLabel }));
    expect((await screen.findByRole('tooltip')).textContent).toContain('B จะนำ Daily Meeting ในสัปดาห์นี้');
  });
  it('opens only the leader tooltip when focusing a dot on a day with leave events', async () => {
    const leave = { ...events[0], id: 3, kind: undefined, employeeId: 1, employeeName: 'A', leaveType: 'vacation' as const };
    render(<CalendarGrid {...baseProps} events={[...events, leave]} />);
    fireEvent.focus(screen.getByRole('button', { name: leaderLabel }));
    const tooltips = await screen.findAllByRole('tooltip');
    expect(tooltips).toHaveLength(1);
    expect(tooltips[0].textContent).toContain('B จะนำ Daily Meeting ในสัปดาห์นี้');
  });
  it('shows next-month first-workday dots and removes them for hidden or filtered data', () => {
    const spillover = toDailyLeaderEvents([{ weekStart: '2026-11-02', date: '2026-11-02', employeeId: 2, employeeName: 'B' }]);
    const { rerender } = render(<CalendarGrid {...baseProps} events={spillover} />);
    expect(screen.getByRole('button', { name: leaderLabel }).closest('[data-date]')?.getAttribute('data-date')).toBe('2026-11-02');
    rerender(<CalendarGrid {...baseProps} events={[]} />);
    expect(screen.queryByRole('button', { name: leaderLabel })).toBeNull();
    rerender(<CalendarGrid {...baseProps} filteredEmployeeIds={[1]} />);
    expect(screen.queryByRole('button', { name: leaderLabel })).toBeNull();
    rerender(<CalendarGrid {...baseProps} suppressEvents />);
    expect(screen.queryByRole('button', { name: leaderLabel })).toBeNull();
    rerender(<CalendarGrid {...baseProps} worklogMode />);
    expect(screen.queryByRole('button', { name: leaderLabel })).toBeNull();
  });
  it('keeps existing date details read-only even for an admin', () => {
    render(<EventDetailsModal isOpen onClose={vi.fn()} onEditEvent={vi.fn()} onDeleteEvent={vi.fn()} events={events} employees={employees} selectedDate={baseProps.currentDate} />);
    expect(screen.getByText('B · นำ daily meeting')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
