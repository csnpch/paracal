import type { CronjobConfig } from '../types';
import { getPrisma } from '../database/connection';
import { NotificationService } from './notificationService';
import { EventService } from './eventService';
import moment from 'moment';
import Logger from '../utils/logger';

export class CronjobService {
  private get prisma() { return getPrisma(); }
  private eventService: EventService;
  private lastExecutionTimes: Map<number, string> = new Map();

  constructor() {
    this.eventService = new EventService();
  }

  // ── Config CRUD ────────────────────────────────────────────

  private parseConfig(raw: any): CronjobConfig {
    return {
      id: raw.id,
      name: raw.name,
      enabled: raw.enabled,
      schedule_time: raw.scheduleTime,
      webhook_url: raw.webhookUrl,
      notification_days: raw.notificationDays,
      notification_type: raw.notificationType,
      weekly_days: raw.weeklyDays ? JSON.parse(raw.weeklyDays) : undefined,
      weekly_scope: raw.weeklyScope,
      created_at: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : raw.createdAt,
      updated_at: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : raw.updatedAt,
    };
  }

  async getAllConfigs(): Promise<CronjobConfig[]> {
    const rows = await this.prisma.cronjobConfig.findMany({ orderBy: { scheduleTime: 'asc' } });
    return rows.map((r) => this.parseConfig(r));
  }

  async getEnabledConfigs(): Promise<CronjobConfig[]> {
    const rows = await this.prisma.cronjobConfig.findMany({
      where: { enabled: true },
      orderBy: { scheduleTime: 'asc' },
    });
    return rows.map((r) => this.parseConfig(r));
  }

  async getConfigById(id: number): Promise<CronjobConfig | null> {
    const raw = await this.prisma.cronjobConfig.findUnique({ where: { id } });
    return raw ? this.parseConfig(raw) : null;
  }

  async createConfig(config: Omit<CronjobConfig, 'id' | 'created_at' | 'updated_at'>): Promise<CronjobConfig> {
    const now = new Date();
    const row = await this.prisma.cronjobConfig.create({
      data: {
        name: config.name,
        enabled: config.enabled,
        scheduleTime: config.schedule_time,
        webhookUrl: config.webhook_url,
        notificationDays: config.notification_days,
        notificationType: config.notification_type || 'daily',
        weeklyDays: config.weekly_days ? JSON.stringify(config.weekly_days) : null,
        weeklyScope: config.weekly_scope || 'current',
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.parseConfig(row);
  }

  async updateConfig(id: number, updates: Partial<Omit<CronjobConfig, 'id' | 'created_at' | 'updated_at'>>): Promise<CronjobConfig | null> {
    const current = await this.getConfigById(id);
    if (!current) return null;

    const data: any = { updatedAt: new Date() };
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.enabled !== undefined) data.enabled = updates.enabled;
    if (updates.schedule_time !== undefined) data.scheduleTime = updates.schedule_time;
    if (updates.webhook_url !== undefined) data.webhookUrl = updates.webhook_url;
    if (updates.notification_days !== undefined) data.notificationDays = updates.notification_days;
    if (updates.notification_type !== undefined) data.notificationType = updates.notification_type;
    if (updates.weekly_days !== undefined) data.weeklyDays = updates.weekly_days ? JSON.stringify(updates.weekly_days) : null;
    if (updates.weekly_scope !== undefined) data.weeklyScope = updates.weekly_scope;

    await this.prisma.cronjobConfig.update({ where: { id }, data });
    return this.getConfigById(id);
  }

  async deleteConfig(id: number): Promise<boolean> {
    try {
      await this.prisma.cronjobConfig.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  // ── Event Querying ─────────────────────────────────────────

  private getNotificationDate(notificationDays: number): string {
    return moment().utcOffset('+07:00').add(notificationDays, 'days').format('YYYY-MM-DD');
  }

  private getWeekDateRange(scope: 'current' | 'next'): { startDate: string; endDate: string } {
    const now = moment().utcOffset('+07:00');
    const weekStart = now.clone().startOf('week');
    if (scope === 'next') weekStart.add(7, 'days');
    const weekEnd = weekStart.clone().add(6, 'days');

    return {
      startDate: weekStart.format('YYYY-MM-DD'),
      endDate: weekEnd.format('YYYY-MM-DD'),
    };
  }

  private shouldSendWeeklyToday(weeklyDays: number[]): boolean {
    const today = moment().utcOffset('+07:00').day();
    return weeklyDays.includes(today);
  }

  private async shouldSkipToday(dateString: string): Promise<boolean> {
    try {
      const count = await this.prisma.companyHoliday.count({ where: { date: dateString } });
      if (count > 0) return true;

      const dayOfWeek = moment(dateString).day();
      return dayOfWeek === 0 || dayOfWeek === 6;
    } catch (error) {
      Logger.error(`Error checking skip status for ${dateString}:`, error);
      return false;
    }
  }

  // ── Notification Execution ─────────────────────────────────

  async executeNotification(cfg: CronjobConfig): Promise<{ success: boolean; error?: string }> {
    try {
      Logger.info(`Executing cronjob: ${cfg.name} at ${moment().utcOffset('+07:00').format()}`);

      if (cfg.notification_type === 'weekly') {
        if (!cfg.weekly_days || !this.shouldSendWeeklyToday(cfg.weekly_days)) {
          Logger.debug(`Today is not a configured notification day for ${cfg.name}, skipping`);
          return { success: true };
        }

        const scope = cfg.weekly_scope || 'current';
        const { startDate, endDate } = this.getWeekDateRange(scope);
        const events = await this.eventService.getEventsByDateRange(startDate, endDate);
        Logger.debug(`Found ${events.length} events for ${scope} week (${startDate} to ${endDate})`);

        const result = await NotificationService.sendWeeklyNotification(events, cfg.webhook_url, startDate, endDate, scope);
        Logger.info(`Weekly notification for ${cfg.name}: ${result.success ? 'success' : 'failed'}`);
        return result;
      } else {
        const notificationDate = this.getNotificationDate(cfg.notification_days);
        const events = await this.eventService.getEventsByDate(notificationDate);
        Logger.debug(`Found ${events.length} events for ${notificationDate}`);

        if (events.length === 0) {
          Logger.debug(`No events found for ${notificationDate}, skipping notification`);
          return { success: true };
        }

        const result = await NotificationService.sendDailyNotification(events, cfg.webhook_url, notificationDate, cfg.notification_days);
        Logger.info(`Daily notification for ${cfg.name}: ${result.success ? 'success' : 'failed'}`);
        return result;
      }
    } catch (error) {
      Logger.error(`Error executing cronjob ${cfg.name}:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async testNotification(id: number, customMessage?: string): Promise<{ success: boolean; error?: string }> {
    const cfg = await this.getConfigById(id);
    if (!cfg) return { success: false, error: `Cronjob configuration ${id} not found` };

    if (cfg.notification_type === 'weekly') {
      const scope = cfg.weekly_scope || 'current';
      const { startDate, endDate } = this.getWeekDateRange(scope);
      const events = await this.eventService.getEventsByDateRange(startDate, endDate);
      return NotificationService.sendWeeklyNotification(events, cfg.webhook_url, startDate, endDate, scope, customMessage);
    } else {
      const notificationDate = this.getNotificationDate(cfg.notification_days);
      const events = await this.eventService.getEventsByDate(notificationDate);
      return NotificationService.sendDailyNotification(events, cfg.webhook_url, notificationDate, cfg.notification_days, customMessage);
    }
  }

  // ── Cron Scheduler ─────────────────────────────────────────

  async checkAndExecuteScheduledNotifications(): Promise<void> {
    const now = moment().utcOffset('+07:00');
    const currentTime = now.format('HH:mm');
    const currentDate = now.format('YYYY-MM-DD');
    const currentKey = `${currentDate}-${currentTime}`;

    // Drop dedupe entries from previous days so the Map stays bounded.
    for (const [id, key] of this.lastExecutionTimes) {
      if (!key.startsWith(currentDate)) this.lastExecutionTimes.delete(id);
    }

    if (await this.shouldSkipToday(currentDate)) {
      Logger.debug(`Skipping ${currentDate} (company holiday or weekend)`);
      return;
    }

    const allEnabled = await this.getEnabledConfigs();
    const configs = allEnabled.filter((cfg) => {
      const lastExec = this.lastExecutionTimes.get(cfg.id);
      return cfg.schedule_time === currentTime && lastExec !== currentKey;
    });

    if (configs.length === 0) return;

    Logger.info(`Found ${configs.length} scheduled notifications for ${currentTime}`);
    for (const cfg of configs) {
      Logger.info(`Executing scheduled notification: ${cfg.name}`);
      await this.executeNotification(cfg);
      this.lastExecutionTimes.set(cfg.id, currentKey);
    }
  }
}