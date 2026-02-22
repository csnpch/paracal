// ─── Leave Type ──────────────────────────────────────────────

export const LEAVE_TYPES = [
  'vacation',
  'personal',
  'sick',
  'unpaid',
  'compensatory',
  'other',
] as const;

export type LeaveType = (typeof LEAVE_TYPES)[number];

// ─── Employee ────────────────────────────────────────────────

export interface Employee {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEmployeeRequest {
  name: string;
}

export interface UpdateEmployeeRequest {
  name?: string;
}

// ─── Event ───────────────────────────────────────────────────

export interface Event {
  id: number;
  employeeId: number;
  employeeName: string;
  leaveType: LeaveType;
  date?: string; // Legacy single-day field (backward compat)
  startDate: string;
  endDate: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventRequest {
  employeeId: number;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface UpdateEventRequest {
  employeeId?: number;
  leaveType?: LeaveType;
  startDate?: string;
  endDate?: string;
  description?: string;
}

// ─── Holiday ─────────────────────────────────────────────────

export type HolidayType = 'public' | 'religious' | 'substitution';

export interface Holiday {
  date: string;
  name: string;
  type: HolidayType;
}

export interface CompanyHoliday {
  id: number;
  name: string;
  date: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyHolidayInput {
  name: string;
  date: string;
  description?: string;
}

export interface UpdateCompanyHolidayInput {
  name?: string;
  date?: string;
  description?: string;
}

// ─── Cronjob ─────────────────────────────────────────────────

export type NotificationType = 'daily' | 'weekly';
export type WeeklyScope = 'current' | 'next';

export interface CronjobConfig {
  id: number;
  name: string;
  enabled: boolean;
  schedule_time: string;
  webhook_url: string;
  notification_days: number;
  notification_type: NotificationType;
  weekly_days?: number[];
  weekly_scope?: WeeklyScope;
  created_at: string;
  updated_at: string;
}

// ─── API Response ────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
