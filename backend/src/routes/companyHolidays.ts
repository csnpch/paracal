import { Elysia, t } from 'elysia';
import { CompanyHolidayService } from '../services/companyHolidayService';
import Logger from '../utils/logger';

const companyHolidayService = new CompanyHolidayService();

export const companyHolidaysRoutes = new Elysia({ prefix: '/company-holidays' })
  .get('/', () => {
    return companyHolidayService.getAllCompanyHolidays();
  })

  .get('/:year', ({ params: { year } }) => {
    return companyHolidayService.getCompanyHolidaysByYear(Number(year));
  }, { params: t.Object({ year: t.String() }) })

  .get('/holiday/:id', ({ params: { id } }) => {
    const holiday = companyHolidayService.getCompanyHolidayById(Number(id));
    if (!holiday) throw new Error('Company holiday not found');
    return holiday;
  }, { params: t.Object({ id: t.String() }) })

  .post('/', ({ body }) => {
    Logger.info(`Creating company holiday: ${body.name} on ${body.date}`);
    return companyHolidayService.createCompanyHoliday(body);
  }, {
    body: t.Object({
      name: t.String(),
      date: t.String(),
      description: t.Optional(t.String()),
    }),
  })

  .post('/bulk', ({ body }) => {
    Logger.info(`Creating ${body.holidays.length} company holidays`);
    return companyHolidayService.createMultipleCompanyHolidays(body.holidays);
  }, {
    body: t.Object({
      holidays: t.Array(t.Object({
        name: t.String(),
        date: t.String(),
        description: t.Optional(t.String()),
      })),
    }),
  })

  .put('/:id', ({ params: { id }, body }) => {
    const holiday = companyHolidayService.updateCompanyHoliday(Number(id), body);
    if (!holiday) throw new Error('Company holiday not found');
    Logger.info(`Updated company holiday ${id}`);
    return holiday;
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      name: t.Optional(t.String()),
      date: t.Optional(t.String()),
      description: t.Optional(t.String()),
    }),
  })

  .delete('/clear-all', () => {
    Logger.info('Clearing all company holidays');
    return companyHolidayService.deleteAllCompanyHolidays();
  })

  .delete('/:id', ({ params: { id } }) => {
    const success = companyHolidayService.deleteCompanyHoliday(Number(id));
    if (!success) throw new Error('Company holiday not found');
    Logger.info(`Deleted company holiday ${id}`);
    return { success: true };
  }, { params: t.Object({ id: t.String() }) })

  .get('/range/:startDate/:endDate', ({ params: { startDate, endDate } }) => {
    return companyHolidayService.getCompanyHolidaysForDateRange(startDate, endDate);
  }, { params: t.Object({ startDate: t.String(), endDate: t.String() }) })

  .get('/check/:date', ({ params: { date } }) => {
    return { date, isHoliday: companyHolidayService.isCompanyHoliday(date) };
  }, { params: t.Object({ date: t.String() }) });