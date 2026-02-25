import type { LeaveType } from './types';

// ─── App Branding ────────────────────────────────────────────

export const APP_NAME = 'Paracal';

// ─── Leave Type Labels (Thai) ────────────────────────────────

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: 'ลาพักร้อน',
  personal: 'ลากิจ',
  sick: 'ลาป่วย',
  unpaid: 'ลาไม่รับค่าจ้าง',
  compensatory: 'ลาหยุดชดเชย (OT)',
  other: 'อื่น ๆ',
};

// ─── Leave Type Theme Colors (for notifications) ─────────────

export const LEAVE_TYPE_THEME_COLORS: Record<LeaveType, string> = {
  sick: '#e11d48',
  personal: '#0078d4',
  vacation: '#107c10',
  unpaid: '#d97706',
  compensatory: '#00875a',
  other: '#7c3aed',
};

// ─── Leave Type UI Colors (Tailwind classes) ─────────────────

/** Colors with transparency for dark mode (modals, upcoming events) */
export const LEAVE_TYPE_COLORS: Record<LeaveType, string> = {
  vacation:
    'bg-blue-100 dark:bg-blue-800/40 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-600',
  personal:
    'bg-stone-50 dark:bg-stone-600/40 text-stone-700 dark:text-stone-100 border-stone-200 dark:border-stone-400',
  sick: 'bg-rose-100 dark:bg-rose-800/40 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-600',
  unpaid:
    'bg-amber-100 dark:bg-amber-800/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-600',
  compensatory:
    'bg-emerald-100 dark:bg-emerald-800/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-600',
  other:
    'bg-violet-100 dark:bg-violet-800/40 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-600',
};

/** Solid colors for calendar grid (100% opacity) */
export const LEAVE_TYPE_COLORS_SOLID: Record<LeaveType, string> = {
  vacation:
    'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-600',
  personal:
    'bg-stone-50 dark:bg-stone-600 text-stone-700 dark:text-stone-100 border-stone-200 dark:border-stone-400',
  sick: 'bg-rose-100 dark:bg-rose-800 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-600',
  unpaid:
    'bg-transparent dark:bg-transparent text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-500',
  compensatory:
    'bg-transparent dark:bg-transparent text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-500',
  other:
    'bg-violet-100 dark:bg-violet-800 text-violet-800 dark:text-violet-200 border-violet-200 dark:border-violet-600',
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
