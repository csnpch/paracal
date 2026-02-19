import { Database } from 'bun:sqlite';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import Logger from '../utils/logger';

class DatabaseConnection {
  private static instance: Database | null = null;

  static getInstance(): Database {
    if (!this.instance) {
      // Ensure data directory exists
      const dataDir = join(process.cwd(), 'data');
      if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true });
      }

      const dbPath = join(dataDir, 'calendar.db');
      this.instance = new Database(dbPath);
      this.instance.exec('PRAGMA foreign_keys = ON;');
      this.initializeSchema();
    }
    return this.instance;
  }

  private static initializeSchema(): void {
    if (!this.instance) return;

    try {
      const schema = `
        -- Employees table
        CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Events table
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER NOT NULL,
            employee_name TEXT NOT NULL,
            leave_type TEXT NOT NULL CHECK (leave_type IN ('vacation', 'personal', 'sick', 'absent', 'maternity', 'bereavement', 'study', 'military', 'sabbatical', 'unpaid', 'compensatory', 'other')),
            date TEXT,
            start_date TEXT,
            end_date TEXT,
            description TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
        );

        -- Cronjob configuration table
        CREATE TABLE IF NOT EXISTS cronjob_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            enabled BOOLEAN NOT NULL DEFAULT 1,
            schedule_time TEXT NOT NULL,
            webhook_url TEXT NOT NULL,
            notification_days INTEGER NOT NULL DEFAULT 1,
            notification_type TEXT NOT NULL DEFAULT 'daily' CHECK (notification_type IN ('daily', 'weekly')),
            weekly_days TEXT,
            weekly_scope TEXT DEFAULT 'current' CHECK (weekly_scope IN ('current', 'next')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Company holidays table
        CREATE TABLE IF NOT EXISTS company_holidays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            description TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Thai holidays cache table
        CREATE TABLE IF NOT EXISTS thai_holidays (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            date TEXT NOT NULL,
            type TEXT NOT NULL DEFAULT 'public',
            year INTEGER NOT NULL,
            source TEXT DEFAULT 'api',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_events_employee_id ON events(employee_id);
        CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
        CREATE INDEX IF NOT EXISTS idx_events_leave_type ON events(leave_type);
        CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
        CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date);
        CREATE INDEX IF NOT EXISTS idx_events_date_range ON events(start_date, end_date);
        CREATE INDEX IF NOT EXISTS idx_cronjob_config_enabled ON cronjob_config(enabled);
        CREATE INDEX IF NOT EXISTS idx_company_holidays_date ON company_holidays(date);
        CREATE INDEX IF NOT EXISTS idx_thai_holidays_year ON thai_holidays(year);

        -- Insert default employees
        INSERT OR IGNORE INTO employees (id, name) VALUES
        (1, 'John Smith'),
        (2, 'Sarah Johnson'),
        (3, 'Michael Brown'),
        (4, 'Emily Davis'),
        (5, 'David Wilson');

        -- Insert default cronjob configurations
        INSERT OR IGNORE INTO cronjob_config (id, name, enabled, schedule_time, webhook_url, notification_days) VALUES
        (1, 'Morning Notification', 1, '09:00', 'https://prod-56.southeastasia.logic.azure.com:443/workflows/8f1f48a580794efeb7f5363a94366e20/triggers/manual/paths/invoke?api-version=2016-06-01', 1),
        (2, 'Evening Notification', 1, '17:30', 'https://prod-56.southeastasia.logic.azure.com:443/workflows/8f1f48a580794efeb7f5363a94366e20/triggers/manual/paths/invoke?api-version=2016-06-01', 0);
      `;

      this.instance.exec(schema);
      this.runMigrations();
      Logger.info('Database schema initialized successfully');
    } catch (error) {
      Logger.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  private static runMigrations(): void {
    if (!this.instance) return;

    try {
      Logger.info('Running database migrations...');

      // Check events table columns
      const eventsColumns = (this.instance.prepare('PRAGMA table_info(events)').all() as any[]).map((c) => c.name);

      if (!eventsColumns.includes('employee_name')) {
        Logger.info('Adding employee_name column to events table...');
        this.instance.exec('ALTER TABLE events ADD COLUMN employee_name TEXT');
        this.instance.exec(`UPDATE events SET employee_name = (SELECT name FROM employees WHERE employees.id = events.employee_id) WHERE employee_name IS NULL`);
      }

      if (!eventsColumns.includes('start_date')) {
        Logger.info('Adding start_date column to events table...');
        this.instance.exec('ALTER TABLE events ADD COLUMN start_date TEXT');
        this.instance.exec('UPDATE events SET start_date = date WHERE start_date IS NULL');
      }

      if (!eventsColumns.includes('end_date')) {
        Logger.info('Adding end_date column to events table...');
        this.instance.exec('ALTER TABLE events ADD COLUMN end_date TEXT');
        this.instance.exec('UPDATE events SET end_date = date WHERE end_date IS NULL');
      }

      // Check cronjob_config columns
      const cronjobColumns = (this.instance.prepare('PRAGMA table_info(cronjob_config)').all() as any[]).map((c) => c.name);

      if (!cronjobColumns.includes('notification_type')) {
        this.instance.exec("ALTER TABLE cronjob_config ADD COLUMN notification_type TEXT NOT NULL DEFAULT 'daily' CHECK (notification_type IN ('daily', 'weekly'))");
      }
      if (!cronjobColumns.includes('weekly_days')) {
        this.instance.exec('ALTER TABLE cronjob_config ADD COLUMN weekly_days TEXT');
      }
      if (!cronjobColumns.includes('weekly_scope')) {
        this.instance.exec("ALTER TABLE cronjob_config ADD COLUMN weekly_scope TEXT DEFAULT 'current' CHECK (weekly_scope IN ('current', 'next'))");
      }

      // Fix legacy scope values
      this.instance.exec("UPDATE cronjob_config SET weekly_scope = 'current' WHERE weekly_scope = 'current_week'");
      this.instance.exec("UPDATE cronjob_config SET weekly_scope = 'next' WHERE weekly_scope = 'next_week'");

      Logger.info('Migrations completed successfully');
    } catch (error) {
      Logger.error('Migration failed:', error);
    }
  }

  static close(): void {
    if (this.instance) {
      this.instance.close(false);
      this.instance = null;
    }
  }
}

export const getDatabase = () => {
  if (typeof global !== 'undefined' && (global as any).mockDatabase) {
    return (global as any).mockDatabase;
  }
  return DatabaseConnection.getInstance();
};

export default DatabaseConnection;