import { getPrisma } from '../database/connection';
import type { Event, CreateEventRequest, UpdateEventRequest } from '../types';
import moment from 'moment';

export class EventService {
  private get prisma() { return getPrisma(); }

  // ── Helpers ──────────────────────────────────────────────────

  private getNow(): Date {
    return moment().utcOffset('+07:00').toDate();
  }

  private getToday(): string {
    return moment().utcOffset('+07:00').format('YYYY-MM-DD');
  }

  private async lookupEmployee(employeeId: number): Promise<{ name: string }> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { name: true },
    });
    if (!employee) throw new Error(`Employee with id ${employeeId} not found`);
    return employee;
  }

  private computeLegacyDate(startDate: string, endDate: string): string | null {
    return startDate === endDate ? startDate : null;
  }

  private mapEvent(row: any): Event {
    return {
      id: row.id,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      leaveType: row.leaveType as Event['leaveType'],
      leaveDuration: row.leaveDuration as Event['leaveDuration'],
      date: row.date ?? undefined,
      startDate: row.startDate,
      endDate: row.endDate,
      description: row.description ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }

  // ── CRUD ─────────────────────────────────────────────────────

  async createEvent(data: CreateEventRequest): Promise<Event> {
    const now = this.getNow();
    const employee = await this.lookupEmployee(data.employeeId);
    const legacyDate = this.computeLegacyDate(data.startDate, data.endDate);

    const event = await this.prisma.event.create({
      data: {
        employeeId: data.employeeId,
        employeeName: employee.name,
        leaveType: data.leaveType,
        leaveDuration: data.leaveDuration || 'full',
        startDate: data.startDate,
        endDate: data.endDate,
        date: legacyDate,
        description: data.description || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    return this.mapEvent(event);
  }

  async getAllEvents(): Promise<Event[]> {
    const events = await this.prisma.event.findMany({ orderBy: { startDate: 'desc' } });
    return events.map(this.mapEvent);
  }

  async getEventById(id: number): Promise<Event | null> {
    const event = await this.prisma.event.findUnique({ where: { id } });
    return event ? this.mapEvent(event) : null;
  }

  async getEventsByDate(date: string): Promise<Event[]> {
    const events = await this.prisma.event.findMany({
      where: {
        OR: [
          { date },
          { AND: [{ startDate: { lte: date } }, { endDate: { gte: date } }] },
        ],
      },
      orderBy: { employeeName: 'asc' },
    });
    return events.map(this.mapEvent);
  }

  async getEventsByDateRange(startDate: string, endDate: string): Promise<Event[]> {
    const events = await this.prisma.event.findMany({
      where: {
        OR: [
          { AND: [{ date: { gte: startDate } }, { date: { lte: endDate } }] },
          { AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }] },
        ],
      },
      orderBy: [{ startDate: 'asc' }, { employeeName: 'asc' }],
    });
    return events.map(this.mapEvent);
  }

  async getEventsByEmployeeId(employeeId: number): Promise<Event[]> {
    const events = await this.prisma.event.findMany({
      where: { employeeId },
      orderBy: { startDate: 'desc' },
    });
    return events.map(this.mapEvent);
  }

  async getEventsByEmployeeName(employeeName: string, startDate?: string, endDate?: string): Promise<Event[]> {
    const where: any = { employeeName };

    if (startDate && endDate) {
      where.OR = [
        { AND: [{ date: { gte: startDate } }, { date: { lte: endDate } }] },
        { AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }] },
      ];
    }

    const events = await this.prisma.event.findMany({
      where,
      orderBy: { startDate: 'desc' },
    });
    return events.map(this.mapEvent);
  }

  async getEventsByLeaveType(leaveType: string): Promise<Event[]> {
    const events = await this.prisma.event.findMany({
      where: { leaveType },
      orderBy: { startDate: 'desc' },
    });
    return events.map(this.mapEvent);
  }

  async getEventsByMonth(year: number, month: number): Promise<Event[]> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = moment().year(year).month(month - 1).endOf('month').format('YYYY-MM-DD');
    return this.getEventsByDateRange(startDate, endDate);
  }

  async updateEvent(id: number, data: UpdateEventRequest): Promise<Event | null> {
    const existing = await this.getEventById(id);
    if (!existing) return null;

    const now = this.getNow();
    const newEmployeeId = data.employeeId ?? existing.employeeId;
    const employee = await this.lookupEmployee(newEmployeeId);

    const newStartDate = data.startDate ?? existing.startDate;
    const newEndDate = data.endDate ?? existing.endDate;
    const legacyDate = this.computeLegacyDate(newStartDate, newEndDate) || existing.date;

    const event = await this.prisma.event.update({
      where: { id },
      data: {
        employeeId: newEmployeeId,
        employeeName: employee.name,
        leaveType: data.leaveType ?? existing.leaveType,
        leaveDuration: data.leaveDuration ?? existing.leaveDuration,
        startDate: newStartDate,
        endDate: newEndDate,
        date: legacyDate || null,
        description: data.description ?? existing.description ?? null,
        updatedAt: now,
      },
    });

    return this.mapEvent(event);
  }

  async deleteEvent(id: number): Promise<boolean> {
    try {
      await this.prisma.event.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteEventsByEmployeeId(employeeId: number): Promise<number> {
    const result = await this.prisma.event.deleteMany({ where: { employeeId } });
    return result.count;
  }

  // ── Search & Upcoming ────────────────────────────────────────

  async searchEvents(query: string): Promise<Event[]> {
    const events = await this.prisma.event.findMany({
      where: {
        OR: [
          { employeeName: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { startDate: 'desc' },
    });
    return events.map(this.mapEvent);
  }

  async getUpcomingEvents(days: number = 30): Promise<Event[]> {
    const today = this.getToday();
    const endDate = moment().utcOffset('+07:00').add(days, 'days').format('YYYY-MM-DD');
    return this.getEventsByDateRange(today, endDate);
  }

  // ── Stats ────────────────────────────────────────────────────

  async getEventStats() {
    const total = await this.prisma.event.count();

    const byLeaveTypeRaw = await this.prisma.event.groupBy({
      by: ['leaveType'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });
    const byLeaveType = byLeaveTypeRaw.map((r) => ({ leave_type: r.leaveType, count: r._count.id }));

    // For byMonth, we need raw query since Prisma doesn't support substr groupBy
    const byMonth = await this.prisma.$queryRawUnsafe<Array<{ month: string; count: bigint }>>(
      `SELECT substring(date, 1, 7) as month, COUNT(*) as count FROM events WHERE date IS NOT NULL GROUP BY substring(date, 1, 7) ORDER BY month DESC LIMIT 12`
    );
    const byMonthFormatted = byMonth.map((r) => ({ month: r.month, count: Number(r.count) }));

    return { total, byLeaveType, byMonth: byMonthFormatted };
  }

  // ── Bulk Delete ──────────────────────────────────────────────

  private async deleteEventsInRange(startDate: string, endDate: string): Promise<{ deletedCount: number }> {
    const result = await this.prisma.event.deleteMany({
      where: {
        OR: [
          { AND: [{ startDate: { gte: startDate } }, { startDate: { lte: endDate } }] },
          { AND: [{ endDate: { gte: startDate } }, { endDate: { lte: endDate } }] },
          { AND: [{ startDate: { lte: startDate } }, { endDate: { gte: endDate } }] },
        ],
      },
    });
    return { deletedCount: result.count };
  }

  async deleteEventsByMonth(year: number, month: number): Promise<{ deletedCount: number }> {
    const startDate = moment().year(year).month(month - 1).startOf('month').format('YYYY-MM-DD');
    const endDate = moment().year(year).month(month - 1).endOf('month').format('YYYY-MM-DD');
    return this.deleteEventsInRange(startDate, endDate);
  }

  async deleteEventsByYear(year: number): Promise<{ deletedCount: number }> {
    const startDate = moment().year(year).startOf('year').format('YYYY-MM-DD');
    const endDate = moment().year(year).endOf('year').format('YYYY-MM-DD');
    return this.deleteEventsInRange(startDate, endDate);
  }

  async deleteAllEvents(): Promise<{ deletedCount: number }> {
    const result = await this.prisma.event.deleteMany();
    return { deletedCount: result.count };
  }

  // ── Dashboard ────────────────────────────────────────────────

  calculateBusinessDays(startDate: string, endDate: string, companyHolidayDates: string[]): number {
    let businessDays = 0;
    const current = moment(startDate);
    const end = moment(endDate);

    while (current.isSameOrBefore(end)) {
      const dayOfWeek = current.day();
      const dateStr = current.format('YYYY-MM-DD');
      const isWeekday = dayOfWeek !== 0 && dayOfWeek !== 6;
      const isCompanyHoliday = companyHolidayDates.includes(dateStr);

      if (isWeekday && !isCompanyHoliday) businessDays++;
      current.add(1, 'day');
    }

    return businessDays;
  }

  async getDashboardSummary(startDate?: string, endDate?: string, eventType?: string, includeFutureEvents?: boolean) {
    // Build where clause for Prisma
    const andConditions: any[] = [];

    if (startDate && endDate) {
      andConditions.push({
        OR: [
          { AND: [{ date: { gte: startDate } }, { date: { lte: endDate } }] },
          { AND: [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }] },
        ],
      });
    }

    if (!includeFutureEvents) {
      const today = moment().format('YYYY-MM-DD');
      andConditions.push({
        OR: [
          { startDate: { lte: today } },
          { AND: [{ startDate: null }, { date: { lte: today } }] },
        ],
      });
    }

    if (eventType && eventType !== 'all') {
      andConditions.push({ leaveType: eventType });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const totalEvents = await this.prisma.event.count({ where });
    const distinctEmployees = await this.prisma.event.findMany({
      where,
      select: { employeeId: true },
      distinct: ['employeeId'],
    });
    const totalEmployees = distinctEmployees.length;

    // Most common leave type
    const mostCommonRaw = await this.prisma.event.groupBy({
      by: ['leaveType'],
      where,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 1,
    });
    const mostCommonType = mostCommonRaw.length > 0 ? mostCommonRaw[0]!.leaveType : 'N/A';

    // Company holidays for business day calculation
    const holidays = await this.prisma.companyHoliday.findMany({
      where: {
        date: { gte: startDate || '1900-01-01', lte: endDate || '2100-12-31' },
      },
      select: { date: true },
    });
    const companyHolidayDates = holidays.map((h) => h.date);

    // Employee ranking
    const rankingRaw = await this.prisma.event.groupBy({
      by: ['employeeId', 'employeeName', 'leaveType'],
      where,
      _count: { id: true },
      orderBy: { employeeName: 'asc' },
    });

    // All events for biz days
    const allEvents = await this.prisma.event.findMany({
      where,
      select: { id: true, employeeId: true, startDate: true, endDate: true, date: true },
    });

    // Calculate total business days
    let totalBusinessDays = 0;
    allEvents.forEach((event) => {
      const evStart = event.startDate || event.date;
      const evEnd = event.endDate || event.date;
      if (evStart && evEnd) totalBusinessDays += this.calculateBusinessDays(evStart, evEnd, companyHolidayDates);
    });

    // Build employee map
    const employeeMap = new Map<number, { name: string; totalEvents: number; totalBusinessDays: number; eventTypes: Record<string, number> }>();
    rankingRaw.forEach((row) => {
      if (!employeeMap.has(row.employeeId)) {
        employeeMap.set(row.employeeId, { name: row.employeeName || 'ไม่ทราบชื่อ', totalEvents: 0, totalBusinessDays: 0, eventTypes: {} });
      }
      const emp = employeeMap.get(row.employeeId)!;
      emp.totalEvents += row._count.id;
      emp.eventTypes[row.leaveType] = row._count.id;
    });

    allEvents.forEach((event) => {
      const emp = employeeMap.get(event.employeeId);
      if (emp) {
        const evStart = event.startDate || event.date;
        const evEnd = event.endDate || event.date;
        if (evStart && evEnd) emp.totalBusinessDays += this.calculateBusinessDays(evStart, evEnd, companyHolidayDates);
      }
    });

    const employeeRanking = Array.from(employeeMap.values()).sort((a, b) => b.totalEvents - a.totalEvents);

    return {
      monthlyStats: { totalEvents, totalEmployees, totalBusinessDays, mostCommonType },
      employeeRanking,
    };
  }
}
