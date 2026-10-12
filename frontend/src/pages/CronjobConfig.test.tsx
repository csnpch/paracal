// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CronjobConfig from './CronjobConfig';

const api = vi.hoisted(() => ({ getCronjobConfigs: vi.fn(), getCronjobStatus: vi.fn(), getDailyRotationSettings: vi.fn(), updateDailyRotationSettings: vi.fn(), updateCronjobConfig: vi.fn() }));
vi.mock('../services/api', () => ({ ...api, createCronjobConfig: vi.fn(), deleteCronjobConfig: vi.fn(), testCronjobNotification: vi.fn() }));
vi.mock('../components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark' }) }));
vi.mock('../hooks/use-toast', () => ({ toast: vi.fn() }));

const settings = { enabled: true, notificationEnabled: true, notificationTime: '09:00', startWeek: '2026-10-05', employeeOrder: [1, 2, 3], employees: [1, 2, 3].map((id, i) => ({ id, name: ['A', 'B', 'C'][i], createdAt: `2026-01-0${id}`, updatedAt: `2026-01-0${id}` })), preview: [] };
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
  it('saves one common leader time for all webhooks', async () => {
    const user = userEvent.setup(); render(<CronjobConfig />);
    const input = await screen.findByLabelText('เวลาแจ้งเตือนผู้นำ daily meeting');
    fireEvent.change(input, { target: { value: '10:00' } });
    await user.click(screen.getByRole('button', { name: 'บันทึกการแจ้งเตือนผู้นำ' }));
    await waitFor(() => expect(api.updateDailyRotationSettings).toHaveBeenCalledWith({ notificationEnabled: true, notificationTime: '10:00' }));
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
  it('turning the feature off preserves selected webhook subscriptions and shows their paused state', async () => {
    api.getDailyRotationSettings.mockResolvedValue({ success: true, data: { ...settings, enabled: false } });
    api.getCronjobConfigs.mockResolvedValue({ success: true, data: [{ ...config, daily_leader_enabled: true }] });
    render(<CronjobConfig />);
    const card = within(await screen.findByRole('article', { name: 'Team' }));
    expect(card.getByText('พักตามฟีเจอร์')).toBeTruthy();
    expect(card.getByRole('switch', { name: 'การแจ้งเตือนผู้นำ daily meeting' }).getAttribute('aria-checked')).toBe('true');
  });
});
