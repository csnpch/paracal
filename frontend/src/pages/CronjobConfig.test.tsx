// @vitest-environment jsdom
import React from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CronjobConfig from './CronjobConfig';

// jsdom lacks these browser APIs used by the real Radix Select.
const browserAPIs = ['hasPointerCapture', 'scrollIntoView'] as const;
const originalBrowserAPIs = browserAPIs.map(name => Object.getOwnPropertyDescriptor(HTMLElement.prototype, name));
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', { configurable: true, value: () => false });
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: () => {} });
});
afterAll(() => browserAPIs.forEach((name, i) => {
  const descriptor = originalBrowserAPIs[i];
  if (descriptor) Object.defineProperty(HTMLElement.prototype, name, descriptor);
  else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
}));

const api = vi.hoisted(() => ({ getCronjobConfigs: vi.fn(), getCronjobStatus: vi.fn(), getDailyRotationSettings: vi.fn(), updateDailyRotationSettings: vi.fn(), updateCronjobConfig: vi.fn() }));
vi.mock('../services/api', () => ({ ...api, createCronjobConfig: vi.fn(), deleteCronjobConfig: vi.fn(), testCronjobNotification: vi.fn() }));
vi.mock('../components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
vi.mock('../hooks/use-toast', () => ({ toast: vi.fn() }));

const settings = { enabled: true, notificationEnabled: true, notificationTime: '09:00', startWeek: '2026-10-05', currentWeekStart: '2026-10-05', currentLeaderEmployeeId: 1, nextWeekStart: '2026-10-12', nextLeaderEmployeeId: 2, employeeOrder: [1, 2, 3], employees: [1, 2, 3].map((id, i) => ({ id, name: ['A', 'B', 'C'][i], createdAt: `2026-01-0${id}`, updatedAt: `2026-01-0${id}` })), preview: [] };
const config = { id: 1, name: 'Team', enabled: true, daily_leader_enabled: false, schedule_time: '09:00', notification_type: 'daily', notification_days: 0, webhook_url: 'https://example.test/hook', created_at: '2026-01-01', updated_at: '2026-01-01' };
beforeEach(() => {
  vi.clearAllMocks();
  api.getCronjobConfigs.mockResolvedValue({ success: true, data: [config] });
  api.getCronjobStatus.mockResolvedValue({ success: true, data: [] });
  api.getDailyRotationSettings.mockResolvedValue({ success: true, data: settings });
  api.updateDailyRotationSettings.mockImplementation(async updates => ({ success: true, data: { ...settings, ...updates } }));
  api.updateCronjobConfig.mockResolvedValue({ success: true, data: config });
});
afterEach(cleanup);

describe('daily rotation configuration user flows', () => {
  it('labels the masked webhook input and copies the full destination', async () => {
    const user = userEvent.setup(); render(<CronjobConfig />);
    const card = within(await screen.findByRole('article', { name: 'Team' }));
    const input = card.getByRole('textbox', { name: 'Webhook URL' }) as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(input.value).toBe('https://example.test/…');
    await user.click(card.getByRole('button', { name: 'คัดลอก webhook Team' }));
    expect(await navigator.clipboard.readText()).toBe('https://example.test/hook');
  });
  it('keeps existing webhook settings available if rotation loading fails', async () => {
    api.getDailyRotationSettings.mockRejectedValue(new Error('rotation unavailable'));
    render(<CronjobConfig />);
    const card = within(await screen.findByRole('article', { name: 'Team' }));
    expect(card.getByRole('switch', { name: 'แจ้งเหตุการณ์' })).toBeTruthy();
  });
  it('moves C ahead of A and persists the ordered queue', async () => {
    const user = userEvent.setup(); render(<CronjobConfig />);
    await user.click(await screen.findByRole('tab', { name: 'Daily Rotation' }));
    await user.click(screen.getByRole('button', { name: 'เลื่อน C ขึ้น' }));
    await user.click(screen.getByRole('button', { name: 'เลื่อน C ขึ้น' }));
    await user.click(screen.getByRole('button', { name: 'บันทึกลำดับ' }));
    await waitFor(() => expect(api.updateDailyRotationSettings).toHaveBeenCalledWith({ employeeOrder: [3, 1, 2] }));
  });
  it('selects this week’s leader at the top without reordering the team and refreshes the weekly preview', async () => {
    api.updateDailyRotationSettings.mockResolvedValueOnce({ success: true, data: { ...settings, currentLeaderEmployeeId: 3, preview: [
      { weekStart: '2026-10-05', date: '2026-10-05', employeeId: 3, employeeName: 'C' },
      { weekStart: '2026-10-12', date: '2026-10-12', employeeId: 1, employeeName: 'A' },
    ] } });
    const user = userEvent.setup(); render(<CronjobConfig />);
    await user.click(await screen.findByRole('tab', { name: 'Daily Rotation' }));
    const selector = screen.getByRole('combobox', { name: 'เลือกผู้นำสัปดาห์นี้' });
    await user.click(selector);
    await user.click(screen.getByRole('option', { name: 'C' }));
    await user.click(screen.getByRole('button', { name: 'บันทึกผู้นำสัปดาห์นี้' }));
    await waitFor(() => expect(api.updateDailyRotationSettings).toHaveBeenCalledWith({ currentLeaderEmployeeId: 3 }));
    await waitFor(() => expect(selector.textContent).toContain('C'));
    const preview = within(screen.getByRole('region', { name: 'ผู้นำรายสัปดาห์' }));
    expect(preview.getByText('2026-10-05 • event วันที่ 2026-10-05')).toBeTruthy();
    expect(preview.getByText('C')).toBeTruthy();
    expect(preview.getByText('A')).toBeTruthy();
    expect(screen.getAllByRole('listitem').slice(0, 3).map(item => item.textContent)).toEqual(['1A', '2B', '3C']);
  });
  it('disables current-leader selection when the team is empty', async () => {
    api.getDailyRotationSettings.mockResolvedValue({ success: true, data: { ...settings, employees: [], employeeOrder: [], currentLeaderEmployeeId: null } });
    const user = userEvent.setup(); render(<CronjobConfig />);
    await user.click(await screen.findByRole('tab', { name: 'Daily Rotation' }));
    const selector = screen.getByRole('combobox', { name: 'เลือกผู้นำสัปดาห์นี้' });
    expect(selector.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'บันทึกผู้นำสัปดาห์นี้' }).hasAttribute('disabled')).toBe(true);
  });
  it('saves one common leader time from Daily Rotation for all webhooks', async () => {
    const user = userEvent.setup(); render(<CronjobConfig />);
    await user.click(await screen.findByRole('tab', { name: 'Daily Rotation' }));
    const input = await screen.findByLabelText('เวลาแจ้งเตือนผู้นำ daily meeting');
    fireEvent.change(input, { target: { value: '10:00' } });
    await user.click(screen.getByRole('button', { name: 'บันทึกการแจ้งเตือนผู้นำ' }));
    await waitFor(() => expect(api.updateDailyRotationSettings).toHaveBeenCalledWith({ notificationEnabled: true, notificationTime: '10:00' }));
  });
  it('puts current selection first and keeps the single global leader switch/time only on Daily Rotation', async () => {
    const user = userEvent.setup(); render(<CronjobConfig />);
    await screen.findByRole('article', { name: 'Team' });
    expect(screen.queryByLabelText('เปิดการแจ้งเตือนผู้นำ')).toBeNull();
    expect(screen.queryByLabelText('เวลาแจ้งเตือนผู้นำ daily meeting')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'การแจ้งเตือนผู้นำ daily meeting' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Daily Rotation' }));
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(screen.getByRole('switch', { name: 'เปิดการแจ้งเตือนผู้นำ' })).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'เปิดใช้งาน Daily Rotation' })).toBeNull();
    const current = screen.getByRole('region', { name: 'ผู้นำสัปดาห์นี้' });
    expect(within(current).getByRole('combobox', { name: 'เลือกผู้นำสัปดาห์นี้' }).textContent).toContain('A');
    expect(current.compareDocumentPosition(screen.getAllByRole('listitem')[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('ผู้นำสัปดาห์หน้า')).toBeNull();
  });
  it('allows correcting a removed current leader using an active employee', async () => {
    api.getDailyRotationSettings.mockResolvedValue({ success: true, data: { ...settings, currentLeaderEmployeeId: 4, preview: [
      { weekStart: '2026-10-05', date: '2026-10-05', employeeId: 4, employeeName: 'Removed User' },
    ] } });
    const user = userEvent.setup(); render(<CronjobConfig />);
    await user.click(await screen.findByRole('tab', { name: 'Daily Rotation' }));
    const selector = screen.getByRole('combobox', { name: 'เลือกผู้นำสัปดาห์นี้' });
    expect(selector.textContent).toContain('Removed User');
    expect(screen.getByRole('button', { name: 'บันทึกผู้นำสัปดาห์นี้' }).hasAttribute('disabled')).toBe(true);
    await user.click(selector); await user.click(screen.getByRole('option', { name: 'C' }));
    await user.click(screen.getByRole('button', { name: 'บันทึกผู้นำสัปดาห์นี้' }));
    await waitFor(() => expect(api.updateDailyRotationSettings).toHaveBeenCalledWith({ currentLeaderEmployeeId: 3 }));
  });
  it('updates event and leader switches independently for a webhook', async () => {
    const user = userEvent.setup(); render(<CronjobConfig />);
    const card = within(await screen.findByRole('article', { name: 'Team' }));
    await user.click(card.getByRole('switch', { name: 'แจ้งเหตุการณ์' }));
    await waitFor(() => expect(api.updateCronjobConfig).toHaveBeenCalledWith(1, { enabled: false }));
    await user.click(card.getByRole('switch', { name: 'การแจ้งเตือนผู้นำ daily meeting' }));
    await waitFor(() => expect(api.updateCronjobConfig).toHaveBeenCalledWith(1, { daily_leader_enabled: true }));
  });
  it('leaves the edit form fields intact and keeps the global leader settings outside it', async () => {
    const user = userEvent.setup(); render(<CronjobConfig />);
    await user.click(await screen.findByRole('button', { name: 'แก้ไข Team' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByLabelText(/Schedule Time/)).toBeTruthy();
    expect(dialog.getByLabelText(/Webhook URL/)).toBeTruthy();
    expect(dialog.queryByLabelText('เวลาแจ้งเตือนผู้นำ daily meeting')).toBeNull();
    expect(dialog.queryByText('การแจ้งเตือนผู้นำ daily meeting')).toBeNull();
  });
  it('turning global leader notifications off preserves selected webhook subscriptions and shows their paused state', async () => {
    api.getDailyRotationSettings.mockResolvedValue({ success: true, data: { ...settings, notificationEnabled: false } });
    api.getCronjobConfigs.mockResolvedValue({ success: true, data: [{ ...config, daily_leader_enabled: true }] });
    render(<CronjobConfig />);
    const card = within(await screen.findByRole('article', { name: 'Team' }));
    expect(card.getByText('พักการแจ้งเตือน')).toBeTruthy();
    expect(card.getByRole('switch', { name: 'การแจ้งเตือนผู้นำ daily meeting' }).getAttribute('aria-checked')).toBe('true');
  });
});
