import moment from 'moment';
import type { DailyLeaderAssignment, DailyRotationSettings, DailyRotationUpdate } from '../../../shared/types';
import type { PrismaClient, Prisma } from '../generated/prisma/client';
import { getPrisma } from '../database/connection';
import { NotificationService } from './notificationService';
import { createHash } from 'node:crypto';
import Logger from '../utils/logger';

export class DailyRotationValidationError extends Error {}

type Member = { id: number; name: string; createdAt: Date | string };

export function reconcileOrder(saved: number[], employees: Array<Pick<Member, 'id' | 'createdAt'>>): number[] {
  const sorted = [...employees].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt) || a.id - b.id);
  const active = new Set(sorted.map(e => e.id));
  return [...new Set([...saved.filter(id => active.has(id)), ...sorted.map(e => e.id)])];
}

export function validateDate(date: string): void {
  if (!moment.utc(date, 'YYYY-MM-DD', true).isValid()) throw new DailyRotationValidationError('Invalid date');
}

export function weekOf(date: string): string {
  validateDate(date);
  return moment.utc(date).startOf('isoWeek').format('YYYY-MM-DD');
}

export function buildAssignments(start: string, end: string, employees: Member[], holidays: string[], snapshots: DailyLeaderAssignment[], anchor?: { weekStart: string; employeeId: number }): DailyLeaderAssignment[] {
  validateDate(start); validateDate(end);
  const first = moment.utc(weekOf(start));
  const last = moment.utc(weekOf(end));
  if (last.isBefore(first) || last.diff(first, 'weeks') > 1040) throw new DailyRotationValidationError('Invalid rotation range');
  const closed = new Set(holidays);
  const published = new Map(snapshots.map(s => [s.weekStart, s]));
  const result: DailyLeaderAssignment[] = [];
  let previousId: number | undefined;
  let anchorPending = !!anchor;
  for (const week = first.clone(); week.isSameOrBefore(last); week.add(1, 'week')) {
    const weekStart = week.format('YYYY-MM-DD');
    const date = Array.from({ length: 5 }, (_, i) => week.clone().add(i, 'days').format('YYYY-MM-DD')).find(d => !closed.has(d));
    if (!date) continue;
    // A new employee cannot appear in a forecast for a week before they joined.
    const eligible = employees.filter(e => +new Date(e.createdAt) <= +week.clone().add(6, 'days').endOf('day'));
    const saved = published.get(weekStart);
    const previousIndex = eligible.findIndex(e => e.id === previousId);
    const appliesAnchor = anchorPending && weekStart >= anchor!.weekStart;
    const leader = (appliesAnchor ? eligible.find(e => e.id === anchor!.employeeId) : undefined)
      ?? eligible[(previousIndex + 1) % eligible.length];
    if (!saved && !leader) continue;
    const assignment = saved ? { ...saved, date } : { weekStart, date, employeeId: leader!.id, employeeName: leader!.name };
    result.push(assignment);
    if (appliesAnchor) anchorPending = false;
    // Deleted historical leaders remain visible, while the cursor continues
    // after the latest leader still present in the active queue.
    if (eligible.some(e => e.id === assignment.employeeId)) previousId = assignment.employeeId;
  }
  return result;
}

type StoredConfig = { enabled: boolean; notificationEnabled: boolean; notificationTime: string; startWeek: string; employeeOrder: Prisma.JsonValue; leaderStartWeek: string | null; leaderStartEmployeeId: number | null };
type SendLeader = (url: string, assignment: DailyLeaderAssignment) => Promise<{ success: boolean; error?: string }>;

export class DailyRotationService {
  constructor(private database?: PrismaClient, private send: SendLeader = (url, assignment) => NotificationService.sendDailyLeaderNotification(url, assignment)) {}
  private get prisma() { return this.database ?? getPrisma(); }
  private today() { return moment().utcOffset('+07:00').format('YYYY-MM-DD'); }

  private async ensureConfig() {
    return this.prisma.dailyRotationConfig.upsert({ where: { id: 1 }, update: {},
      create: { id: 1, startWeek: weekOf(this.today()) } });
  }

  private async collect(tx: Prisma.TransactionClient, cfg: StoredConfig, end: string, persist: boolean) {
    const currentWeek = weekOf(this.today());
    if (end < cfg.startWeek) return [];
    const employees = await tx.employee.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const order = reconcileOrder(cfg.employeeOrder as number[], employees);
    const members = order.map(id => employees.find(e => e.id === id)!);
    const stored = await tx.dailyMeetingWeek.findMany({ where: { weekStart: { gte: cfg.startWeek, lte: weekOf(end) } } });
    const holidays = new Set((await tx.companyHoliday.findMany({ where: { date: { gte: cfg.startWeek, lte: moment.utc(end).add(7, 'days').format('YYYY-MM-DD') } } })).map(h => h.date));
    const currentClaimed = await tx.dailyLeaderDelivery.count({ where: { weekStart: currentWeek } }) > 0;
    // A durable delivery claim consumes the turn even if its external result
    // is uncertain. Unsent current/future weeks still follow holiday edits.
    for (const snapshot of stored.filter(s => s.weekStart < currentWeek || (s.weekStart === currentWeek && currentClaimed))) {
      for (let i = 0; i < 5; i++) {
        const date = moment.utc(snapshot.weekStart).add(i, 'days').format('YYYY-MM-DD');
        if (!snapshot.employeeId || date < snapshot.date) holidays.add(date);
        else holidays.delete(date);
      }
    }
    const snapshots = stored.filter(s => s.employeeId !== null).map(s => ({ ...s, employeeId: s.employeeId!, employeeName: s.employeeName! }));
    const anchor = cfg.leaderStartWeek && cfg.leaderStartEmployeeId !== null
      ? { weekStart: cfg.leaderStartWeek, employeeId: cfg.leaderStartEmployeeId } : undefined;
    const result = buildAssignments(cfg.startWeek, end, members, [...holidays], snapshots, anchor);
    if (persist) {
      for (const week = moment.utc(cfg.startWeek); week.format('YYYY-MM-DD') <= weekOf(end) && week.format('YYYY-MM-DD') <= currentWeek; week.add(1, 'week')) {
        const weekStart = week.format('YYYY-MM-DD');
        const item = result.find(a => a.weekStart === weekStart);
        if (item) await tx.dailyMeetingWeek.upsert({ where: { weekStart }, create: item, update: weekStart === currentWeek ? { date: item.date, employeeId: item.employeeId, employeeName: item.employeeName } : {} });
        else await tx.dailyMeetingWeek.upsert({ where: { weekStart }, create: { weekStart, date: '' }, update: weekStart === currentWeek ? { date: '', employeeId: null, employeeName: null } : {} });
      }
    }
    return result;
  }

  async getSettings(): Promise<DailyRotationSettings> {
    const cfg = await this.ensureConfig();
    const employees = await this.prisma.employee.findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const start = cfg.startWeek > this.today() ? cfg.startWeek : weekOf(this.today());
    const end = moment.utc(start).add(3, 'weeks').format('YYYY-MM-DD');
    const preview = await this.prisma.$transaction(tx => this.collect(tx, cfg, end, false));
    const nextWeekStart = moment.utc(weekOf(this.today())).add(1, 'week').format('YYYY-MM-DD');
    const pendingAnchor = cfg.leaderStartWeek && cfg.leaderStartEmployeeId !== null
      && employees.some(e => e.id === cfg.leaderStartEmployeeId)
      && !preview.some(a => a.weekStart >= cfg.leaderStartWeek! && a.weekStart < nextWeekStart)
      ? cfg.leaderStartEmployeeId : null;
    return { enabled: cfg.enabled, notificationEnabled: cfg.notificationEnabled, notificationTime: cfg.notificationTime, startWeek: cfg.startWeek,
      nextWeekStart, nextLeaderEmployeeId: preview.find(a => a.weekStart >= nextWeekStart)?.employeeId ?? pendingAnchor,
      employeeOrder: reconcileOrder(cfg.employeeOrder as number[], employees),
      employees: employees.map(e => ({ ...e, createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString() })),
      preview: preview.filter(a => a.weekStart >= start) };
  }

  async updateSettings(updates: DailyRotationUpdate): Promise<DailyRotationSettings> {
    if (updates.notificationTime !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(updates.notificationTime)) throw new DailyRotationValidationError('Invalid notification time');
    if (updates.startWeek !== undefined) {
      validateDate(updates.startWeek);
      if (weekOf(updates.startWeek) !== updates.startWeek || Math.abs(moment.utc(this.today()).diff(moment.utc(updates.startWeek), 'weeks')) > 1040) throw new DailyRotationValidationError('Start week must be a Monday within 20 years');
    }
    await this.ensureConfig();
    await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM daily_rotation_config WHERE id = 1 FOR UPDATE`;
      const cfg = (await tx.dailyRotationConfig.findUnique({ where: { id: 1 } }))!;
      const employees = await tx.employee.findMany();
      if (updates.nextLeaderEmployeeId !== undefined && (!Number.isInteger(updates.nextLeaderEmployeeId) || !employees.some(e => e.id === updates.nextLeaderEmployeeId))) {
        throw new DailyRotationValidationError('Selected leader must be a current employee');
      }
      if (updates.employeeOrder) {
        const ids = updates.employeeOrder;
        if (ids.length !== employees.length || new Set(ids).size !== ids.length || ids.some(id => !employees.some(e => e.id === id))) throw new DailyRotationValidationError('Order must include each current employee exactly once');
      }
      if (updates.startWeek && updates.startWeek !== cfg.startWeek && await tx.dailyMeetingWeek.count()) throw new DailyRotationValidationError('Start week cannot change after rotation has started');
      // Once started, preserve history even while the feature is OFF before
      // replacing its anchor/order. Before first activation, consume no turn.
      const previouslyStarted = await tx.dailyMeetingWeek.count() > 0;
      if (cfg.enabled || previouslyStarted) await this.collect(tx, cfg, this.today(), true);
      const { nextLeaderEmployeeId, ...otherUpdates } = updates;
      const data: Prisma.DailyRotationConfigUpdateInput = { ...otherUpdates };
      const hasHistory = await tx.dailyMeetingWeek.count() > 0;
      if (nextLeaderEmployeeId !== undefined) {
        const nextWeek = moment.utc(weekOf(this.today())).add(1, 'week').format('YYYY-MM-DD');
        data.leaderStartWeek = nextWeek;
        data.leaderStartEmployeeId = nextLeaderEmployeeId;
        // Before first activation the selected person starts next week;
        // viewing configuration earlier must not consume a default turn.
        if (!cfg.enabled && !hasHistory) data.startWeek = nextWeek;
      } else if (updates.enabled && !cfg.enabled && !updates.startWeek && !hasHistory) {
        data.startWeek = cfg.leaderStartWeek && cfg.leaderStartWeek >= weekOf(this.today())
          ? cfg.leaderStartWeek : weekOf(this.today());
      }
      const updated = await tx.dailyRotationConfig.update({ where: { id: 1 }, data });
      if (updated.enabled) await this.collect(tx, updated, this.today(), true);
    }, { timeout: 30000 });
    return this.getSettings();
  }

  async getAssignments(start: string, end: string): Promise<DailyLeaderAssignment[]> {
    validateDate(start); validateDate(end);
    if (start > end || moment.utc(end).diff(moment.utc(start), 'days') > 366) throw new DailyRotationValidationError('Calendar range must be at most one year');
    await this.ensureConfig();
    return this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM daily_rotation_config WHERE id = 1 FOR UPDATE`;
      const cfg = (await tx.dailyRotationConfig.findUnique({ where: { id: 1 } }))!;
      if (!cfg.enabled) return [];
      return (await this.collect(tx, cfg, end, true)).filter(a => a.date >= start && a.date <= end);
    }, { timeout: 30000 });
  }

  async dispatchDue(now: Date = new Date(moment.now())): Promise<void> {
    const time = moment(now).utcOffset('+07:00');
    const date = time.format('YYYY-MM-DD');
    await this.ensureConfig();
    const deliveries = await this.prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM daily_rotation_config WHERE id = 1 FOR UPDATE`;
      const cfg = (await tx.dailyRotationConfig.findUnique({ where: { id: 1 } }))!;
      if (!cfg.enabled || !cfg.notificationEnabled || cfg.notificationTime !== time.format('HH:mm')) return [];
      const assignment = (await this.collect(tx, cfg, date, true)).find(a => a.date === date);
      if (!assignment) return [];
      const targets = await tx.cronjobConfig.findMany({ where: { dailyLeaderEnabled: true }, orderBy: { id: 'asc' } });
      const claimedTargets = [];
      for (const target of targets) {
        const webhookKey = createHash('sha256').update(target.webhookUrl).digest('hex');
        // Freeze the assignment and claim every destination under the same
        // configuration lock. A concurrent calendar refresh cannot replace it.
        const claimed = await tx.dailyLeaderDelivery.createMany({ data: { weekStart: assignment.weekStart, webhookKey, configId: target.id }, skipDuplicates: true });
        if (claimed.count) claimedTargets.push({ target, webhookKey, assignment });
      }
      return claimedTargets;
    }, { timeout: 30000 });
    // Network I/O happens after commit. Failed/uncertain results retain their
    // claims, since Teams may have accepted a message before a timeout.
    for (const { target, webhookKey, assignment } of deliveries) {
      let success = false;
      try { success = (await this.send(target.webhookUrl, assignment)).success; }
      catch { Logger.error(`Daily meeting leader send failed for cronjob ${target.id}`); }
      await this.prisma.dailyLeaderDelivery.updateMany({ where: { weekStart: assignment.weekStart, webhookKey }, data: { status: success ? 'sent' : 'failed' } });
    }
  }
}
