import { Elysia, t } from 'elysia';
import { EventService } from '../services/eventService';
import { EventMergeService } from '../services/eventMergeService';
import config from '../config';
import { getDatabase } from '../database/connection';
import bcrypt from 'bcryptjs';
import Logger from '../utils/logger';

const eventService = new EventService();
const eventMergeService = new EventMergeService();

// ── Shared schema fragments ──────────────────────────────────

const leaveTypeSchema = t.Union([
  t.Literal('vacation'),
  t.Literal('personal'),
  t.Literal('sick'),
  t.Literal('absent'),
  t.Literal('maternity'),
  t.Literal('bereavement'),
  t.Literal('study'),
  t.Literal('military'),
  t.Literal('sabbatical'),
  t.Literal('unpaid'),
  t.Literal('compensatory'),
  t.Literal('other'),
]);

const idParam = t.Object({ id: t.String() });

// ── Helpers ──────────────────────────────────────────────────

function validateAdminPassword(pin: string | undefined): void {
  if (!pin) {
    throw new Error('Invalid PIN');
  }
  const db = getDatabase();
  const adminConfig = db.prepare("SELECT pin FROM admin_config ORDER BY id DESC LIMIT 1").get() as { pin: string } | undefined;
  
  if (!adminConfig) {
    throw new Error('Admin config not found');
  }

  const isValid = bcrypt.compareSync(pin, adminConfig.pin);
  if (!isValid) {
    throw new Error('Invalid PIN');
  }
}

// ── Routes ───────────────────────────────────────────────────

export const eventsRoutes = new Elysia({ prefix: '/events' })
  .get('/', () => {
    try {
      Logger.debug('Fetching all events');
      const events = eventService.getAllEvents();
      Logger.debug(`Retrieved ${events.length} events`);
      return events;
    } catch (error) {
      Logger.error('Error fetching all events:', error);
      throw error;
    }
  })

  .get('/:id', ({ params: { id } }) => {
    try {
      Logger.debug(`Fetching event with ID: ${id}`);
      const event = eventService.getEventById(Number(id));
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

  .post('/', ({ body }) => {
    try {
      Logger.debug(`Creating new event: ${JSON.stringify(body)}`);
      const newEvent = eventService.createEvent(body);
      Logger.info(`Created event: ${newEvent.employeeName} - ${newEvent.leaveType} from ${newEvent.startDate} to ${newEvent.endDate}`);
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

  .put('/:id', ({ params: { id }, body }) => {
    try {
      Logger.debug(`Updating event ${id}: ${JSON.stringify(body)}`);
      const event = eventService.updateEvent(Number(id), body);
      if (!event) {
        Logger.warn(`Event not found for update with ID: ${id}`);
        throw new Error('Event not found');
      }
      Logger.info(`Updated event ${id}: ${event.employeeName} - ${event.leaveType}`);
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

  .delete('/:id', ({ params: { id } }) => {
    try {
      Logger.debug(`Deleting event with ID: ${id}`);
      const success = eventService.deleteEvent(Number(id));
      if (!success) {
        Logger.warn(`Event not found for deletion with ID: ${id}`);
        throw new Error('Event not found');
      }
      Logger.info(`Deleted event with ID: ${id}`);
      return { success: true };
    } catch (error) {
      Logger.error(`Error deleting event ${id}:`, error);
      throw error;
    }
  }, { params: idParam })

  .get('/date/:date', ({ params: { date } }) => {
    return eventService.getEventsByDate(date);
  }, { params: t.Object({ date: t.String() }) })

  .get('/date-range/:startDate/:endDate', ({ params: { startDate, endDate } }) => {
    return eventService.getEventsByDateRange(startDate, endDate);
  }, { params: t.Object({ startDate: t.String(), endDate: t.String() }) })

  .get('/employee/:employeeId', ({ params: { employeeId } }) => {
    return eventService.getEventsByEmployeeId(Number(employeeId));
  }, { params: t.Object({ employeeId: t.String() }) })

  .get('/employee', ({ query }) => {
    try {
      const { employeeName, startDate, endDate } = query;
      if (!employeeName) throw new Error('Employee name is required');

      const events = eventService.getEventsByEmployeeName(employeeName as string, startDate as string, endDate as string);
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

  .get('/leave-type/:leaveType', ({ params: { leaveType } }) => {
    return eventService.getEventsByLeaveType(leaveType);
  }, { params: t.Object({ leaveType: t.String() }) })

  .get('/month/:year/:month', ({ params: { year, month } }) => {
    return eventService.getEventsByMonth(Number(year), Number(month));
  }, { params: t.Object({ year: t.String(), month: t.String() }) })

  .get('/search/:query', ({ params: { query } }) => {
    return eventService.searchEvents(query);
  }, { params: t.Object({ query: t.String() }) })

  .get('/upcoming/:days?', ({ params: { days } }) => {
    return eventService.getUpcomingEvents(days ? Number(days) : 30);
  }, { params: t.Object({ days: t.Optional(t.String()) }) })

  .get('/stats/overview', () => eventService.getEventStats())

  .get('/dashboard/summary', ({ query }) => {
    try {
      const { startDate, endDate, eventType, includeFutureEvents } = query;
      const summary = eventService.getDashboardSummary(
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

  .delete('/bulk/month/:year/:month', ({ params: { year, month }, body }) => {
    try {
      validateAdminPassword(body.password);
      const result = eventService.deleteEventsByMonth(Number(year), Number(month));
      Logger.info(`Bulk deleted ${result.deletedCount} events for month ${month}/${year}`);
      return result;
    } catch (error) {
      Logger.error(`Error bulk deleting events for month ${month}/${year}:`, error);
      throw error;
    }
  }, {
    params: t.Object({ year: t.String(), month: t.String() }),
    body: t.Object({ password: t.String() }),
  })

  .delete('/bulk/year/:year', ({ params: { year }, body }) => {
    try {
      validateAdminPassword(body.password);
      const result = eventService.deleteEventsByYear(Number(year));
      Logger.info(`Bulk deleted ${result.deletedCount} events for year ${year}`);
      return result;
    } catch (error) {
      Logger.error(`Error bulk deleting events for year ${year}:`, error);
      throw error;
    }
  }, {
    params: t.Object({ year: t.String() }),
    body: t.Object({ password: t.String() }),
  })

  .delete('/bulk/all', ({ body }) => {
    try {
      validateAdminPassword(body.password);
      const result = eventService.deleteAllEvents();
      Logger.info(`Bulk deleted ${result.deletedCount} events`);
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