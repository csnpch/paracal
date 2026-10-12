// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CalendarEvents from './CalendarEvents';
vi.mock('../lib/calendarStorage', () => ({ getStoredCalendarState: () => ({ currentDate: new Date('2026-10-15T10:00:00'), viewMode: 'month', calendarMode: 'events' }), setStoredCalendarState: vi.fn() }));
const leave = { id: 7, employeeId: 2, employeeName: 'B', leaveType: 'vacation', startDate: '2026-10-15', endDate: '2026-10-15', createdAt: '2026-10-01', updatedAt: '2026-10-01' };
const api = vi.hoisted(() => ({ getDailyLeaderAssignments: vi.fn() }));
const noHolidays = vi.hoisted(() => []);
vi.mock('../services/api', async original => ({ ...await original(), ...api }));
vi.mock('../components/Layout', () => ({ Layout: ({ children }: any) => <div>{children}</div> }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ isAdminAuthenticated: true }) }));
vi.mock('../hooks/useCalendarData', () => {
  let data: any;
  return { useCalendarData: () => data ??= { employees: [{ id: 2, name: 'B' }], events: [leave], loading: false, error: null, getEventsForDate: () => [leave] } };
});
vi.mock('../hooks/useCompanyHolidays', () => ({ useCompanyHolidays: () => ({ holidays: noHolidays, refresh: vi.fn() }) }));
vi.mock('../hooks/useWorklogs', () => ({ useWorklogs: () => ({ data: null, loading: false, error: null, refresh: vi.fn() }) }));
vi.mock('../hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('../components/EventModal', () => ({ EventModal: () => null }));
vi.mock('../components/CompanyHolidayModal', () => ({ CompanyHolidayModal: () => null }));
vi.mock('../components/UpcomingEvents', () => ({ default: ({ events }: any) => <div data-testid="upcoming">{events.map((e: any) => e.kind || 'leave').join(',')}</div> }));
vi.mock('../components/CalendarGrid', () => ({ CalendarGrid: ({ events, onDateClick }: any) => <div><div data-testid="grid-events">{events.map((e: any) => e.kind || 'leave').join(',')}</div><button onClick={() => onDateClick(new Date('2026-10-15T10:00:00'))}>Open Thursday</button></div> }));
afterEach(cleanup);

it('loads leader events into the calendar and details without adding them to the leave sidebar', async () => {
  api.getDailyLeaderAssignments.mockResolvedValue({ success: true, data: [{ weekStart: '2026-10-12', date: '2026-10-15', employeeId: 2, employeeName: 'B' }] });
  render(<CalendarEvents />);
  await screen.findByText('leave,daily-meeting');
  expect(screen.getByTestId('upcoming').textContent).toBe('leave');
  fireEvent.click(screen.getByText('Open Thursday'));
  expect(await screen.findByText('B · นำ daily meeting')).toBeTruthy();
});
it('loads all six visible calendar rows including the next month', async () => {
  api.getDailyLeaderAssignments.mockClear();
  api.getDailyLeaderAssignments.mockImplementation(async (start, end) => ({ success: true, data: end >= '2026-11-02' ? [{ weekStart: '2026-11-02', date: '2026-11-02', employeeId: 2, employeeName: 'B' }] : [] }));
  render(<CalendarEvents />);
  await screen.findByText('leave,daily-meeting');
  expect(api.getDailyLeaderAssignments).toHaveBeenCalledWith('2026-09-27', '2026-11-07', expect.any(AbortSignal));
});
