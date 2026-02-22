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
  sick: '#ff4444',
  personal: '#0078d4',
  vacation: '#107c10',
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
