import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { cron } from '@elysiajs/cron';

import { employeesRoutes } from './routes/employees';
import { eventsRoutes } from './routes/events';
import { holidaysRoutes } from './routes/holidays';
import { companyHolidaysRoutes } from './routes/companyHolidays';
import { cronjobRoutes } from './routes/cronjobs';
import { authRoutes } from './routes/auth';
import { logsRoutes } from './routes/logs';
import { loggerMiddleware } from './middleware/logger';
import { CronjobService } from './services/cronjobService';
import { EventMergeService } from './services/eventMergeService';
import { logService } from './services/logService';
import { seedDatabase } from './database/connection';
import config from './config';
import Logger from './utils/logger';
import moment from 'moment';

// Initialize services
const cronjobService = new CronjobService();
const eventMergeService = new EventMergeService();

// Seed database (async) then start server
async function startServer() {
  await seedDatabase();

  // Run event merge job immediately on server start
  eventMergeService
    .executeMergeJob()
    .then(() => Logger.info('[EventMerge] Initial merge job completed on server start'))
    .catch((error) => Logger.error('[EventMerge] Error during initial merge job:', error));

  const app = new Elysia()
    .use(loggerMiddleware)
    .use(cors({
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }))
    .use(swagger({
      documentation: {
        info: {
          title: 'Paracal API',
          version: '1.0.0',
          description: 'API for Paracal Employee Leave Management System',
        },
        tags: [
          { name: 'employees', description: 'Employee management endpoints' },
          { name: 'events', description: 'Event management endpoints' },
          { name: 'holidays', description: 'Holiday information endpoints' },
          { name: 'company-holidays', description: 'Company holiday management endpoints' },
          { name: 'cronjobs', description: 'Cronjob management and notifications' },
        ],
      },
    }))
    .use(cron({
      name: 'dynamic-notification-checker',
      pattern: '* * * * *',
      timezone: 'Asia/Bangkok',
      async run() {
        try {
          await cronjobService.checkAndExecuteScheduledNotifications();
        } catch (error) {
          Logger.error('[Cron] Error in notification checker:', error);
        }
      },
    }))
    .use(cron({
      name: 'auto-merge-consecutive-events',
      pattern: '30 3 * * *',
      timezone: 'Asia/Bangkok',
      run() { eventMergeService.executeMergeJob(); },
    }))
    .use(cron({
      name: 'purge-old-activity-logs',
      pattern: '0 2 * * *',
      timezone: 'Asia/Bangkok',
      async run() {
        const result = await logService.deleteOldLogs(10);
        Logger.info(`[Logs] Auto-purged ${result.deletedCount} log(s) older than 10 days`);
      },
    }))
    .use(cron({
      name: 'daily-server-restart',
      pattern: '0 8 * * *',
      timezone: 'Asia/Bangkok',
      run() {
        Logger.info('[Cron] Daily restart at 08:00 — Railway will restart automatically');
        process.exit(1);
      },
    }))
    .get('/', () => ({ message: 'Paracal API is running!' }))
    .get('/health', () => ({
      status: 'ok',
      timestamp: moment().utcOffset('+07:00').toISOString(),
    }))
    .use(employeesRoutes)
    .use(eventsRoutes)
    .use(holidaysRoutes)
    .use(companyHolidaysRoutes)
    .use(cronjobRoutes)
    .use(authRoutes)
    .use(logsRoutes)
    .listen(config.port);

  Logger.info(`🚀 Paracal API is running at http://localhost:${config.port}`);
  Logger.info(`📚 API Documentation available at http://localhost:${config.port}/swagger`);
  Logger.info('⏰ Cron scheduler initialized with dynamic notification checking every minute');
  Logger.info('🔄 Auto-merge consecutive events job scheduled to run daily at 03:30 AM');
  Logger.info('🗑️  Auto-purge old activity logs job scheduled to run daily at 02:00 AM');
  Logger.info('🔁 Daily server restart scheduled at 08:00 AM (Asia/Bangkok)');

  return app;
}

const app = startServer();

export type App = Awaited<typeof app>;
