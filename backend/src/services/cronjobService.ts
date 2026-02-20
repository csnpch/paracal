import type { Database } from 'bun:sqlite';
import type { Event, CronjobConfig } from '../types';
import { NotificationService } from './notificationService';
import { EventService } from './eventService';
import moment from 'moment';
import Logger from '../utils/logger';

export class CronjobService {
  private db: Database;
  private eventService: EventService;
  private lastExecutionTimes: Map<number, string> = new Map();

  constructor(db: Database) {
    this.db = db;
    this.eventService = new EventService();
  }

  // ── Config CRUD ────────────────────────────────────────────

  private parseConfig(raw: any): CronjobConfig {
    return {
      ...raw,
      weekly_days: raw.weekly_days ? JSON.parse(raw.weekly_days) : undefined,
      enabled: Boolean(raw.enabled),
    };
  }

  getAllConfigs(): CronjobConfig[] {
    return (this.db.prepare('SELECT * FROM cronjob_config ORDER BY schedule_time').all() as any[]).map(this.parseConfig);
  }

  getEnabledConfigs(): CronjobConfig[] {
    return (this.db.prepare('SELECT * FROM cronjob_config WHERE enabled = 1 ORDER BY schedule_time').all() as any[]).map(this.parseConfig);
  }

  getConfigById(id: number): CronjobConfig | null {
    const raw = this.db.prepare('SELECT * FROM cronjob_config WHERE id = ?').get(id) as any;
    return raw ? this.parseConfig(raw) : null;
  }

  createConfig(config: Omit<CronjobConfig, 'id' | 'created_at' | 'updated_at'>): CronjobConfig {
    const stmt = this.db.prepare(`
      INSERT INTO cronjob_config (name, enabled, schedule_time, webhook_url, notification_days, notification_type, weekly_days, weekly_scope, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      config.name, config.enabled ? 1 : 0, config.schedule_time, config.webhook_url,
      config.notification_days, config.notification_type || 'daily',
      config.weekly_days ? JSON.stringify(config.weekly_days) : null,
      config.weekly_scope || 'current',
    );

    return this.getConfigById(Number(result.lastInsertRowid))!;
  }

  updateConfig(id: number, updates: Partial<Omit<CronjobConfig, 'id' | 'created_at' | 'updated_at'>>): CronjobConfig | null {
    const current = this.getConfigById(id);
    if (!current) return null;

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
    if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
    if (updates.schedule_time !== undefined) { fields.push('schedule_time = ?'); values.push(updates.schedule_time); }
    if (updates.webhook_url !== undefined) { fields.push('webhook_url = ?'); values.push(updates.webhook_url); }
    if (updates.notification_days !== undefined) { fields.push('notification_days = ?'); values.push(updates.notification_days); }
    if (updates.notification_type !== undefined) { fields.push('notification_type = ?'); values.push(updates.notification_type); }
    if (updates.weekly_days !== undefined) { fields.push('weekly_days = ?'); values.push(updates.weekly_days ? JSON.stringify(updates.weekly_days) : null); }
    if (updates.weekly_scope !== undefined) { fields.push('weekly_scope = ?'); values.push(updates.weekly_scope); }

    if (fields.length === 0) return current;

    fields.push("updated_at = datetime('now')");
    values.push(id);

    this.db.prepare(`UPDATE cronjob_config SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getConfigById(id);
  }

  deleteConfig(id: number): boolean {
    return this.db.prepare('DELETE FROM cronjob_config WHERE id = ?').run(id).changes > 0;
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
      // Check company holiday
      const count = (this.db.prepare('SELECT COUNT(*) as count FROM company_holidays WHERE date = ?').get(dateString) as { count: number }).count;
      if (count > 0) return true;

      // Check weekend
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
        const events = this.eventService.getEventsByDateRange(startDate, endDate);
        Logger.debug(`Found ${events.length} events for ${scope} week (${startDate} to ${endDate})`);

        const result = await NotificationService.sendWeeklyNotification(events, cfg.webhook_url, startDate, endDate, scope);
        Logger.info(`Weekly notification for ${cfg.name}: ${result.success ? 'success' : 'failed'}`);
        return result;
      } else {
        const notificationDate = this.getNotificationDate(cfg.notification_days);
        const events = this.eventService.getEventsByDate(notificationDate);
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
    const cfg = this.getConfigById(id);
    if (!cfg) return { success: false, error: `Cronjob configuration ${id} not found` };

    // Always send test notification (even with 0 events) to validate webhook
    if (cfg.notification_type === 'weekly') {
      const scope = cfg.weekly_scope || 'current';
      const { startDate, endDate } = this.getWeekDateRange(scope);
      const events = this.eventService.getEventsByDateRange(startDate, endDate);
      return NotificationService.sendWeeklyNotification(events, cfg.webhook_url, startDate, endDate, scope, customMessage);
    } else {
      const notificationDate = this.getNotificationDate(cfg.notification_days);
      const events = this.eventService.getEventsByDate(notificationDate);
      return NotificationService.sendDailyNotification(events, cfg.webhook_url, notificationDate, cfg.notification_days, customMessage);
    }
  }

  // ── Cron Scheduler ─────────────────────────────────────────

  async checkAndExecuteScheduledNotifications(): Promise<void> {
    const now = moment().utcOffset('+07:00');
    const currentTime = now.format('HH:mm');
    const currentDate = now.format('YYYY-MM-DD');
    const currentKey = `${currentDate}-${currentTime}`;

    // Skip weekends and company holidays
    if (await this.shouldSkipToday(currentDate)) {
      Logger.debug(`Skipping ${currentDate} (company holiday or weekend)`);
      return;
    }

    const configs = this.getEnabledConfigs().filter((cfg) => {
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