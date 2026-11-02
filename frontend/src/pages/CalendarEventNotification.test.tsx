// @vitest-environment jsdom
import React from 'react';
import moment from 'moment';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CalendarEvents from './CalendarEvents';
const model = vi.hoisted(() => ({ date: '2026-11-02', end: '2026-11-02', createEvent: vi.fn(), notifyEventNow: vi.fn(), employees: [{id: 1, name: 'A'}], events: [] }));
vi.mock('../services/api', async original => ({ ...await original(), getDailyLeaderAssignments: async () => ({ success: true, data: [] }), notifyEventNow: model.notifyEventNow }));
vi.mock('../services/apiDatabase', () => ({ getApiDatabase: () => ({ getAllEmployees: async () => model.employees, getAllEvents: async () => model.events, getEventsByMonth: async () => model.events, createEvent: model.createEvent }) }));
vi.mock('../components/Layout', () => ({ Layout: ({children}: any) => <div>{children}</div> }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({isAdminAuthenticated: true}) }));
vi.mock('../hooks/useCompanyHolidays', () => ({ useCompanyHolidays: () => ({holidays: model.events, refresh: vi.fn()}) }));
vi.mock('../hooks/useWorklogs', () => ({ useWorklogs: () => ({data: null, loading: false, error: null, refresh: vi.fn()}) }));
vi.mock('../hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('../components/CalendarGrid', () => ({ CalendarGrid: ({onCreateEvent}: any) => <button onClick={() => onCreateEvent(new Date(model.date + 'T12:00:00'))}>Create event</button> }));
vi.mock('../components/UpcomingEvents', () => ({default: () => null}));
vi.mock('../components/EventModal', () => ({ EventModal: ({isOpen, onSave}: any) => isOpen && <button onClick={() => onSave({employeeId: 1, employeeName: 'A', leaveType: 'sick', startDate: model.date, endDate: model.end})}>Save event</button> }));
const oldNow = moment.now;
beforeEach(() => {
  moment.now = () => Date.parse('2026-11-01T18:00:00Z'); // Nov 2 Bangkok
  sessionStorage.clear(); vi.clearAllMocks(); model.date = model.end = '2026-11-02';
  model.createEvent.mockImplementation(async data => ({...data, id: 42, createdAt: '', updatedAt: ''}));
  model.notifyEventNow.mockResolvedValue({success: true, data: {sent: 1, failed: 0, alreadyClaimed: 0, total: 1}});
});
afterEach(() => { cleanup(); moment.now = oldNow; });
async function save() { render(<CalendarEvents/>); fireEvent.click(await screen.findByText('Create event')); fireEvent.click(screen.getByText('Save event')); await waitFor(() => expect(model.createEvent).toHaveBeenCalledTimes(1)); }
it('asks only after successful creation and sends only when explicitly confirmed', async () => {
  await save();
  const dialog = await screen.findByRole('alertdialog');
  expect(dialog.textContent).toContain('MS Teams'); expect(model.notifyEventNow).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: 'ส่งแจ้งเตือน'}));
  await waitFor(() => expect(model.notifyEventNow).toHaveBeenCalledWith(42));
  expect(model.createEvent).toHaveBeenCalledTimes(1);
});
it('dismissing notification keeps the created event without sending', async () => {
  await save(); await screen.findByRole('alertdialog');
  fireEvent.click(screen.getByRole('button', {name: 'ไม่ส่งตอนนี้'}));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(model.notifyEventNow).not.toHaveBeenCalled(); expect(model.createEvent).toHaveBeenCalledTimes(1);
});
it('does not prompt for an event entirely outside today', async () => {
  model.date = model.end = '2026-11-03'; await save();
  await waitFor(() => expect(screen.queryByText('Save event')).toBeNull());
  expect(screen.queryByRole('alertdialog')).toBeNull(); expect(model.notifyEventNow).not.toHaveBeenCalled();
});
it('prompts for a range covering today and keeps creation successful when sending fails', async () => {
  model.date = '2026-11-01'; model.end = '2026-11-03'; model.notifyEventNow.mockRejectedValue(new Error('unavailable'));
  await save(); await screen.findByRole('alertdialog'); fireEvent.click(screen.getByRole('button', {name: 'ส่งแจ้งเตือน'}));
  expect(await screen.findByText(/บันทึกเหตุการณ์แล้ว.*ไม่สามารถยืนยัน/)).toBeTruthy();
  expect(model.createEvent).toHaveBeenCalledTimes(1);
});
it('does not prompt when event creation fails', async () => {
  model.createEvent.mockRejectedValue(new Error('save failed')); await save();
  expect(screen.queryByRole('alertdialog')).toBeNull(); expect(model.notifyEventNow).not.toHaveBeenCalled();
});
