// @vitest-environment jsdom
import React from 'react';
import axios, { type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Employees } from './Employees';
import { getApiDatabase } from '../services/apiDatabase';
import type { Employee } from '../../../shared/types';

vi.mock('../components/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
const originalAdapter = axios.defaults.adapter;
let records: Employee[];
beforeEach(() => {
  records = [
    { id: 1, name: 'First User', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
    { id: 2, name: 'Sushi – Example User', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
  ];
  // Keep the real hook, database facade and API client; isolate HTTP only.
  const adapter: AxiosAdapter = async config => {
    const path = new URL(config.url!).pathname;
    let data: unknown;
    if (config.method === 'get' && path === '/employees') data = records;
    else if (config.method === 'get' && path === '/events') data = [];
    else if (config.method === 'put' && path === '/employees/2') {
      const updates = JSON.parse(config.data);
      if (typeof updates.name !== 'string') throw new Error('Name required');
      records = records.map(employee => employee.id === 2 ? { ...employee, name: updates.name } : employee);
      data = records[1];
    } else throw new Error(`Unexpected request: ${config.method} ${path}`);
    return { data, status: 200, statusText: 'OK', headers: {}, config };
  };
  axios.defaults.adapter = adapter;
});
afterEach(() => { cleanup(); axios.defaults.adapter = originalAdapter; });
async function edit(name: string, user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: `แก้ไขข้อมูล ${name}` }));
  return screen.findByRole('textbox', { name: 'ชื่อ-นามสกุล' });
}
describe('employee editing', () => {
  it('focuses the populated name field when opening edit from the employee list', async () => {
    const user = userEvent.setup(); render(<Employees />);
    const input = await edit('Sushi – Example User', user) as HTMLInputElement;
    expect(input.value).toBe('Sushi – Example User');
    expect(document.activeElement).toBe(input);
  });
  it('saves the edited employee and shows the updated name in the list', async () => {
    const user = userEvent.setup(); render(<Employees />);
    const input = await edit('Sushi – Example User', user);
    await user.clear(input); await user.type(input, 'Sushi Updated');
    await user.click(screen.getByRole('button', { name: 'อัพเดท' }));
    expect(await screen.findByText('Sushi Updated')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'ชื่อ-นามสกุล' })).toBeNull());
    expect((await getApiDatabase().getAllEmployees()).map(employee => employee.name)).toEqual(['First User', 'Sushi Updated']);
  });
  it('focuses and repopulates the editor when switching employees or reopening after cancel', async () => {
    const user = userEvent.setup(); render(<Employees />);
    const firstInput = await edit('First User', user);
    await user.clear(firstInput); await user.type(firstInput, 'Unsaved draft');
    const switchedInput = await edit('Sushi – Example User', user) as HTMLInputElement;
    expect(switchedInput.value).toBe('Sushi – Example User');
    expect(document.activeElement).toBe(switchedInput);
    await edit('Sushi – Example User', user);
    expect(document.activeElement).toBe(switchedInput);
    await user.click(screen.getByRole('button', { name: 'ยกเลิก' }));
    const reopenedInput = await edit('Sushi – Example User', user) as HTMLInputElement;
    expect(reopenedInput.value).toBe('Sushi – Example User');
    expect(document.activeElement).toBe(reopenedInput);
  });
});
