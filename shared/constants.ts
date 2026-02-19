import type { LeaveType } from './types';

// ─── App Branding ────────────────────────────────────────────

export const APP_NAME = 'Paracal';

// ─── Leave Type Labels (Thai) ────────────────────────────────

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: 'ลาพักร้อน',
  personal: 'ลากิจ',
  sick: 'ลาป่วย',
  absent: 'ขาดงาน',
  maternity: 'ลาคลอด',
  bereavement: 'ลาฌาปนกิจ',
  study: 'ลาศึกษา',
  military: 'ลาทหาร',
  sabbatical: 'ลาพักผ่อนพิเศษ',
  unpaid: 'ลาไม่ได้รับเงินเดือน',
  compensatory: 'ลาชดเชย',
  other: 'อื่นๆ',
};

// ─── Leave Type Theme Colors (for notifications) ─────────────

export const LEAVE_TYPE_THEME_COLORS: Record<LeaveType, string> = {
  sick: '#ff4444',
  personal: '#0078d4',
  vacation: '#107c10',
  absent: '#d13438',
  maternity: '#e3008c',
  bereavement: '#737373',
  study: '#ff8c00',
  military: '#008080',
  sabbatical: '#5c2d91',
  unpaid: '#69797e',
  compensatory: '#00875a',
  other: '#8764b8',
};

// ─── Leave Type UI Colors (Tailwind classes) ─────────────────

/** Colors with transparency for dark mode (modals, upcoming events) */
export const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  vacation:
    'bg-blue-100 dark:bg-blue-800/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-600',
  personal:
    'bg-stone-50 dark:bg-stone-600/40 text-stone-700 dark:text-stone-100 border-stone-200 dark:border-stone-400',
  sick: 'bg-purple-100 dark:bg-purple-800/40 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-600',
  absent:
    'bg-red-100 dark:bg-red-800/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-600',
  maternity:
    'bg-pink-100 dark:bg-pink-800/40 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-600',
  bereavement:
    'bg-neutral-100 dark:bg-neutral-700/40 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-500',
  study:
    'bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-600',
  military:
    'bg-teal-100 dark:bg-teal-800/40 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-600',
  sabbatical:
    'bg-violet-100 dark:bg-violet-800/40 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-600',
  unpaid:
    'bg-slate-100 dark:bg-slate-700/40 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-500',
  compensatory:
    'bg-emerald-100 dark:bg-emerald-800/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-600',
  other:
    'bg-gray-50 dark:bg-gray-700/40 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-500',
};

/** Solid colors for calendar grid (100% opacity) */
export const LEAVE_TYPE_COLORS_SOLID: Record<LeaveType, string> = {
  vacation:
    'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-600',
  personal:
    'bg-stone-50 dark:bg-stone-600 text-stone-700 dark:text-stone-100 border-stone-200 dark:border-stone-400',
  sick: 'bg-purple-100 dark:bg-purple-800 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-600',
  absent:
    'bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-200 border-red-200 dark:border-red-600',
  maternity:
    'bg-pink-100 dark:bg-pink-800 text-pink-800 dark:text-pink-200 border-pink-200 dark:border-pink-600',
  bereavement:
    'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-500',
  study:
    'bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-600',
  military:
    'bg-teal-100 dark:bg-teal-800 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-600',
  sabbatical:
    'bg-violet-100 dark:bg-violet-800 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-600',
  unpaid:
    'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-500',
  compensatory:
    'bg-emerald-100 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-600',
  other:
    'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-500',
};

// ─── Utility Functions ───────────────────────────────────────

export function getLeaveTypeLabel(type: LeaveType): string {
  return LEAVE_TYPE_LABELS[type] || LEAVE_TYPE_LABELS.other;
}

export function getLeaveTypeColor(type: LeaveType): string {
  return LEAVE_TYPE_COLORS[type] || LEAVE_TYPE_COLORS.other;
}

export function getLeaveTypeColorSolid(type: LeaveType): string {
  return LEAVE_TYPE_COLORS_SOLID[type] || LEAVE_TYPE_COLORS_SOLID.other;
}
