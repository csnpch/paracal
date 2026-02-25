import { getPrisma } from '../database/connection';
import Logger from '../utils/logger';
import moment from 'moment';

export type LogAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CLEAR' | 'LOGIN' | 'CHANGE_PIN';
export type LogEntity = 'event' | 'employee' | 'company_holiday' | 'cronjob' | 'admin';

export interface CreateLogInput {
  action: LogAction;
  entity: LogEntity;
  entityId?: number;
  entityName?: string;
  detail?: string;
}

export class LogService {
  private get prisma() {
    return getPrisma();
  }

  /** Write a new activity log entry */
  async writeLog(input: CreateLogInput): Promise<void> {
    try {
      await this.prisma.activityLog.create({
        data: {
          action: input.action,
          entity: input.entity,
          entityId: input.entityId ?? null,
          entityName: input.entityName ?? null,
          detail: input.detail ?? null,
        },
      });
    } catch (error) {
      // Never throw from logging – just warn
      Logger.warn(`[LogService] Failed to write activity log: ${error}`);
    }
  }

  /** Get all logs, newest first, optional filters */
  async getLogs(opts?: {
    entity?: LogEntity;
    action?: LogAction;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = {};
    if (opts?.entity) where.entity = opts.entity;
    if (opts?.action) where.action = opts.action;

    const [total, logs] = await Promise.all([
      this.prisma.activityLog.count({ where }),
      this.prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: opts?.limit ?? 200,
        skip: opts?.offset ?? 0,
      }),
    ]);

    return { total, logs };
  }

  /** Delete all logs (clear) */
  async clearAllLogs(): Promise<{ deletedCount: number }> {
    const result = await this.prisma.activityLog.deleteMany({});
    return { deletedCount: result.count };
  }

  /** Delete logs older than N days (default: 10) */
  async deleteOldLogs(days: number = 10): Promise<{ deletedCount: number }> {
    const cutoff = moment().subtract(days, 'days').toDate();
    const result = await this.prisma.activityLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return { deletedCount: result.count };
  }
}

export const logService = new LogService();
