import { Elysia, t } from 'elysia';
import { EventService } from '../services/eventService';
import { EventMergeService } from '../services/eventMergeService';
import { getPrisma } from '../database/connection';
import { logService } from '../services/logService';
import bcrypt from 'bcryptjs';
import Logger from '../utils/logger';

const eventService = new EventService();
const eventMergeService = new EventMergeService();

// ── Shared schema fragments ──────────────────────────────────

const leaveTypeSchema = t.Union([
  t.Literal('vacation'),
  t.Literal('personal'),
  t.Literal('sick'),
  t.Literal('unpaid'),
  t.Literal('compensatory'),
  t.Literal('other'),
]);

const idParam = t.Object({ id: t.String() });

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

export const eventsRoutes = new Elysia({ prefix: '/events' })
  .get('/', async () => {
    try {
      Logger.debug('Fetching all events');
      const events = await eventService.getAllEvents();
      Logger.debug(`Retrieved ${events.length} events`);
      return events;
    } catch (error) {
      Logger.error('Error fetching all events:', error);
      throw error;
    }
  })

  .get('/:id', async ({ params: { id } }) => {
    try {
      Logger.debug(`Fetching event with ID: ${id}`);
      const event = await eventService.getEventById(Number(id));
      if (!event) {
        Logger.warn(`Event not found with ID: ${id}`);
        throw new Error('Event not found');
      }
      return event;
    } catch (error) {
      Logger.error(`Error fetching event ${id}:`, error);
      throw error;
    }
  }, { params: idParam })

  .post('/', async ({ body }) => {
    try {
      Logger.debug(`Creating new event: ${JSON.stringify(body)}`);
      const newEvent = await eventService.createEvent(body);
      Logger.info(`Created event: ${newEvent.employeeName} - ${newEvent.leaveType} from ${newEvent.startDate} to ${newEvent.endDate}`);
      await logService.writeLog({
        action: 'CREATE',
        entity: 'event',
        entityId: newEvent.id,
        entityName: newEvent.employeeName,
        detail: `${newEvent.leaveType} | ${newEvent.startDate} → ${newEvent.endDate}`,
      });
      return newEvent;
    } catch (error) {
      Logger.error('Error creating event:', error);
      throw error;
    }
  }, {
    body: t.Object({
      employeeId: t.Number(),
      leaveType: leaveTypeSchema,
      startDate: t.String(),
      endDate: t.String(),
      description: t.Optional(t.String()),
    }),
  })

  .put('/:id', async ({ params: { id }, body }) => {
    try {
      Logger.debug(`Updating event ${id}: ${JSON.stringify(body)}`);
      const event = await eventService.updateEvent(Number(id), body);
      if (!event) {
        Logger.warn(`Event not found for update with ID: ${id}`);
        throw new Error('Event not found');
      }
      Logger.info(`Updated event ${id}: ${event.employeeName} - ${event.leaveType}`);
      await logService.writeLog({
        action: 'UPDATE',
        entity: 'event',
        entityId: event.id,
        entityName: event.employeeName,
        detail: `${event.leaveType} | ${event.startDate} → ${event.endDate}`,
      });
      return event;
    } catch (error) {
      Logger.error(`Error updating event ${id}:`, error);
      throw error;
    }
  }, {
    params: idParam,
    body: t.Object({
      employeeId: t.Optional(t.Number()),
      leaveType: t.Optional(leaveTypeSchema),
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String()),
      description: t.Optional(t.String()),
    }),
  })

  .delete('/:id', async ({ params: { id } }) => {
    try {
      Logger.debug(`Deleting event with ID: ${id}`);
      const success = await eventService.deleteEvent(Number(id));
      if (!success) {
        Logger.warn(`Event not found for deletion with ID: ${id}`);
        throw new Error('Event not found');
      }
      Logger.info(`Deleted event with ID: ${id}`);
      await logService.writeLog({
        action: 'DELETE',
        entity: 'event',
        entityId: Number(id),
        detail: `Deleted event ID ${id}`,
      });
      return { success: true };
    } catch (error) {
      Logger.error(`Error deleting event ${id}:`, error);
      throw error;
    }
  }, { params: idParam })

  .get('/date/:date', async ({ params: { date } }) => {
    return await eventService.getEventsByDate(date);
  }, { params: t.Object({ date: t.String() }) })

  .get('/date-range/:startDate/:endDate', async ({ params: { startDate, endDate } }) => {
    return await eventService.getEventsByDateRange(startDate, endDate);
  }, { params: t.Object({ startDate: t.String(), endDate: t.String() }) })

  .get('/employee/:employeeId', async ({ params: { employeeId } }) => {
    return await eventService.getEventsByEmployeeId(Number(employeeId));
  }, { params: t.Object({ employeeId: t.String() }) })

  .get('/employee', async ({ query }) => {
    try {
      const { employeeName, startDate, endDate } = query;
      if (!employeeName) throw new Error('Employee name is required');

      const events = await eventService.getEventsByEmployeeName(employeeName as string, startDate as string, endDate as string);
      Logger.debug(`Retrieved ${events.length} events for employee: ${employeeName}`);
      return events;
    } catch (error) {
      Logger.error('Error fetching events by employee name:', error);
      throw error;
    }
  }, {
    query: t.Object({
      employeeName: t.String(),
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String()),
    }),
  })

  .get('/leave-type/:leaveType', async ({ params: { leaveType } }) => {
    return await eventService.getEventsByLeaveType(leaveType);
  }, { params: t.Object({ leaveType: t.String() }) })

  .get('/month/:year/:month', async ({ params: { year, month } }) => {
    return await eventService.getEventsByMonth(Number(year), Number(month));
  }, { params: t.Object({ year: t.String(), month: t.String() }) })

  .get('/search/:query', async ({ params: { query } }) => {
    return await eventService.searchEvents(query);
  }, { params: t.Object({ query: t.String() }) })

  .get('/upcoming/:days?', async ({ params: { days } }) => {
    return await eventService.getUpcomingEvents(days ? Number(days) : 30);
  }, { params: t.Object({ days: t.Optional(t.String()) }) })

  .get('/stats/overview', async () => await eventService.getEventStats())

  .get('/dashboard/summary', async ({ query }) => {
    try {
      const { startDate, endDate, eventType, includeFutureEvents } = query;
      const summary = await eventService.getDashboardSummary(
        startDate as string,
        endDate as string,
        eventType as string,
        includeFutureEvents === 'true',
      );
      return summary;
    } catch (error) {
      Logger.error('Error fetching dashboard summary:', error);
      throw error;
    }
  }, {
    query: t.Object({
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String()),
      eventType: t.Optional(t.String()),
      includeFutureEvents: t.Optional(t.String()),
    }),
  })

  // ── Bulk Delete (password-protected) ─────────────────────────

  .delete('/bulk/month/:year/:month', async ({ params: { year, month }, body }) => {
    try {
      await validateAdminPassword(body.password);
      const result = await eventService.deleteEventsByMonth(Number(year), Number(month));
      Logger.info(`Bulk deleted ${result.deletedCount} events for month ${month}/${year}`);
      await logService.writeLog({ action: 'CLEAR', entity: 'event', detail: `Bulk delete ${result.deletedCount} events for ${month}/${year}` });
      return result;
    } catch (error) {
      Logger.error(`Error bulk deleting events for month ${month}/${year}:`, error);
      throw error;
    }
  }, {
    params: t.Object({ year: t.String(), month: t.String() }),
    body: t.Object({ password: t.String() }),
  })

  .delete('/bulk/year/:year', async ({ params: { year }, body }) => {
    try {
      await validateAdminPassword(body.password);
      const result = await eventService.deleteEventsByYear(Number(year));
      Logger.info(`Bulk deleted ${result.deletedCount} events for year ${year}`);
      await logService.writeLog({ action: 'CLEAR', entity: 'event', detail: `Bulk delete ${result.deletedCount} events for year ${year}` });
      return result;
    } catch (error) {
      Logger.error(`Error bulk deleting events for year ${year}:`, error);
      throw error;
    }
  }, {
    params: t.Object({ year: t.String() }),
    body: t.Object({ password: t.String() }),
  })

  .delete('/bulk/all', async ({ body }) => {
    try {
      await validateAdminPassword(body.password);
      const result = await eventService.deleteAllEvents();
      Logger.info(`Bulk deleted ${result.deletedCount} events`);
      await logService.writeLog({ action: 'CLEAR', entity: 'event', detail: `Bulk delete ALL events (${result.deletedCount} entries)` });
      return result;
    } catch (error) {
      Logger.error('Error bulk deleting all events:', error);
      throw error;
    }
  }, { body: t.Object({ password: t.String() }) })

  // ── Manual merge trigger ─────────────────────────────────────

  .post('/merge-consecutive', async () => {
    try {
      Logger.info('[EventMerge] Manual merge job triggered via API');
      await eventMergeService.executeMergeJob();
      return { success: true, message: 'Event merge job completed successfully' };
    } catch (error) {
      Logger.error('[EventMerge] Error during manual merge job:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });