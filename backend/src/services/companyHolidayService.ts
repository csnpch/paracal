import { getDatabase } from '../database/connection';
import type { CompanyHoliday, CreateCompanyHolidayInput, UpdateCompanyHolidayInput } from '../types';
import moment from 'moment';

export class CompanyHolidayService {
  private db = getDatabase();

  private getNow(): string {
    return moment().utcOffset('+07:00').format();
  }

  getAllCompanyHolidays(): CompanyHoliday[] {
    return this.db.prepare(`
      SELECT id, name, date, description, created_at as createdAt, updated_at as updatedAt
      FROM company_holidays ORDER BY date ASC
    `).all() as CompanyHoliday[];
  }

  getCompanyHolidaysByYear(year: number): CompanyHoliday[] {
    return this.db.prepare(`
      SELECT id, name, date, description, created_at as createdAt, updated_at as updatedAt
      FROM company_holidays WHERE date LIKE ? ORDER BY date ASC
    `).all(`${year}%`) as CompanyHoliday[];
  }

  getCompanyHolidayById(id: number): CompanyHoliday | null {
    const result = this.db.prepare(`
      SELECT id, name, date, description, created_at as createdAt, updated_at as updatedAt
      FROM company_holidays WHERE id = ?
    `).get(id) as CompanyHoliday | undefined;
    return result || null;
  }

  createCompanyHoliday(data: CreateCompanyHolidayInput): CompanyHoliday {
    const now = this.getNow();
    this.db.prepare(`
      INSERT INTO company_holidays (name, date, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
    `).run(data.name, data.date, data.description || null, now, now);

    const { id } = this.db.prepare('SELECT last_insert_rowid() as id').get() as { id: number };
    return this.getCompanyHolidayById(id)!;
  }

  createMultipleCompanyHolidays(holidays: CreateCompanyHolidayInput[]): CompanyHoliday[] {
    return holidays.map((h) => this.createCompanyHoliday(h));
  }

  updateCompanyHoliday(id: number, data: UpdateCompanyHolidayInput): CompanyHoliday | null {
    const existing = this.getCompanyHolidayById(id);
    if (!existing) return null;

    const now = this.getNow();
    this.db.prepare(`
      UPDATE company_holidays SET name = ?, date = ?, description = ?, updated_at = ? WHERE id = ?
    `).run(data.name ?? existing.name, data.date ?? existing.date, data.description ?? existing.description ?? null, now, id);

    return this.getCompanyHolidayById(id);
  }

  deleteCompanyHoliday(id: number): boolean {
    return this.db.prepare('DELETE FROM company_holidays WHERE id = ?').run(id).changes > 0;
  }

  isCompanyHoliday(date: string): boolean {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM company_holidays WHERE date = ?').get(date) as { count: number };
    return result.count > 0;
  }

  getCompanyHolidaysForDateRange(startDate: string, endDate: string): CompanyHoliday[] {
    return this.db.prepare(`
      SELECT id, name, date, description, created_at as createdAt, updated_at as updatedAt
      FROM company_holidays WHERE date >= ? AND date <= ? ORDER BY date ASC
    `).all(startDate, endDate) as CompanyHoliday[];
  }

  deleteAllCompanyHolidays(): { count: number } {
    const result = this.db.prepare('DELETE FROM company_holidays').run();
    return { count: result.changes };
  }
}