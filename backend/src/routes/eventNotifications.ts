import { Elysia, t } from 'elysia';
import { assertAdminAuth } from '../utils/adminSession';
import { EventNotificationService, EventNotificationError } from '../services/eventNotificationService';
import Logger from '../utils/logger';
export function createEventNotificationRoutes(service = new EventNotificationService()) {
  return new Elysia({ prefix: '/events' }).post('/:id/notify-now', async ({ params, headers, set }) => {
    try {
      assertAdminAuth(headers.authorization);
      return { success: true, data: await service.notify(params.id) };
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') { set.status = 401; return { success: false, error: 'Unauthorized' }; }
      if (error instanceof EventNotificationError) { set.status = error.status; return { success: false, error: error.message }; }
      Logger.error('Unable to send immediate event notification:', error);
      set.status = 500; return { success: false, error: 'Unable to confirm notification delivery' };
    }
  }, { params: t.Object({ id: t.Numeric({ minimum: 1, multipleOf: 1 }) }) });
}
export const eventNotificationRoutes = createEventNotificationRoutes();
