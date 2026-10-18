import { Elysia, t } from 'elysia';
import { DailyRotationService, DailyRotationValidationError } from '../services/dailyRotationService';
import { assertAdminAuth } from '../utils/adminSession';
import Logger from '../utils/logger';

export function createDailyRotationRoutes(service = new DailyRotationService()) {
  return new Elysia({ prefix: '/daily-rotation' })
    .get('/events', async ({ query, set }) => {
      try { return { success: true, data: await service.getAssignments(query.start, query.end) }; }
      catch (error) {
        if (error instanceof DailyRotationValidationError) { set.status = 400; return { success: false, error: error.message }; }
        Logger.error('Unable to load daily meeting events:', error);
        set.status = 500;
        return { success: false, error: 'Unable to load daily meeting events' };
      }
    }, { query: t.Object({ start: t.String(), end: t.String() }) })
    .get('/', async ({ headers, set }) => {
      try { assertAdminAuth(headers.authorization); return { success: true, data: await service.getSettings() }; }
      catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') { set.status = 401; return { success: false, error: 'Unauthorized' }; }
        Logger.error('Unable to load daily rotation settings:', error);
        set.status = 500;
        return { success: false, error: 'Unable to load settings' };
      }
    })
    .put('/', async ({ headers, body, set }) => {
      try { assertAdminAuth(headers.authorization); return { success: true, data: await service.updateSettings(body) }; }
      catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') { set.status = 401; return { success: false, error: 'Unauthorized' }; }
        if (error instanceof DailyRotationValidationError) { set.status = 400; return { success: false, error: error.message }; }
        Logger.error('Unable to save daily rotation settings:', error);
        set.status = 500;
        return { success: false, error: 'Unable to save settings' };
      }
    }, { body: t.Object({
      enabled: t.Optional(t.Boolean()), notificationEnabled: t.Optional(t.Boolean()),
      notificationTime: t.Optional(t.String()), startWeek: t.Optional(t.String()),
      employeeOrder: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
      currentLeaderEmployeeId: t.Optional(t.Integer({ minimum: 1 })),
      nextLeaderEmployeeId: t.Optional(t.Integer({ minimum: 1 })),
    }) });
}

export const dailyRotationRoutes = createDailyRotationRoutes();
