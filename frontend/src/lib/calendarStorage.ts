import moment from 'moment';

export type CalendarViewMode = 'month' | 'week' | 'day';

const CALENDAR_STATE_STORAGE_KEY = 'paracal.calendarState';

interface StoredCalendarState {
  currentDate: string;
  viewMode: CalendarViewMode;
}

const isCalendarViewMode = (value: string): value is CalendarViewMode =>
  value === 'month' || value === 'week' || value === 'day';

export const getStoredCalendarState = (): { currentDate: Date; viewMode: CalendarViewMode } | null => {
  if (typeof window === 'undefined') return null;

  const raw = localStorage.getItem(CALENDAR_STATE_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as StoredCalendarState;
    if (!parsed.currentDate || !isCalendarViewMode(parsed.viewMode)) return null;

    const currentDate = moment(parsed.currentDate, 'YYYY-MM-DD', true);
    if (!currentDate.isValid()) return null;

    return {
      currentDate: currentDate.toDate(),
      viewMode: parsed.viewMode,
    };
  } catch {
    return null;
  }
};

export const setStoredCalendarState = (currentDate: Date, viewMode: CalendarViewMode) => {
  if (typeof window === 'undefined') return;

  const payload: StoredCalendarState = {
    currentDate: moment(currentDate).format('YYYY-MM-DD'),
    viewMode,
  };
  localStorage.setItem(CALENDAR_STATE_STORAGE_KEY, JSON.stringify(payload));
};

export const isViewingCurrentCalendarPeriod = (currentDate: Date, viewMode: CalendarViewMode) => {
  const today = moment();
  const anchor = moment(currentDate);

  if (viewMode === 'month') return anchor.isSame(today, 'month');
  if (viewMode === 'week') return anchor.isSame(today, 'week');
  return anchor.isSame(today, 'day');
};
