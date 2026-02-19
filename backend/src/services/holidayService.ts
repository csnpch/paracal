import type { Holiday } from '../types';
import { getDatabase } from '../database/connection';
import config from '../config';
import axios from 'axios';
import moment from 'moment';
import Logger from '../utils/logger';

// ─── External API Response Types ─────────────────────────────

interface CalendarificApiResponse {
  meta: {
    code: number;
    error_type?: string;
    error_detail?: string;
  };
  response: {
    holidays: Array<{
      name: string;
      description: string;
      date: { iso: string };
      type: string[];
      primary_type: string;
    }>;
  };
}

// ─── Service ─────────────────────────────────────────────────

export class HolidayService {
  private db = getDatabase();

  async fetchThaiHolidays(year: number): Promise<Holiday[]> {
    try {
      // Try API first
      Logger.info(`Fetching Thai holidays for ${year} from Calendarific API`);
      const response = await axios.get(
        `https://calendarific.com/api/v2/holidays?api_key=${config.calendarificApiKey}&country=TH&year=${year}`,
      );

      const data = response.data as CalendarificApiResponse;

      if (data.meta.code !== 200 || data.meta.error_type) {
        throw new Error(`API error: ${data.meta.error_type} - ${data.meta.error_detail}`);
      }

      if (!data.response.holidays?.length) {
        throw new Error('No holidays returned');
      }

      const relevantHolidays = data.response.holidays.filter(
        (h) =>
          h.primary_type === 'National holiday' ||
          h.primary_type === 'Public holiday' ||
          h.primary_type === 'Buddhist holiday' ||
          h.primary_type === 'Religious holiday',
      );

      const holidays: Holiday[] = relevantHolidays.map((h) => ({
        date: h.date.iso,
        name: h.name,
        type: h.primary_type.toLowerCase().includes('national') || h.primary_type.toLowerCase().includes('public')
          ? ('public' as const)
          : ('religious' as const),
      }));

      Logger.info(`Fetched ${holidays.length} holidays from Calendarific API`);
      this.saveHolidaysToDatabase(holidays, year, 'api');
      return holidays;
    } catch (error) {
      Logger.error('Error fetching from Calendarific API:', error);

      // Try database cache
      const cached = this.getHolidaysFromDatabase(year);
      if (cached.length > 0) {
        Logger.info(`Using ${cached.length} cached holidays from database for ${year}`);
        return cached;
      }

      // Final fallback
      Logger.warn('No cached data available, using default holidays');
      const defaults = this.getDefaultThaiHolidays(year);
      this.saveHolidaysToDatabase(defaults, year, 'fallback');
      return defaults;
    }
  }

  // ── Database Cache ───────────────────────────────────────────

  private getHolidaysFromDatabase(year: number): Holiday[] {
    try {
      const rows = this.db.prepare('SELECT date, name, type FROM thai_holidays WHERE year = ? ORDER BY date ASC').all(year) as Array<{ date: string; name: string; type: string }>;
      return rows.map((r) => ({ date: r.date, name: r.name, type: r.type as Holiday['type'] }));
    } catch (error) {
      Logger.error('Error getting holidays from database:', error);
      return [];
    }
  }

  private saveHolidaysToDatabase(holidays: Holiday[], year: number, source: string): void {
    try {
      this.db.prepare('DELETE FROM thai_holidays WHERE year = ?').run(year);

      const stmt = this.db.prepare('INSERT INTO thai_holidays (name, date, type, year, source) VALUES (?, ?, ?, ?, ?)');
      for (const h of holidays) {
        stmt.run(h.name, h.date, h.type, year, source);
      }

      Logger.info(`Saved ${holidays.length} holidays to database for year ${year} (source: ${source})`);
    } catch (error) {
      Logger.error('Error saving holidays to database:', error);
    }
  }

  // ── Default Holidays ─────────────────────────────────────────

  private getDefaultThaiHolidays(year: number): Holiday[] {
    const holidays: Holiday[] = [
      { date: `${year}-01-01`, name: 'วันขึ้นปีใหม่', type: 'public' },
      { date: `${year}-02-26`, name: 'วันมาฆบูชา', type: 'religious' },
      { date: `${year}-04-06`, name: 'วันจักรี', type: 'public' },
      { date: `${year}-04-13`, name: 'วันสงกรานต์', type: 'public' },
      { date: `${year}-04-14`, name: 'วันสงกรานต์', type: 'public' },
      { date: `${year}-04-15`, name: 'วันสงกรานต์', type: 'public' },
      { date: `${year}-05-01`, name: 'วันแรงงานแห่งชาติ', type: 'public' },
      { date: `${year}-05-04`, name: 'วันฉัตรมงคล', type: 'public' },
      { date: `${year}-05-22`, name: 'วันวิสาขบูชา', type: 'religious' },
      { date: `${year}-06-03`, name: 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าสุทิดา', type: 'public' },
      { date: `${year}-07-20`, name: 'วันอาสาฬหบูชา', type: 'religious' },
      { date: `${year}-07-21`, name: 'วันเข้าพรรษา', type: 'religious' },
      { date: `${year}-07-28`, name: 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว', type: 'public' },
      { date: `${year}-08-12`, name: 'วันแม่แห่งชาติ', type: 'public' },
      { date: `${year}-10-13`, name: 'วันคล้ายวันสวรรคตพระบาทสมเด็จพระบรมชนกาธิเบศร มหาภูมิพลอดุลยเดชมหาราช', type: 'public' },
      { date: `${year}-10-23`, name: 'วันปิยมหาราช', type: 'public' },
      { date: `${year}-12-05`, name: 'วันพ่อแห่งชาติ', type: 'public' },
      { date: `${year}-12-10`, name: 'วันรัฐธรรมนูญ', type: 'public' },
      { date: `${year}-12-31`, name: 'วันสิ้นปี', type: 'public' },
    ];

    if (year === 2024) {
      holidays.push(
        { date: `${year}-07-22`, name: 'วันหยุดชดเชยวันเข้าพรรษา', type: 'public' },
        { date: `${year}-12-30`, name: 'วันหยุดชดเชยวันสิ้นปี', type: 'public' },
      );
    }

    if (year === 2025) {
      holidays.push(
        { date: `${year}-01-02`, name: 'วันหยุดชดเชยวันขึ้นปีใหม่', type: 'public' },
        { date: `${year}-04-16`, name: 'วันหยุดชดเชยวันสงกรานต์', type: 'public' },
        { date: `${year}-05-02`, name: 'วันหยุดชดเชยวันแรงงานแห่งชาติ', type: 'public' },
        { date: `${year}-05-05`, name: 'วันหยุดชดเชยวันฉัตรมงคล', type: 'public' },
        { date: `${year}-10-14`, name: 'วันหยุดชดเชยวันคล้ายวันสวรรคตฯ', type: 'public' },
      );
    }

    return holidays.sort((a, b) => a.date.localeCompare(b.date));
  }

  // ── Query ────────────────────────────────────────────────────

  async getHolidaysForDateRange(startDate: string, endDate: string): Promise<Holiday[]> {
    const startYear = moment(startDate).year();
    const endYear = moment(endDate).year();

    const allHolidays: Holiday[] = [];
    for (let year = startYear; year <= endYear; year++) {
      allHolidays.push(...(await this.fetchThaiHolidays(year)));
    }

    return allHolidays.filter((h) => h.date >= startDate && h.date <= endDate);
  }

  async isHoliday(date: string): Promise<boolean> {
    const year = moment(date).year();
    const holidays = await this.fetchThaiHolidays(year);
    return holidays.some((h) => h.date === date);
  }
}