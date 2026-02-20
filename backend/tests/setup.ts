import { Database } from "bun:sqlite";
import { beforeEach, afterEach, afterAll } from "bun:test";

// Mock database for testing (singleton)
if (!global.mockDatabase) {
  global.mockDatabase = new Database(":memory:") as any;

  // Create test schema (only once)
  global.mockDatabase.exec(`
    CREATE TABLE employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      employee_name TEXT NOT NULL,
      leave_type TEXT NOT NULL,
      date TEXT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees (id)
    );

    CREATE TABLE holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      date DATE NOT NULL,
      type TEXT DEFAULT 'public'
    );

  CREATE TABLE cronjob_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    schedule_time TEXT NOT NULL,
    webhook_url TEXT NOT NULL,
    notification_days INTEGER NOT NULL DEFAULT 0,
    notification_type TEXT NOT NULL DEFAULT 'daily' CHECK (notification_type IN ('daily', 'weekly')),
    weekly_days TEXT,
    weekly_scope TEXT DEFAULT 'current' CHECK (weekly_scope IN ('current', 'next')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE company_holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE admin_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pin TEXT NOT NULL
  );
`);

  // Insert test data (only once)
  global.mockDatabase.exec(`
    INSERT INTO employees (name) VALUES 
      ('John Smith'),
      ('Sarah Johnson'),
      ('Michael Brown'),
      ('Emily Davis'),
      ('David Wilson');
      
    INSERT INTO holidays (name, date) VALUES 
      ('วันปีใหม่', '2025-01-01'),
      ('วันลอยกระทง', '2025-11-15');

    INSERT INTO admin_config (pin) VALUES
      ('$2a$10$wE9s9r9/HXY2pU7oD4.aMe6JbY5wE6tLz/P5xI/hWfSZZU148yBWa'); -- hash for '000000'
  `);
}

// Cleanup function to be called in each test file's beforeEach
export function cleanupDatabase() {
  const db = global.mockDatabase as any;

  // Clean all tables
  try {
    db.run("DELETE FROM events");
  } catch (e) {}

  try {
    db.run("DELETE FROM cronjob_config");
  } catch (e) {}

  try {
    db.run("DELETE FROM employees");
  } catch (e) {}

  try {
    db.run("DELETE FROM company_holidays");
  } catch (e) {}

  try {
    db.run(
      "DELETE FROM sqlite_sequence WHERE name IN ('employees', 'events', 'cronjob_config', 'company_holidays')"
    );
  } catch (e) {}

  // Re-insert test data
  db.run(`
    INSERT INTO employees (name) VALUES 
      ('John Smith'),
      ('Sarah Johnson'),
      ('Michael Brown'),
      ('Emily Davis'),
      ('David Wilson')
  `);
}

