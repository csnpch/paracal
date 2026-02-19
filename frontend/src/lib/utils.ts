import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// ── Tailwind utility ─────────────────────────────────────────
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Re-export shared constants ───────────────────────────────
export {
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_COLORS,
  LEAVE_TYPE_COLORS_SOLID,
  LEAVE_TYPE_THEME_COLORS,
  getLeaveTypeLabel,
  getLeaveTypeColor,
  getLeaveTypeColorSolid,
} from '../../../shared/constants';

export type { LeaveType } from '../../../shared/types';

// ── Frontend-only utilities ──────────────────────────────────

export function formatDate(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function formatDateShort(date: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// ── Calendar constants ───────────────────────────────────────

export const DAYS_OF_WEEK = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const;

export const MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
] as const;
