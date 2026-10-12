import { beforeAll, beforeEach, afterAll, describe, test, expect } from 'bun:test';
import { createMergeDatabase } from '../helpers/mergeDatabase';
import moment from 'moment';
import Logger from '../../src/utils/logger';
import { CronjobService } from '../../src/services/cronjobService';
import { NotificationService } from '../../src/services/notificationService';
import { createAdminSession } from '../../src/utils/adminSession';
const routeModule = await import('../../src/routes/dailyRotation').catch(() => ({})) as any;
const { DailyRotationService } = await import('../../src/services/dailyRotationService') as any;

describe('daily rotation with real PostgreSQL and local webhook', () => {
  let fixture: Awaited<ReturnType<typeof createMergeDatabase>>;
  let service: any;
  let webhook: ReturnType<typeof Bun.serve>;
  const payloads: any[] = [];
  const oldNow = moment.now;
  const oldSilent = Logger.silent;
  beforeAll(async () => {
    Logger.silent = true;
    moment.now = () => Date.parse('2026-10-09T02:00:00Z');
    fixture = await createMergeDatabase();
    await fixture.prisma.$executeRawUnsafe(`CREATE TABLE cronjob_config (
      id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, enabled BOOLEAN NOT NULL DEFAULT true,
      schedule_time TEXT NOT NULL, webhook_url TEXT NOT NULL, notification_days INTEGER NOT NULL DEFAULT 1,
      notification_type TEXT NOT NULL DEFAULT 'daily', weekly_days TEXT, weekly_scope TEXT DEFAULT 'current',
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    const migration = await Bun.file(new URL('../../prisma/migrations/20261009100000_daily_meeting_rotation/migration.sql', import.meta.url)).text();
    for (const sql of migration.split(';').map(s => s.trim()).filter(Boolean)) await fixture.prisma.$executeRawUnsafe(sql);
    const anchorMigration = await Bun.file(new URL('../../prisma/migrations/20261012120000_daily_leader_start/migration.sql', import.meta.url)).text();
    await fixture.prisma.$executeRawUnsafe(anchorMigration);
    webhook = Bun.serve({ port: 0, fetch: async req => { payloads.push(await req.json()); return new Response('accepted'); } });
  });
  beforeEach(async () => {
    await fixture.reset();
    await fixture.prisma.$executeRawUnsafe('TRUNCATE daily_rotation_config, daily_meeting_weeks, daily_leader_deliveries, cronjob_config RESTART IDENTITY');
    await fixture.prisma.employee.deleteMany();
    for (const [id, name] of [[1, 'A'], [2, 'B'], [3, 'C']] as const) {
      await fixture.prisma.employee.create({ data: { id, name, createdAt: new Date(`2026-01-0${id}`) } });
    }
    payloads.length = 0;
    moment.now = () => Date.parse('2026-10-09T02:00:00Z');
    service = DailyRotationService ? new DailyRotationService(fixture.prisma) : undefined;
  });
  afterAll(async () => { webhook?.stop(true); if (fixture) await fixture.close(); moment.now = oldNow; Logger.silent = oldSilent; });

  const configure = async () => service.updateSettings({ enabled: true, notificationEnabled: true, startWeek: '2026-10-05' });
  const subscribe = async (name = 'Team', enabled = false) => fixture.prisma.cronjobConfig.create({ data: {
    name, enabled, scheduleTime: '17:00', webhookUrl: webhook.url.toString(), dailyLeaderEnabled: true,
  } });
  const monday = new Date('2026-10-12T02:00:00Z');

  test('selects the next leader independently of queue order and preserves the current week', async () => {
    await configure();
    await service.updateSettings({ nextLeaderEmployeeId: 3 });
    expect((await service.getAssignments('2026-10-05', '2026-10-30')).map((a: any) => a.employeeId)).toEqual([1, 3, 1, 2]);
    expect(await service.getSettings()).toMatchObject({ employeeOrder: [1, 2, 3], nextWeekStart: '2026-10-12', nextLeaderEmployeeId: 3 });
    expect((await new DailyRotationService(fixture.prisma).getAssignments('2026-10-12', '2026-10-16'))[0].employeeId).toBe(3);
  });
  test('allows repeated next-week changes and preserves history when choosing again later', async () => {
    await configure();
    await service.updateSettings({ nextLeaderEmployeeId: 3 });
    await service.updateSettings({ nextLeaderEmployeeId: 2 });
    expect((await service.getAssignments('2026-10-05', '2026-10-30')).map((a: any) => a.employeeId)).toEqual([1, 2, 3, 1]);
    moment.now = () => Date.parse('2026-10-16T02:00:00Z');
    await service.updateSettings({ nextLeaderEmployeeId: 1 });
    expect((await service.getAssignments('2026-10-05', '2026-10-30')).map((a: any) => a.employeeId)).toEqual([1, 2, 1, 2]);
    expect((await service.getSettings()).nextWeekStart).toBe('2026-10-19');
  });
  test('changing next leader while OFF after activation preserves current and historical assignments on re-enable', async () => {
    await configure();
    await service.updateSettings({ nextLeaderEmployeeId: 3 });
    await service.updateSettings({ enabled: false });
    moment.now = () => Date.parse('2026-10-19T02:00:00Z');
    expect((await service.getSettings()).preview[0]).toMatchObject({ weekStart: '2026-10-19', employeeId: 1 });
    await service.updateSettings({ nextLeaderEmployeeId: 2 });
    expect((await service.getSettings()).preview[0]).toMatchObject({ weekStart: '2026-10-19', employeeId: 1 });
    expect(await service.getAssignments('2026-10-05', '2026-11-06')).toEqual([]);
    await service.updateSettings({ enabled: true });
    expect((await service.getAssignments('2026-10-05', '2026-11-06')).map((a: any) => a.employeeId)).toEqual([1, 3, 1, 2, 3]);
  });
  test('first activation can start next week with a selected person instead of the first member', async () => {
    await service.updateSettings({ nextLeaderEmployeeId: 3 });
    await service.updateSettings({ enabled: true });
    expect(await service.getAssignments('2026-10-05', '2026-10-09')).toEqual([]);
    expect((await service.getAssignments('2026-10-12', '2026-10-30')).map((a: any) => a.employeeId)).toEqual([3, 1, 2]);
  });
  test('a chosen next leader carries over an entirely closed week and moves to Thursday for partial closure', async () => {
    await configure();
    await service.updateSettings({ nextLeaderEmployeeId: 3 });
    await fixture.prisma.companyHoliday.createMany({ data: ['12', '13', '14'].map(d => ({ name: 'Closed', date: `2026-10-${d}` })) });
    expect(await service.getAssignments('2026-10-12', '2026-10-16')).toMatchObject([{ date: '2026-10-15', employeeId: 3 }]);
    await fixture.prisma.companyHoliday.createMany({ data: ['15', '16'].map(d => ({ name: 'Closed', date: `2026-10-${d}` })) });
    expect((await service.getAssignments('2026-10-05', '2026-10-30')).map((a: any) => [a.weekStart, a.employeeId])).toEqual([
      ['2026-10-05', 1], ['2026-10-19', 3], ['2026-10-26', 1],
    ]);
  });
  test('keeps a selected turn visible during closures longer than the four-week preview', async () => {
    await configure();
    const closed = Array.from({ length: 28 }, (_, i) => moment.utc('2026-10-12').add(i, 'days'))
      .filter(day => day.isoWeekday() <= 5).map(day => ({ name: 'Long closure', date: day.format('YYYY-MM-DD') }));
    await fixture.prisma.companyHoliday.createMany({ data: closed });
    await service.updateSettings({ nextLeaderEmployeeId: 3 });
    expect((await service.getSettings()).nextLeaderEmployeeId).toBe(3);
    moment.now = () => Date.parse('2026-10-19T02:00:00Z');
    expect((await service.getSettings()).nextLeaderEmployeeId).toBe(3);
    expect(await service.getAssignments('2026-11-09', '2026-11-13')).toMatchObject([{ employeeId: 3 }]);
  });
  test('rejects nonexistent selected members and falls back to the surviving queue if the selected member is deleted', async () => {
    await configure();
    await expect(service.updateSettings({ nextLeaderEmployeeId: 999 })).rejects.toThrow();
    await service.updateSettings({ nextLeaderEmployeeId: 3 });
    await fixture.prisma.employee.delete({ where: { id: 3 } });
    expect((await service.getAssignments('2026-10-05', '2026-10-30')).map((a: any) => a.employeeId)).toEqual([1, 2, 1, 2]);
  });
  test('admin API saves next-week selection and the scheduler sends that same leader only once', async () => {
    await configure(); await subscribe();
    const routes = routeModule.createDailyRotationRoutes(service);
    const response = await routes.handle(new Request('http://localhost/daily-rotation', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createAdminSession()}` },
      body: JSON.stringify({ nextLeaderEmployeeId: 3 }),
    }));
    expect(response.status).toBe(200);
    expect((await response.json()).data.nextLeaderEmployeeId).toBe(3);
    await service.dispatchDue(monday); await service.dispatchDue(monday);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].attachments[0].content.body[1].text).toBe('🎙️ C จะนำ Daily Meeting ในสัปดาห์นี้');
  });
  test('starts disabled with the oldest employees first', async () => {
    expect(await service.getSettings()).toMatchObject({ enabled: false, notificationEnabled: false, notificationTime: '09:00', employeeOrder: [1, 2, 3] });
    expect(await service.getAssignments('2026-10-05', '2026-10-30')).toEqual([]);
  });
  test('first activation starts with the oldest employee even if settings were opened weeks earlier', async () => {
    await service.getSettings();
    moment.now = () => Date.parse('2026-10-19T02:00:00Z');
    await service.updateSettings({ enabled: true });
    expect(await service.getAssignments('2026-10-19', '2026-10-23')).toMatchObject([{ employeeId: 1 }]);
  });
  test('saves manual order, appends a new employee and removes a deleted employee', async () => {
    await service.updateSettings({ employeeOrder: [3, 1, 2] });
    await fixture.prisma.employee.create({ data: { id: 4, name: 'D' } });
    expect((await service.getSettings()).employeeOrder).toEqual([3, 1, 2, 4]);
    await fixture.prisma.employee.delete({ where: { id: 1 } });
    expect((await service.getSettings()).employeeOrder).toEqual([3, 2, 4]);
  });
  test('rejects duplicated, incomplete and nonexistent queue entries and invalid times', async () => {
    for (const employeeOrder of [[1, 1, 2], [1, 2], [1, 2, 999]]) {
      await expect(service.updateSettings({ employeeOrder })).rejects.toThrow();
    }
    await expect(service.updateSettings({ notificationTime: '25:00' })).rejects.toThrow();
    await expect(service.getAssignments('bad', '2026-10-12')).rejects.toThrow();
  });
  test('keeps the current leader when the future queue changes', async () => {
    await configure();
    expect((await service.getAssignments('2026-10-05', '2026-10-30')).map((x: any) => x.employeeId)).toEqual([1, 2, 3, 1]);
    await service.updateSettings({ employeeOrder: [1, 3, 2] });
    expect((await service.getAssignments('2026-10-05', '2026-10-30')).map((x: any) => x.employeeId)).toEqual([1, 3, 2, 1]);
  });
  test('closing the entire current week after publication still carries the unused leader to next week', async () => {
    await configure();
    await fixture.prisma.companyHoliday.createMany({ data: ['05', '06', '07', '08', '09'].map(d => ({ name: 'Closed', date: `2026-10-${d}` })) });
    expect(await service.getAssignments('2026-10-05', '2026-10-09')).toEqual([]);
    moment.now = () => monday.getTime();
    expect(await service.getAssignments('2026-10-12', '2026-10-16')).toMatchObject([{ employeeId: 1 }]);
  });
  test('past full-week closure decisions stay stable when the holiday calendar is later edited', async () => {
    await configure();
    await fixture.prisma.companyHoliday.createMany({ data: ['12', '13', '14', '15', '16'].map(d => ({ name: 'Closed', date: `2026-10-${d}` })) });
    moment.now = () => Date.parse('2026-10-19T02:00:00Z');
    await service.getAssignments('2026-10-05', '2026-10-23');
    await fixture.prisma.companyHoliday.deleteMany();
    expect((await service.getAssignments('2026-10-05', '2026-10-23')).map((x: any) => x.employeeId)).toEqual([1, 2]);
  });
  test('feature OFF hides calendar events and preserves settings for re-enable', async () => {
    await configure(); await service.updateSettings({ enabled: false });
    expect(await service.getAssignments('2026-10-05', '2026-10-30')).toEqual([]);
    expect(await service.getSettings()).toMatchObject({ notificationEnabled: true, employeeOrder: [1, 2, 3] });
    await service.updateSettings({ enabled: true });
    expect(await service.getAssignments('2026-10-12', '2026-10-16')).toMatchObject([{ date: '2026-10-12', employeeId: 2 }]);
  });
  test('once per week survives restart and concurrent scheduler checks even if event notifications are OFF', async () => {
    await configure(); await subscribe();
    await Promise.all([service.dispatchDue(monday), new DailyRotationService(fixture.prisma).dispatchDue(monday)]);
    await new DailyRotationService(fixture.prisma).dispatchDue(monday);
    expect(payloads).toHaveLength(1);
    expect(JSON.stringify(payloads[0])).toContain('B');
    expect(await fixture.prisma.dailyLeaderDelivery.findMany()).toMatchObject([{ weekStart: '2026-10-12', status: 'sent' }]);
    await service.dispatchDue(new Date('2026-10-13T02:00:00Z'));
    expect(payloads).toHaveLength(1);
  });
  test('global time applies to every subscribed webhook, deduplicating identical destinations', async () => {
    await configure(); await subscribe('One'); await subscribe('Same destination');
    await fixture.prisma.cronjobConfig.create({ data: { name: 'Two', enabled: false, scheduleTime: '18:00', webhookUrl: `${webhook.url}other`, dailyLeaderEnabled: true } });
    await service.updateSettings({ notificationTime: '10:00' });
    await service.dispatchDue(monday);
    expect(payloads).toHaveLength(0);
    await service.dispatchDue(new Date('2026-10-12T03:00:00Z'));
    expect(payloads).toHaveLength(2);
  });
  test('Monday–Wednesday closure sends only Thursday', async () => {
    await configure(); await subscribe();
    await fixture.prisma.companyHoliday.createMany({ data: ['12', '13', '14'].map(d => ({ name: 'Closed', date: `2026-10-${d}` })) });
    await service.dispatchDue(monday);
    expect(payloads).toHaveLength(0);
    await service.dispatchDue(new Date('2026-10-15T02:00:00Z'));
    expect(payloads).toHaveLength(1);
    expect(await service.getAssignments('2026-10-12', '2026-10-16')).toMatchObject([{ date: '2026-10-15', employeeId: 2 }]);
  });
  test('a fully closed week sends nothing and carries B into next week', async () => {
    await configure(); await subscribe();
    await fixture.prisma.companyHoliday.createMany({ data: ['12', '13', '14', '15', '16'].map(d => ({ name: 'Closed', date: `2026-10-${d}` })) });
    await service.dispatchDue(monday);
    expect(payloads).toHaveLength(0);
    await service.dispatchDue(new Date('2026-10-19T02:00:00Z'));
    expect(payloads).toHaveLength(1);
    expect(await service.getAssignments('2026-10-19', '2026-10-23')).toMatchObject([{ employeeId: 2 }]);
  });
  test('feature, global notification and per-webhook subscription switches each suppress leader sends', async () => {
    const cfg = await subscribe(); await configure();
    await service.updateSettings({ enabled: false }); await service.dispatchDue(monday);
    await service.updateSettings({ enabled: true, notificationEnabled: false }); await service.dispatchDue(monday);
    await service.updateSettings({ notificationEnabled: true });
    await fixture.prisma.cronjobConfig.update({ where: { id: cfg.id }, data: { dailyLeaderEnabled: false } });
    await service.dispatchDue(monday);
    expect(payloads).toHaveLength(0);
    expect(await service.getAssignments('2026-10-12', '2026-10-16')).toHaveLength(1);
  });
  test('failure is recorded without automatic retry, avoiding ambiguous duplicate messages', async () => {
    await configure(); await subscribe();
    const failing = new DailyRotationService(fixture.prisma, async () => ({ success: false, error: 'timeout' }));
    await failing.dispatchDue(monday);
    await service.dispatchDue(monday);
    expect(payloads).toHaveLength(0);
    expect(await fixture.prisma.dailyLeaderDelivery.findMany()).toMatchObject([{ status: 'failed' }]);
  });
  test('a delivery claim freezes the current date and consumed turn despite later holiday edits', async () => {
    await configure(); await subscribe();
    moment.now = () => monday.getTime();
    await service.dispatchDue(monday);
    await fixture.prisma.companyHoliday.createMany({ data: ['12', '13', '14', '15', '16'].map(d => ({ name: 'Closed later', date: `2026-10-${d}` })) });
    expect(await service.getAssignments('2026-10-12', '2026-10-23')).toMatchObject([
      { date: '2026-10-12', employeeId: 2 }, { date: '2026-10-19', employeeId: 3 },
    ]);
    await service.dispatchDue(monday);
    expect(payloads).toHaveLength(1);
  });
  test('assignment publication and delivery claims are atomic against a concurrent holiday refresh', async () => {
    await configure(); await subscribe();
    moment.now = () => monday.getTime();
    let interleaved = false;
    const database = new Proxy(fixture.prisma, { get(target, property) {
      if (property !== '$transaction') return Reflect.get(target, property);
      return async (callback: any, options: any) => {
        const result = await target.$transaction(callback, options);
        if (!interleaved) {
          interleaved = true;
          await target.companyHoliday.createMany({ data: ['12', '13', '14', '15', '16'].map(d => ({ name: 'Concurrent closure', date: `2026-10-${d}` })) });
          await service.getAssignments('2026-10-12', '2026-10-16');
        }
        return result;
      };
    } });
    await new DailyRotationService(database).dispatchDue(monday);
    expect(payloads).toHaveLength(1);
    expect(await service.getAssignments('2026-10-12', '2026-10-23')).toMatchObject([
      { date: '2026-10-12', employeeId: 2 }, { date: '2026-10-19', employeeId: 3 },
    ]);
  });
  test('slow leader delivery cannot move an existing event job out of its scheduled minute', async () => {
    await configure();
    const cfg = await subscribe('Both', true);
    await fixture.prisma.cronjobConfig.update({ where: { id: cfg.id }, data: { scheduleTime: '09:00', notificationDays: 0 } });
    await fixture.prisma.event.create({ data: { employeeId: 1, employeeName: 'A', leaveType: 'vacation', startDate: '2026-10-12', endDate: '2026-10-12' } });
    moment.now = () => monday.getTime();
    const slow = new DailyRotationService(fixture.prisma, async (url: string, assignment: any) => {
      moment.now = () => Date.parse('2026-10-12T02:01:00Z');
      return NotificationService.sendDailyLeaderNotification(url, assignment);
    });
    const cron = new CronjobService(slow);
    Object.defineProperty(cron, 'prisma', { get: () => fixture.prisma });
    (cron as any).eventService = fixture.events;
    await cron.checkAndExecuteScheduledNotifications();
    expect(payloads).toHaveLength(2);
  });
  test('cronjob event enabled and leader subscription persist independently', async () => {
    const cron = new CronjobService();
    Object.defineProperty(cron, 'prisma', { get: () => fixture.prisma });
    const cfg = await cron.createConfig({ name: 'Both', enabled: false, daily_leader_enabled: true, schedule_time: '09:00', webhook_url: webhook.url.toString(), notification_days: 0, notification_type: 'daily' });
    expect(cfg).toMatchObject({ enabled: false, daily_leader_enabled: true });
    expect(await cron.updateConfig(cfg.id, { enabled: true, daily_leader_enabled: false })).toMatchObject({ enabled: true, daily_leader_enabled: false });
  });
  test('leader card presents only the app name and this week’s leader while keeping the Paracal action', () => {
    const card = (NotificationService as any).createDailyLeaderPayload({ weekStart: '2026-10-12', date: '2026-10-15', employeeId: 2, employeeName: 'B' });
    const content = card.attachments[0].content;
    expect(content.body.map((item: any) => item.text)).toEqual(['✳ **Paracal**', '🎙️ B จะนำ Daily Meeting ในสัปดาห์นี้']);
    expect(content.actions[0].type).toBe('Action.OpenUrl');
  });
  // Bind actual event/cron services to isolated PostgreSQL; only the webhook
  // endpoint is replaced, so these exercise queries, scheduler and HTTP sends.
  const calendarScheduler = async (url: string) => {
    await fixture.prisma.cronjobConfig.create({ data: { name: 'Calendar and leader', enabled: true,
      dailyLeaderEnabled: true, scheduleTime: '09:00', webhookUrl: url, notificationDays: 0 } });
    await fixture.events.createEvent({ employeeId: 1, leaveType: 'annual', leaveDuration: 'full',
      startDate: '2026-10-12', endDate: '2026-10-12' });
    moment.now = () => monday.getTime();
    const cron = new CronjobService(service);
    Object.defineProperty(cron, 'prisma', { get: () => fixture.prisma });
    Object.defineProperty((cron as any).eventService, 'prisma', { get: () => fixture.prisma });
    return cron;
  };
  test('same-time scheduler waits for the leader webhook response before posting calendar events', async () => {
    await configure();
    let leaderAcknowledged = false;
    const received: { kind: string; leaderAcknowledged: boolean; payload: any }[] = [];
    const slowWebhook = Bun.serve({ port: 0, fetch: async req => {
      const payload = await req.json();
      const kind = JSON.stringify(payload).includes('📅 แจ้งเตือนปฏิทิน') ? 'calendar' : 'leader';
      received.push({ kind, leaderAcknowledged, payload });
      if (kind === 'leader') {
        await Bun.sleep(50); // Simulate a webhook accepting a leader slowly.
        leaderAcknowledged = true;
      }
      return new Response('accepted');
    } });
    try {
      const cron = await calendarScheduler(slowWebhook.url.toString());
      await cron.checkAndExecuteScheduledNotifications();
      await cron.checkAndExecuteScheduledNotifications();
      expect(received.map(item => item.kind)).toEqual(['leader', 'calendar']);
      expect(received[1].leaderAcknowledged).toBe(true);
      expect(JSON.stringify(received[0].payload)).toContain('🎙️ B จะนำ Daily Meeting ในสัปดาห์นี้');
      expect(JSON.stringify(received[1].payload)).toContain('A');
    } finally { slowWebhook.stop(true); }
  });
  test('a failed leader webhook still permits the scheduled calendar notification', async () => {
    await configure();
    const received: string[] = [];
    const failedWebhook = Bun.serve({ port: 0, fetch: async req => {
      const payload = await req.json();
      const kind = JSON.stringify(payload).includes('📅 แจ้งเตือนปฏิทิน') ? 'calendar' : 'leader';
      received.push(kind);
      return new Response(kind === 'leader' ? 'unavailable' : 'accepted', { status: kind === 'leader' ? 500 : 200 });
    } });
    try {
      const cron = await calendarScheduler(failedWebhook.url.toString());
      await cron.checkAndExecuteScheduledNotifications();
      expect(received.filter(kind => kind === 'calendar')).toHaveLength(1);
      expect(await fixture.prisma.dailyLeaderDelivery.findMany()).toMatchObject([{ status: 'failed' }]);
    } finally { failedWebhook.stop(true); }
  });
  test('rotation database failure is isolated from scheduled calendar notifications', async () => {
    await configure();
    const cron = await calendarScheduler(webhook.url.toString());
    await fixture.prisma.$executeRawUnsafe('ALTER TABLE daily_rotation_config RENAME TO daily_rotation_config_unavailable');
    try {
      await cron.checkAndExecuteScheduledNotifications();
      expect(payloads).toHaveLength(1);
      expect(JSON.stringify(payloads[0])).toContain('📅 แจ้งเตือนปฏิทิน');
    } finally {
      await fixture.prisma.$executeRawUnsafe('ALTER TABLE daily_rotation_config_unavailable RENAME TO daily_rotation_config');
    }
  });
  test('scheduler dispatches leader subscriptions even when no event cronjob is enabled', async () => {
    await configure(); await subscribe();
    moment.now = () => monday.getTime();
    const cron = new CronjobService(service);
    Object.defineProperty(cron, 'prisma', { get: () => fixture.prisma });
    await cron.checkAndExecuteScheduledNotifications();
    expect(payloads).toHaveLength(1);
  });
  test('public calendar API emits assignments only on first workdays; settings require admin', async () => {
    await configure();
    const routes = routeModule.createDailyRotationRoutes(service);
    const calendar = await routes.handle(new Request('http://localhost/daily-rotation/events?start=2026-10-05&end=2026-10-30'));
    expect(calendar.status).toBe(200);
    expect((await calendar.json()).data.map((a: any) => a.date)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
    const unauthorized = await routes.handle(new Request('http://localhost/daily-rotation', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) }));
    expect(unauthorized.status).toBe(401);
    const invalid = await routes.handle(new Request('http://localhost/daily-rotation', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createAdminSession()}` }, body: JSON.stringify({ notificationTime: '25:00' }) }));
    expect(invalid.status).toBe(400);
    const disabled = await routes.handle(new Request('http://localhost/daily-rotation', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createAdminSession()}` }, body: JSON.stringify({ enabled: false }) }));
    expect(disabled.status).toBe(200);
    expect((await disabled.json()).data.enabled).toBe(false);
  });
  test('missing database schema is a server error and does not expose Prisma internals', async () => {
    await fixture.prisma.$executeRawUnsafe('ALTER TABLE daily_rotation_config RENAME TO daily_rotation_config_unavailable');
    try {
      const routes = routeModule.createDailyRotationRoutes(service);
      const calendar = await routes.handle(new Request('http://localhost/daily-rotation/events?start=2026-09-27&end=2026-11-07'));
      expect(calendar.status).toBe(500);
      expect(await calendar.json()).toEqual({ success: false, error: 'Unable to load daily meeting events' });
      const settings = await routes.handle(new Request('http://localhost/daily-rotation', { headers: { Authorization: `Bearer ${createAdminSession()}` } }));
      expect(settings.status).toBe(500);
      expect(await settings.json()).toEqual({ success: false, error: 'Unable to load settings' });
      const update = await routes.handle(new Request('http://localhost/daily-rotation', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${createAdminSession()}` }, body: JSON.stringify({ enabled: false }) }));
      expect(update.status).toBe(500);
      expect(await update.json()).toEqual({ success: false, error: 'Unable to save settings' });
    } finally {
      await fixture.prisma.$executeRawUnsafe('ALTER TABLE daily_rotation_config_unavailable RENAME TO daily_rotation_config');
    }
  });
  test('invalid calendar dates remain a client validation error', async () => {
    const routes = routeModule.createDailyRotationRoutes(service);
    const response = await routes.handle(new Request('http://localhost/daily-rotation/events?start=invalid&end=2026-11-07'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, error: 'Invalid date' });
  });
});
