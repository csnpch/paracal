import { Elysia, t } from 'elysia';
import { CompanyHolidayService } from '../services/companyHolidayService';
import { logService } from '../services/logService';
import Logger from '../utils/logger';

const companyHolidayService = new CompanyHolidayService();

export const companyHolidaysRoutes = new Elysia({ prefix: '/company-holidays' })
  .get('/', async () => {
    return await companyHolidayService.getAllCompanyHolidays();
  })

  .get('/:year', async ({ params: { year } }) => {
    return await companyHolidayService.getCompanyHolidaysByYear(Number(year));
  }, { params: t.Object({ year: t.String() }) })

  .get('/holiday/:id', async ({ params: { id } }) => {
    const holiday = await companyHolidayService.getCompanyHolidayById(Number(id));
    if (!holiday) throw new Error('Company holiday not found');
    return holiday;
  }, { params: t.Object({ id: t.String() }) })

  .post('/', async ({ body }) => {
    Logger.info(`Creating company holiday: ${body.name} on ${body.date}`);
    const holiday = await companyHolidayService.createCompanyHoliday(body);
    await logService.writeLog({
      action: 'CREATE',
      entity: 'company_holiday',
      entityId: holiday.id,
      entityName: holiday.name,
      detail: `${holiday.name} on ${holiday.date}`,
    });
    return holiday;
  }, {
    body: t.Object({
      name: t.String(),
      date: t.String(),
      description: t.Optional(t.String()),
    }),
  })

  .post('/bulk', async ({ body }) => {
    Logger.info(`Creating ${body.holidays.length} company holidays`);
    return await companyHolidayService.createMultipleCompanyHolidays(body.holidays);
  }, {
    body: t.Object({
      holidays: t.Array(t.Object({
        name: t.String(),
        date: t.String(),
        description: t.Optional(t.String()),
      })),
    }),
  })

  .put('/:id', async ({ params: { id }, body }) => {
    const holiday = await companyHolidayService.updateCompanyHoliday(Number(id), body);
    if (!holiday) throw new Error('Company holiday not found');
    Logger.info(`Updated company holiday ${id}`);
    await logService.writeLog({
      action: 'UPDATE',
      entity: 'company_holiday',
      entityId: holiday.id,
      entityName: holiday.name,
      detail: `Updated to ${holiday.name} on ${holiday.date}`,
    });
    return holiday;
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      date: t.Optional(t.String()),
      description: t.Optional(t.String()),
    }),
  })

  .delete('/clear-all', async () => {
    Logger.info('Clearing all company holidays');
    const result = await companyHolidayService.deleteAllCompanyHolidays();
    await logService.writeLog({ action: 'CLEAR', entity: 'company_holiday', detail: 'Cleared all company holidays' });
    return result;
  })

  .delete('/:id', async ({ params: { id } }) => {
    const success = await companyHolidayService.deleteCompanyHoliday(Number(id));
    if (!success) throw new Error('Company holiday not found');
    Logger.info(`Deleted company holiday ${id}`);
    await logService.writeLog({
      action: 'DELETE',
      entity: 'company_holiday',
      entityId: Number(id),
      detail: `Deleted company holiday ID ${id}`,
    });
    return { success: true };
  }, { params: t.Object({ id: t.String() }) })

  .get('/range/:startDate/:endDate', async ({ params: { startDate, endDate } }) => {
    return await companyHolidayService.getCompanyHolidaysForDateRange(startDate, endDate);
  }, { params: t.Object({ startDate: t.String(), endDate: t.String() }) })

  .get('/check/:date', async ({ params: { date } }) => {
    return { date, isHoliday: await companyHolidayService.isCompanyHoliday(date) };
  }, { params: t.Object({ date: t.String() }) });