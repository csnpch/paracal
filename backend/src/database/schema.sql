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
