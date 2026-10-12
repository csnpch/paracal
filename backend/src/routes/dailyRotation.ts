import { Elysia, t } from 'elysia';
import { DailyRotationService } from '../services/dailyRotationService';
import { assertAdminAuth } from '../utils/adminSession';

export function createDailyRotationRoutes(service = new DailyRotationService()) {
  return new Elysia({ prefix: '/daily-rotation' })
    .get('/events', async ({ query, set }) => {
      try { return { success: true, data: await service.getAssignments(query.start, query.end) }; }
      catch (error) { set.status = 400; return { success: false, error: error instanceof Error ? error.message : 'Invalid range' }; }
    }, { query: t.Object({ start: t.String(), end: t.String() }) })
    .get('/', async ({ headers, set }) => {
      try { assertAdminAuth(headers.authorization); return { success: true, data: await service.getSettings() }; }
      catch (error) { set.status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 500; return { success: false, error: error instanceof Error ? error.message : 'Unable to load settings' }; }
    })
    .put('/', async ({ headers, body, set }) => {
      try { assertAdminAuth(headers.authorization); return { success: true, data: await service.updateSettings(body) }; }
      catch (error) { set.status = error instanceof Error && error.message === 'Unauthorized' ? 401 : 400; return { success: false, error: error instanceof Error ? error.message : 'Unable to save settings' }; }
    }, { body: t.Object({
      enabled: t.Optional(t.Boolean()), notificationEnabled: t.Optional(t.Boolean()),
      notificationTime: t.Optional(t.String()), startWeek: t.Optional(t.String()),
      employeeOrder: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
    }) });
}

export const dailyRotationRoutes = createDailyRotationRoutes();
