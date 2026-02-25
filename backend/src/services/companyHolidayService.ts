import { getPrisma } from '../database/connection';
import type { CompanyHoliday, CreateCompanyHolidayInput, UpdateCompanyHolidayInput } from '../types';
import moment from 'moment';

export class CompanyHolidayService {
  private get prisma() { return getPrisma(); }

  private mapRow(row: any): CompanyHoliday {
    return {
      id: row.id,
      name: row.name,
      date: row.date,
      description: row.description,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
    };
  }

  async getAllCompanyHolidays(): Promise<CompanyHoliday[]> {
    const rows = await this.prisma.companyHoliday.findMany({ orderBy: { date: 'asc' } });
    return rows.map(this.mapRow);
  }

  async getCompanyHolidaysByYear(year: number): Promise<CompanyHoliday[]> {
    const rows = await this.prisma.companyHoliday.findMany({
      where: { date: { startsWith: `${year}` } },
      orderBy: { date: 'asc' },
    });
    return rows.map(this.mapRow);
  }

  async getCompanyHolidayById(id: number): Promise<CompanyHoliday | null> {
    const row = await this.prisma.companyHoliday.findUnique({ where: { id } });
    return row ? this.mapRow(row) : null;
  }

  async createCompanyHoliday(data: CreateCompanyHolidayInput): Promise<CompanyHoliday> {
    const now = moment().utcOffset('+07:00').toDate();
    const row = await this.prisma.companyHoliday.create({
      data: {
        name: data.name,
        date: data.date,
        description: data.description || null,
        createdAt: now,
        updatedAt: now,
      },
    });
    return this.mapRow(row);
  }

  async createMultipleCompanyHolidays(holidays: CreateCompanyHolidayInput[]): Promise<CompanyHoliday[]> {
    const results: CompanyHoliday[] = [];
    for (const h of holidays) {
      results.push(await this.createCompanyHoliday(h));
    }
    return results;
  }

  async updateCompanyHoliday(id: number, data: UpdateCompanyHolidayInput): Promise<CompanyHoliday | null> {
    const existing = await this.prisma.companyHoliday.findUnique({ where: { id } });
    if (!existing) return null;

    const now = moment().utcOffset('+07:00').toDate();
    const row = await this.prisma.companyHoliday.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        date: data.date ?? existing.date,
        description: data.description ?? existing.description ?? null,
        updatedAt: now,
      },
    });
    return this.mapRow(row);
  }

  async deleteCompanyHoliday(id: number): Promise<boolean> {
    try {
      await this.prisma.companyHoliday.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async isCompanyHoliday(date: string): Promise<boolean> {
    const count = await this.prisma.companyHoliday.count({ where: { date } });
    return count > 0;
  }

  async getCompanyHolidaysForDateRange(startDate: string, endDate: string): Promise<CompanyHoliday[]> {
    const rows = await this.prisma.companyHoliday.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    });
    return rows.map(this.mapRow);
  }

  async deleteAllCompanyHolidays(): Promise<{ count: number }> {
    const result = await this.prisma.companyHoliday.deleteMany();
    return { count: result.count };
  }
}