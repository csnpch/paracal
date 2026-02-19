import { getDatabase } from '../database/connection';
import type { Event, CreateEventRequest, UpdateEventRequest } from '../types';
import moment from 'moment';

// ── Shared SQL fragment for all event queries ────────────────
const EVENT_COLUMNS = `
  e.id,
  e.employee_id as employeeId,
  e.employee_name as employeeName,
  e.leave_type as leaveType,
  e.date,
  e.start_date as startDate,
  e.end_date as endDate,
  e.description,
  e.created_at as createdAt,
  e.updated_at as updatedAt
`;

export class EventService {
  private db = getDatabase();

  // ── Helpers ──────────────────────────────────────────────────

  private getNow(): string {
    return moment().utcOffset('+07:00').format();
  }

  private getToday(): string {
    return moment().utcOffset('+07:00').format('YYYY-MM-DD');
  }

  private lookupEmployee(employeeId: number): { name: string } {
    const stmt = this.db.prepare('SELECT name FROM employees WHERE id = ?');
    const employee = stmt.get(employeeId) as { name: string } | undefined;
    if (!employee) {
      throw new Error(`Employee with id ${employeeId} not found`);
    }
    return employee;
  }

  private computeLegacyDate(startDate: string, endDate: string): string | null {
    return startDate === endDate ? startDate : null;
  }

  // ── CRUD ─────────────────────────────────────────────────────

  createEvent(data: CreateEventRequest): Event {
    const now = this.getNow();
    const employee = this.lookupEmployee(data.employeeId);

    const stmt = this.db.prepare(`
      INSERT INTO events (employee_id, employee_name, leave_type, start_date, end_date, date, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const legacyDate = this.computeLegacyDate(data.startDate, data.endDate);

    stmt.run(
      data.employeeId,
      employee.name,
      data.leaveType,
      data.startDate,
      data.endDate,
      legacyDate,
      data.description || null,
      now,
      now,
    );

    const result = this.db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };

    return {
      id: result.id,
      employeeId: data.employeeId,
      employeeName: employee.name,
      leaveType: data.leaveType,
      date: legacyDate ?? undefined,
      startDate: data.startDate,
      endDate: data.endDate,
      description: data.description,
      createdAt: now,
      updatedAt: now,
    };
  }

  getAllEvents(): Event[] {
    const stmt = this.db.prepare(`
      SELECT ${EVENT_COLUMNS}
      FROM events e
      ORDER BY e.start_date DESC
    `);
    return stmt.all() as Event[];
  }

  getEventById(id: number): Event | null {
    const stmt = this.db.prepare(`
      SELECT ${EVENT_COLUMNS}
      FROM events e
      WHERE e.id = ?
    `);
    return (stmt.get(id) as Event | undefined) || null;
  }

  getEventsByDate(date: string): Event[] {
    const stmt = this.db.prepare(`
      SELECT ${EVENT_COLUMNS}
      FROM events e
      WHERE (e.date = ? OR (? >= e.start_date AND ? <= e.end_date))
      ORDER BY e.employee_name ASC
    `);
    return stmt.all(date, date, date) as Event[];
  }

  getEventsByDateRange(startDate: string, endDate: string): Event[] {
    const stmt = this.db.prepare(`
      SELECT ${EVENT_COLUMNS}
      FROM events e
      WHERE (e.date >= ? AND e.date <= ?) OR (e.start_date <= ? AND e.end_date >= ?)
      ORDER BY COALESCE(e.start_date, e.date) ASC, e.employee_name ASC
    `);
    return stmt.all(startDate, endDate, endDate, startDate) as Event[];
  }

  getEventsByEmployeeId(employeeId: number): Event[] {
    const stmt = this.db.prepare(`
      SELECT ${EVENT_COLUMNS}
      FROM events e
      WHERE e.employee_id = ?
      ORDER BY COALESCE(e.start_date, e.date) DESC
    `);
    return stmt.all(employeeId) as Event[];
  }

  getEventsByEmployeeName(employeeName: string, startDate?: string, endDate?: string): Event[] {
    let query = `
      SELECT ${EVENT_COLUMNS}
      FROM events e
      WHERE e.employee_name = ?
    `;
    const params: any[] = [employeeName];

    if (startDate && endDate) {
      query += ' AND ((e.date >= ? AND e.date <= ?) OR (e.start_date <= ? AND e.end_date >= ?))';
      params.push(startDate, endDate, endDate, startDate);
    }

    query += ' ORDER BY COALESCE(e.start_date, e.date) DESC';

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as Event[];
  }

  getEventsByLeaveType(leaveType: string): Event[] {
    const stmt = this.db.prepare(`
      SELECT ${EVENT_COLUMNS}
      FROM events e
      WHERE e.leave_type = ?
      ORDER BY COALESCE(e.start_date, e.date) DESC
    `);
    return stmt.all(leaveType) as Event[];
  }

  getEventsByMonth(year: number, month: number): Event[] {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = moment().year(year).month(month - 1).endOf('month').format('YYYY-MM-DD');
    return this.getEventsByDateRange(startDate, endDate);
  }

  updateEvent(id: number, data: UpdateEventRequest): Event | null {
    const existing = this.getEventById(id);
    if (!existing) return null;

    const now = this.getNow();
    const newEmployeeId = data.employeeId ?? existing.employeeId;
    const employee = this.lookupEmployee(newEmployeeId);

    const newStartDate = data.startDate ?? existing.startDate;
    const newEndDate = data.endDate ?? existing.endDate;
    const legacyDate = this.computeLegacyDate(newStartDate, newEndDate) || existing.date;

    const stmt = this.db.prepare(`
      UPDATE events
      SET employee_id = ?, employee_name = ?, leave_type = ?,
          start_date = ?, end_date = ?, date = ?, description = ?, updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(
      newEmployeeId,
      employee.name,
      data.leaveType ?? existing.leaveType,
      newStartDate,
      newEndDate,
      legacyDate || null,
      data.description ?? existing.description ?? null,
      now,
      id,
    );

    if (result.changes === 0) return null;
    return this.getEventById(id);
  }

  deleteEvent(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM events WHERE id = ?');
    return stmt.run(id).changes > 0;
  }

  deleteEventsByEmployeeId(employeeId: number): number {
    const stmt = this.db.prepare('DELETE FROM events WHERE employee_id = ?');
    return stmt.run(employeeId).changes;
  }

  // ── Search & Upcoming ────────────────────────────────────────

  searchEvents(query: string): Event[] {
    const stmt = this.db.prepare(`
      SELECT ${EVENT_COLUMNS}
      FROM events e
      WHERE e.employee_name LIKE ? OR e.description LIKE ?
      ORDER BY COALESCE(e.start_date, e.date) DESC
    `);
    const term = `%${query}%`;
    return stmt.all(term, term) as Event[];
  }

  getUpcomingEvents(days: number = 30): Event[] {
    const today = this.getToday();
    const endDate = moment().utcOffset('+07:00').add(days, 'days').format('YYYY-MM-DD');
    return this.getEventsByDateRange(today, endDate);
  }

  // ── Stats ────────────────────────────────────────────────────

  getEventStats() {
    const total = (this.db.prepare('SELECT COUNT(*) as total FROM events').get() as { total: number }).total;

    const byLeaveType = this.db.prepare(`
      SELECT leave_type, COUNT(*) as count FROM events GROUP BY leave_type ORDER BY count DESC
    `).all() as Array<{ leave_type: string; count: number }>;

    const byMonth = this.db.prepare(`
      SELECT substr(date, 1, 7) as month, COUNT(*) as count
      FROM events GROUP BY substr(date, 1, 7) ORDER BY month DESC LIMIT 12
    `).all() as Array<{ month: string; count: number }>;

    return { total, byLeaveType, byMonth };
  }

  // ── Bulk Delete ──────────────────────────────────────────────

  /**
   * Shared delete logic for events overlapping a date range.
   */
  private deleteEventsInRange(startDate: string, endDate: string): { deletedCount: number } {
    const stmt = this.db.prepare(`
      DELETE FROM events
      WHERE start_date >= ? AND start_date <= ?
         OR end_date >= ? AND end_date <= ?
         OR (start_date <= ? AND end_date >= ?)
    `);
    const result = stmt.run(startDate, endDate, startDate, endDate, startDate, endDate);
    return { deletedCount: result.changes };
  }

  deleteEventsByMonth(year: number, month: number): { deletedCount: number } {
    const startDate = moment().year(year).month(month - 1).startOf('month').format('YYYY-MM-DD');
    const endDate = moment().year(year).month(month - 1).endOf('month').format('YYYY-MM-DD');
    return this.deleteEventsInRange(startDate, endDate);
  }

  deleteEventsByYear(year: number): { deletedCount: number } {
    const startDate = moment().year(year).startOf('year').format('YYYY-MM-DD');
    const endDate = moment().year(year).endOf('year').format('YYYY-MM-DD');
    return this.deleteEventsInRange(startDate, endDate);
  }

  deleteAllEvents(): { deletedCount: number } {
    const result = this.db.prepare('DELETE FROM events').run();
    return { deletedCount: result.changes };
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

  getDashboardSummary(startDate?: string, endDate?: string, eventType?: string, includeFutureEvents?: boolean) {
    let whereClause = '';
    let joinWhereClause = '';
    const baseParams: any[] = [];
    const joinParams: any[] = [];

    if (startDate && endDate) {
      whereClause = 'WHERE ((date >= ? AND date <= ?) OR (start_date <= ? AND end_date >= ?))';
      joinWhereClause = 'WHERE ((e.date >= ? AND e.date <= ?) OR (e.start_date <= ? AND e.end_date >= ?))';
      baseParams.push(startDate, endDate, endDate, startDate);
      joinParams.push(startDate, endDate, endDate, startDate);
    }

    if (!includeFutureEvents) {
      const today = moment().format('YYYY-MM-DD');
      const prefix = whereClause ? ' AND' : 'WHERE';
      whereClause += `${prefix} (COALESCE(start_date, date) <= ?)`;
      joinWhereClause += `${prefix.replace('AND', ' AND').replace('WHERE', 'WHERE')} (COALESCE(e.start_date, e.date) <= ?)`;
      // Fix: handle prefix for join clause properly
      if (!joinWhereClause.startsWith('WHERE')) {
        joinWhereClause = `WHERE (COALESCE(e.start_date, e.date) <= ?)`;
      }
      baseParams.push(today);
      joinParams.push(today);
    }

    if (eventType && eventType !== 'all') {
      const prefix = whereClause ? ' AND' : 'WHERE';
      whereClause += `${prefix} leave_type = ?`;
      const jPrefix = joinWhereClause ? ' AND' : 'WHERE';
      joinWhereClause += `${jPrefix} e.leave_type = ?`;
      baseParams.push(eventType);
      joinParams.push(eventType);
    }

    const { totalEvents } = this.db.prepare(`SELECT COUNT(*) as totalEvents FROM events ${whereClause}`).get(...baseParams) as { totalEvents: number };
    const { totalEmployees } = this.db.prepare(`SELECT COUNT(DISTINCT employee_id) as totalEmployees FROM events ${whereClause}`).get(...baseParams) as { totalEmployees: number };

    const mostCommonResult = this.db.prepare(`
      SELECT leave_type, COUNT(*) as count FROM events ${whereClause} GROUP BY leave_type ORDER BY count DESC LIMIT 1
    `).get(...baseParams) as { leave_type: string; count: number } | undefined;
    const mostCommonType = mostCommonResult?.leave_type || 'N/A';

    // Company holidays for business day calculation
    const holidays = this.db.prepare(`SELECT date FROM company_holidays WHERE date >= ? AND date <= ?`).all(
      startDate || '1900-01-01',
      endDate || '2100-12-31',
    ) as Array<{ date: string }>;
    const companyHolidayDates = holidays.map((h) => h.date);

    // Employee ranking
    const rankingData = this.db.prepare(`
      SELECT e.employee_id as employeeId, COALESCE(e.employee_name, emp.name) as employeeName,
             e.leave_type as leaveType, COUNT(*) as count
      FROM events e LEFT JOIN employees emp ON e.employee_id = emp.id
      ${joinWhereClause}
      GROUP BY e.employee_id, COALESCE(e.employee_name, emp.name), e.leave_type
      ORDER BY COALESCE(e.employee_name, emp.name) ASC
    `).all(...joinParams) as Array<{ employeeId: number; employeeName: string; leaveType: string; count: number }>;

    // All events for biz days
    const allEvents = this.db.prepare(`
      SELECT id, employee_id as employeeId, start_date as startDate, end_date as endDate, date
      FROM events ${whereClause}
    `).all(...baseParams) as Array<{ id: number; employeeId: number; startDate: string | null; endDate: string | null; date: string | null }>;

    // Calculate total business days
    let totalBusinessDays = 0;
    allEvents.forEach((event) => {
      const evStart = event.startDate || event.date;
      const evEnd = event.endDate || event.date;
      if (evStart && evEnd) totalBusinessDays += this.calculateBusinessDays(evStart, evEnd, companyHolidayDates);
    });

    // Build employee map
    const employeeMap = new Map<number, { name: string; totalEvents: number; totalBusinessDays: number; eventTypes: Record<string, number> }>();
    rankingData.forEach((row) => {
      if (!employeeMap.has(row.employeeId)) {
        employeeMap.set(row.employeeId, { name: row.employeeName || 'ไม่ทราบชื่อ', totalEvents: 0, totalBusinessDays: 0, eventTypes: {} });
      }
      const emp = employeeMap.get(row.employeeId)!;
      emp.totalEvents += row.count;
      emp.eventTypes[row.leaveType] = row.count;
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
