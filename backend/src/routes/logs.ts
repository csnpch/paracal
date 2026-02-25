import { Elysia, t } from 'elysia';
import { logService } from '../services/logService';
import type { LogEntity, LogAction } from '../services/logService';
import { getPrisma } from '../database/connection';
import bcrypt from 'bcryptjs';
import Logger from '../utils/logger';

// ── Helpers ──────────────────────────────────────────────────

async function validateAdminPassword(pin: string | undefined): Promise<void> {
  if (!pin) throw new Error('Invalid PIN');
  const prisma = getPrisma();
  const adminConfig = await prisma.adminConfig.findFirst({ orderBy: { id: 'desc' } });
  if (!adminConfig) throw new Error('Admin config not found');
  const isValid = bcrypt.compareSync(pin, adminConfig.pin);
  if (!isValid) throw new Error('Invalid PIN');
}

// ── Routes ───────────────────────────────────────────────────

export const logsRoutes = new Elysia({ prefix: '/logs' })
  /** GET /logs  – list logs (most recent first, max 200) */
  .get('/', async ({ query }) => {
    try {
      const { entity, action, limit, offset } = query;
      const result = await logService.getLogs({
        entity: entity as LogEntity | undefined,
        action: action as LogAction | undefined,
        limit: limit ? Number(limit) : 200,
        offset: offset ? Number(offset) : 0,
      });
      return result;
    } catch (error) {
      Logger.error('Error fetching logs:', error);
      throw error;
    }
  }, {
    query: t.Object({
      entity: t.Optional(t.String()),
      action: t.Optional(t.String()),
      limit:  t.Optional(t.String()),
      offset: t.Optional(t.String()),
    }),
  })

  /** DELETE /logs/clear  – clear ALL logs (requires PIN) */
  .delete('/clear', async ({ body }) => {
    try {
      await validateAdminPassword(body.password);
      const result = await logService.clearAllLogs();
      Logger.info(`[Logs] Cleared all logs (${result.deletedCount} entries)`);
      return result;
    } catch (error) {
      Logger.error('Error clearing logs:', error);
      throw error;
    }
  }, { body: t.Object({ password: t.String() }) })

  /** DELETE /logs/old  – purge logs older than N days (requires PIN) */
  .delete('/old', async ({ body }) => {
    try {
      await validateAdminPassword(body.password);
      const days = body.days ?? 10;
      const result = await logService.deleteOldLogs(days);
      Logger.info(`[Logs] Deleted ${result.deletedCount} log(s) older than ${days} day(s)`);
      return result;
    } catch (error) {
      Logger.error('Error deleting old logs:', error);
      throw error;
    }
  }, {
    body: t.Object({
      password: t.String(),
      days: t.Optional(t.Number()),
    }),
  });
