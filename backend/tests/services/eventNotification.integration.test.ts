import { beforeAll, beforeEach, afterAll, test, expect } from 'bun:test';
import moment from 'moment';
import { createMergeDatabase } from '../helpers/mergeDatabase';
import { createAdminSession } from '../../src/utils/adminSession';
const module = await import('../../src/services/eventNotificationService').catch(() => ({})) as any;
const routes = await import('../../src/routes/eventNotifications').catch(() => ({})) as any;
let fixture: Awaited<ReturnType<typeof createMergeDatabase>>, service: any, webhook: ReturnType<typeof Bun.serve>;
let fail = false;
const payloads: any[] = [], oldNow = moment.now;
beforeAll(async () => {
  fixture = await createMergeDatabase();
  await fixture.prisma.$executeRawUnsafe(`CREATE TABLE cronjob_config (id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true, daily_leader_enabled BOOLEAN NOT NULL DEFAULT false, schedule_time TEXT NOT NULL, webhook_url TEXT NOT NULL, notification_days INTEGER NOT NULL DEFAULT 1, notification_type TEXT NOT NULL DEFAULT 'daily', weekly_days TEXT, weekly_scope TEXT DEFAULT 'current', created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await fixture.prisma.$executeRawUnsafe(`CREATE TABLE event_notification_deliveries (id SERIAL PRIMARY KEY, event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE, webhook_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'claimed', created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(event_id, webhook_key))`);
  webhook = Bun.serve({ port: 0, fetch: async req => { payloads.push(await req.json()); return new Response(fail ? 'rejected' : 'accepted', { status: fail ? 503 : 200 }); } });
});
beforeEach(async () => {
  await fixture.reset();
  await fixture.prisma.$executeRawUnsafe('TRUNCATE cronjob_config, event_notification_deliveries RESTART IDENTITY');
  moment.now = () => Date.parse('2026-11-02T16:30:00Z');
  payloads.length = 0; fail = false;
  service = module.EventNotificationService && new module.EventNotificationService(fixture.prisma);
});
afterAll(async () => { moment.now = oldNow; webhook?.stop(true); await fixture?.close(); });
const event = (startDate = '2026-11-02', endDate = startDate) => fixture.events.createEvent({ employeeId: 1, leaveType: 'sick', startDate, endDate });
const target = (name = 'Team', enabled = true) => fixture.prisma.cronjobConfig.create({ data: { name, enabled, scheduleTime: '09:00', notificationType: 'weekly', webhookUrl: webhook.url.toString() } });
test('explicitly sends only the saved same-day event to enabled destinations regardless of schedule', async () => {
  const saved = await event(); await event(); await target();
  expect(payloads).toHaveLength(0);
  expect(await service.notify(saved.id)).toEqual({ sent: 1, failed: 0, alreadyClaimed: 0, total: 1 });
  expect(payloads).toHaveLength(1);
  expect(JSON.stringify(payloads[0])).toContain('1 เหตุการณ์');
  expect(JSON.stringify(payloads[0])).toContain('Tan - Bupphachon.suw');
});
test('includes ranges covering today and uses Bangkok today across the UTC boundary', async () => {
  moment.now = () => Date.parse('2026-11-01T18:00:00Z'); await target();
  expect((await service.notify((await event('2026-11-01', '2026-11-03')).id)).sent).toBe(1);
});
test('rejects missing, past and future events without delivering anything', async () => {
  await target(); await expect(service.notify(999)).rejects.toThrow('Event not found');
  for (const date of ['2026-11-01', '2026-11-03']) await expect(service.notify((await event(date)).id)).rejects.toThrow('Event does not include today');
  expect(payloads).toHaveLength(0);
});
test('deduplicates URLs and concurrent/repeated confirmation requests', async () => {
  const saved = await event(); await target(); await target('Duplicate URL');
  await Promise.all([service.notify(saved.id), service.notify(saved.id)]);
  expect(payloads).toHaveLength(1);
  expect(await service.notify(saved.id)).toEqual({ sent: 0, failed: 0, alreadyClaimed: 1, total: 1 });
});
test('disabled event subscriptions and a leader-only subscription do not receive the event', async () => {
  await target('Disabled', false); await fixture.prisma.cronjobConfig.updateMany({ data: { dailyLeaderEnabled: true } });
  expect(await service.notify((await event()).id)).toEqual({ sent: 0, failed: 0, alreadyClaimed: 0, total: 0 });
  expect(payloads).toHaveLength(0);
});
test('failed or uncertain sends keep the saved event and are not automatically attempted again', async () => {
  const saved = await event(); await target(); fail = true;
  expect((await service.notify(saved.id)).failed).toBe(1);
  expect(await fixture.events.getEventById(saved.id)).toMatchObject({ id: saved.id });
  await service.notify(saved.id); expect(payloads).toHaveLength(1);
});
test('notify endpoint requires admin auth and reports invalid event dates as 400', async () => {
  const saved = await event(); await target(); const app = routes.createEventNotificationRoutes(service);
  const request = (id: number, token?: string) => app.handle(new Request(`http://localhost/events/${id}/notify-now`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {} }));
  expect((await request(saved.id)).status).toBe(401); expect(payloads).toHaveLength(0);
  const response = await request(saved.id, createAdminSession());
  expect(response.status).toBe(200); expect((await response.json()).data.sent).toBe(1);
  expect((await request((await event('2026-11-03')).id, createAdminSession())).status).toBe(400);
  expect((await request(999, createAdminSession())).status).toBe(404);
});
