import { Elysia, t } from 'elysia';
import { CronjobService } from '../services/cronjobService';
import { getDatabase } from '../database/connection';
import Logger from '../utils/logger';

const cronjobService = new CronjobService(getDatabase());

export const cronjobRoutes = new Elysia({ prefix: '/cronjobs' })
  .get('/', () => {
    try {
      return { success: true, data: cronjobService.getAllConfigs() };
    } catch (error) {
      Logger.error('Error fetching cronjob configs:', error);
      throw error;
    }
  })

  .get('/status', () => {
    try {
      const configs = cronjobService.getEnabledConfigs();
      const statusList = configs.map((cfg) => ({
        id: cfg.id,
        name: cfg.name,
        enabled: cfg.enabled,
        schedule_time: cfg.schedule_time,
        running: true,
      }));
      return { success: true, data: statusList };
    } catch (error) {
      Logger.error('Error fetching cronjob status:', error);
      throw error;
    }
  })

  .get('/:id', ({ params: { id } }) => {
    try {
      const cfg = cronjobService.getConfigById(Number(id));
      if (!cfg) throw new Error(`Cronjob configuration ${id} not found`);
      return { success: true, data: cfg };
    } catch (error) {
      Logger.error(`Error fetching cronjob ${id}:`, error);
      throw error;
    }
  }, { params: t.Object({ id: t.String() }) })

  .post('/', ({ body }) => {
    try {
      const cfg = cronjobService.createConfig({
        ...body,
        notification_type: body.notification_type || 'daily',
      });
      Logger.info(`Created cronjob config: ${cfg.name}`);
      return { success: true, data: cfg, message: 'Cronjob configuration created successfully' };
    } catch (error) {
      Logger.error('Error creating cronjob config:', error);
      throw error;
    }
  }, {
    body: t.Object({
      name: t.String(),
      enabled: t.Boolean(),
      schedule_time: t.String(),
      webhook_url: t.String(),
      notification_days: t.Number(),
      notification_type: t.Optional(t.Union([t.Literal('daily'), t.Literal('weekly')])),
      weekly_days: t.Optional(t.Array(t.Number())),
      weekly_scope: t.Optional(t.Union([t.Literal('current'), t.Literal('next')])),
    }),
  })

  .put('/:id', ({ params: { id }, body }) => {
    try {
      const cfg = cronjobService.updateConfig(Number(id), body);
      if (!cfg) throw new Error(`Cronjob configuration ${id} not found`);
      Logger.info(`Updated cronjob config: ${cfg.name}`);
      return { success: true, data: cfg, message: 'Cronjob configuration updated successfully' };
    } catch (error) {
      Logger.error(`Error updating cronjob ${id}:`, error);
      throw error;
    }
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      enabled: t.Optional(t.Boolean()),
      schedule_time: t.Optional(t.String()),
      webhook_url: t.Optional(t.String()),
      notification_days: t.Optional(t.Number()),
      notification_type: t.Optional(t.Union([t.Literal('daily'), t.Literal('weekly')])),
      weekly_days: t.Optional(t.Array(t.Number())),
      weekly_scope: t.Optional(t.Union([t.Literal('current'), t.Literal('next')])),
    }),
  })

  .delete('/:id', ({ params: { id } }) => {
    try {
      const success = cronjobService.deleteConfig(Number(id));
      if (!success) throw new Error(`Cronjob configuration ${id} not found`);
      Logger.info(`Deleted cronjob config: ${id}`);
      return { success: true, message: 'Cronjob configuration deleted successfully' };
    } catch (error) {
      Logger.error(`Error deleting cronjob ${id}:`, error);
      throw error;
    }
  }, { params: t.Object({ id: t.String() }) })

  .post('/:id/test', async ({ params: { id }, body }) => {
    try {
      const { customMessage } = (body as any) || {};
      Logger.info(`Testing notification for cronjob ${id}`);
      const result = await cronjobService.testNotification(Number(id), customMessage);
      return { success: result.success, message: result.success ? 'Test notification sent successfully' : result.error };
    } catch (error) {
      Logger.error(`Error testing notification ${id}:`, error);
      throw error;
    }
  }, { 
    params: t.Object({ id: t.String() }),
    body: t.Optional(t.Object({ customMessage: t.Optional(t.String()) }))
  });