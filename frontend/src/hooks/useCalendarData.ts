import { useState, useEffect } from 'react';
import { getApiDatabase, type Employee, type Event } from '../services/apiDatabase';
import moment from 'moment';

export const useCalendarData = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const db = getApiDatabase();

  // ── Load Data ──────────────────────────────────────────────

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [employeesData, eventsData] = await Promise.all([
        db.getAllEmployees(),
        db.getAllEvents(),
      ]);
      setEmployees(employeesData);
      setEvents(eventsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadEventsForMonth = async (year: number, month: number) => {
    try {
      const eventsData = await db.getEventsByMonth(year, month + 1);
      setEvents(eventsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    }
  };

  // ── Employee Operations ────────────────────────────────────

  const addEmployee = async (employee: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newEmployee = await db.createEmployee(employee);
      setEmployees((prev) => [...prev, newEmployee]);
      return newEmployee;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add employee');
      throw err;
    }
  };

  const updateEmployee = async (id: number, updates: Partial<Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const updatedEmployee = await db.updateEmployee(id, updates);
      if (updatedEmployee) {
        setEmployees((prev) => prev.map((emp) => (emp.id === id ? updatedEmployee : emp)));
        // Reload events to get updated employee names
        const eventsData = await db.getAllEvents();
        setEvents(eventsData);
        return updatedEmployee;
      }
      throw new Error('Employee not found');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update employee');
      throw err;
    }
  };

  const deleteEmployee = async (id: number) => {
    try {
      const success = await db.deleteEmployee(id);
      if (success) {
        setEmployees((prev) => prev.filter((emp) => emp.id !== id));
        setEvents((prev) => prev.filter((event) => event.employeeId !== id));
      }
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete employee');
      throw err;
    }
  };

  // ── Event Operations ───────────────────────────────────────

  const addEvent = async (event: Omit<Event, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      return await db.createEvent(event);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add event');
      throw err;
    }
  };

  const updateEvent = async (id: number, updates: Partial<Omit<Event, 'id' | 'createdAt' | 'updatedAt'>>) => {
    try {
      const updatedEvent = await db.updateEvent(id, updates);
      if (updatedEvent) return updatedEvent;
      throw new Error('Event not found');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event');
      throw err;
    }
  };

  const deleteEvent = async (id: number) => {
    try {
      return await db.deleteEvent(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
      throw err;
    }
  };

  // ── Utilities ──────────────────────────────────────────────

  const getEventsForDate = (date: Date): Event[] => {
    const dateString = moment(date).format('YYYY-MM-DD');
    return events.filter((event) => {
      if (event.date === dateString) return true;
      if (event.startDate && event.endDate) {
        return dateString >= event.startDate && dateString <= event.endDate;
      }
      return false;
    });
  };

  const searchEmployees = async (query: string) => db.searchEmployees(query);
  const searchEvents = async (query: string) => db.searchEvents(query);
  const getEmployeeStats = async () => db.getEmployeeStats();
  const getEventStats = async () => db.getEventStats();

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    employees,
    events,
    loading,
    error,
    loadData,
    loadEventsForMonth,
    addEmployee,
    updateEmployee,
    deleteEmployee,
    addEvent,
    updateEvent,
    deleteEvent,
    getEventsForDate,
    searchEmployees,
    searchEvents,
    getEmployeeStats,
    getEventStats,
  };
};

export default useCalendarData;