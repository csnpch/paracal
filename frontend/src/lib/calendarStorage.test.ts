// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { getStoredCalendarState, setStoredCalendarState } from './calendarStorage';
const key = 'paracal.calendarState';
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { localStorage.clear(); sessionStorage.clear(); });
it('ignores a previous browser session’s month persisted in legacy localStorage', () => {
  localStorage.setItem(key, JSON.stringify({ currentDate: '2026-09-01', viewMode: 'month', calendarMode: 'events' }));
  expect(getStoredCalendarState()).toBeNull();
});
it('restores the latest date and view during the same tab session', () => {
  setStoredCalendarState(new Date('2026-09-15T12:00:00'), 'week', 'events');
  expect(getStoredCalendarState()).toMatchObject({ currentDate: new Date('2026-09-15T00:00:00'), viewMode: 'week', calendarMode: 'events' });
  expect(sessionStorage.getItem(key)).toContain('2026-09-15');
  expect(localStorage.getItem(key)).toBeNull();
});
it('starts fresh after the tab session ends even if legacy state exists', () => {
  setStoredCalendarState(new Date('2026-09-15T12:00:00'), 'month', 'events');
  sessionStorage.clear();
  expect(getStoredCalendarState()).toBeNull();
});
it('falls back to today initialization for malformed session data', () => {
  for (const value of ['invalid JSON', JSON.stringify({ currentDate: 'bad', viewMode: 'month' }), JSON.stringify({ currentDate: '2026-10-19', viewMode: 'invalid' })]) {
    sessionStorage.setItem(key, value);
    expect(getStoredCalendarState()).toBeNull();
  }
});
