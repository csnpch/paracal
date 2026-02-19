import { apiClient } from './api';

interface ThaiHoliday {
  date: string;
  name: string;
  type: 'public' | 'religious' | 'substitution';
}

export const fetchThaiHolidays = async (year: number): Promise<ThaiHoliday[]> => {
  try {
    return await apiClient.get<ThaiHoliday[]>(`/holidays/${year}`);
  } catch (error) {
    console.error('Error fetching Thai holidays from API:', error);
    // Fallback to basic Thai holidays
    return [
      { date: `${year}-01-01`, name: 'วันขึ้นปีใหม่', type: 'public' },
      { date: `${year}-04-13`, name: 'วันสงกรานต์', type: 'public' },
      { date: `${year}-04-14`, name: 'วันสงกรานต์', type: 'public' },
      { date: `${year}-04-15`, name: 'วันสงกรานต์', type: 'public' },
      { date: `${year}-05-01`, name: 'วันแรงงานแห่งชาติ', type: 'public' },
      { date: `${year}-12-05`, name: 'วันพ่อแห่งชาติ', type: 'public' },
      { date: `${year}-12-10`, name: 'วันรัฐธรรมนูญ', type: 'public' },
      { date: `${year}-12-31`, name: 'วันสิ้นปี', type: 'public' },
    ];
  }
};

export const getHolidaysForDateRange = async (startDate: string, endDate: string): Promise<ThaiHoliday[]> => {
  try {
    return await apiClient.get<ThaiHoliday[]>(`/holidays/range/${startDate}/${endDate}`);
  } catch (error) {
    console.error('Error fetching holidays for date range:', error);
    return [];
  }
};

export const isHoliday = async (date: string): Promise<boolean> => {
  try {
    const result = await apiClient.get<{ date: string; isHoliday: boolean }>(`/holidays/check/${date}`);
    return result.isHoliday;
  } catch (error) {
    console.error('Error checking if date is holiday:', error);
    return false;
  }
};
