/**
 * SQLite → Supabase (PostgreSQL) Data Migration Script
 *
 * This script reads all data from the local SQLite database (calendar.db)
 * and inserts it into the Supabase PostgreSQL database via Prisma.
 *
 * Usage:
 *   1. Set DATABASE_URL in .env to your Supabase connection string
 *   2. Run: bunx prisma db push  (creates tables on Supabase)
 *   3. Run: bun scripts/migrate-data.ts
 */

import { Database } from 'bun:sqlite';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { join } from 'path';
import 'dotenv/config';

// ── Connect to SQLite ───────────────────────────────────────
const dbPath = join(process.cwd(), 'data', 'calendar.db');
console.log(`📂 Reading SQLite database: ${dbPath}`);
const sqlite = new Database(dbPath);

// ── Connect to PostgreSQL (Supabase) ────────────────────────
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('❌ DATABASE_URL is not set in .env');
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });
console.log(`🔗 Connected to Supabase PostgreSQL`);

// ── Helper ──────────────────────────────────────────────────
function readTable(tableName: string): any[] {
  try {
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    console.log(`  📊 ${tableName}: ${rows.length} rows`);
    return rows;
  } catch (error) {
    console.log(`  ⚠️  ${tableName}: table not found or empty`);
    return [];
  }
}

// ── Main Migration ──────────────────────────────────────────
async function migrate() {
  console.log('\n🚀 Starting data migration...\n');

  // ── Clear all tables first (idempotent re-run) ──────────────
  console.log('🗑️  Clearing existing data...');
  // TRUNCATE with CASCADE handles foreign key order automatically
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE events, employees, cronjob_config, company_holidays, thai_holidays, admin_config RESTART IDENTITY CASCADE`
  );
  console.log('   ✅ All tables cleared\n');

  // 1. Employees
  const employees = readTable('employees') as Array<{ id: number; name: string; created_at: string; updated_at: string }>;
  if (employees.length > 0) {
    for (const emp of employees) {
      await prisma.employee.upsert({
        where: { id: emp.id },
        update: {},
        create: {
          id: emp.id,
          name: emp.name,
          createdAt: new Date(emp.created_at),
          updatedAt: new Date(emp.updated_at),
        },
      });
    }
    console.log(`  ✅ Migrated ${employees.length} employees`);
  }

  // 2. Events — use raw SQL to bypass Prisma relation requirement
  const events = readTable('events') as Array<{
    id: number; employee_id: number; employee_name: string | null; leave_type: string;
    date: string | null; start_date: string | null; end_date: string | null;
    description: string | null; created_at: string; updated_at: string;
  }>;

  // Build employee id→name lookup from already-migrated employees
  const employeeNameMap = new Map<number, string>(
    employees.map((e) => [e.id, e.name])
  );

  if (events.length > 0) {
    for (const evt of events) {
      // Resolve employeeName: use existing value, fallback to lookup, then 'Unknown'
      const employeeName = evt.employee_name || employeeNameMap.get(evt.employee_id) || 'Unknown';

      await prisma.$executeRawUnsafe(
        `INSERT INTO events (id, employee_id, employee_name, leave_type, date, start_date, end_date, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        evt.id,
        evt.employee_id,
        employeeName,
        evt.leave_type,
        evt.date,
        evt.start_date,
        evt.end_date,
        evt.description,
        new Date(evt.created_at),
        new Date(evt.updated_at),
      );
    }
    console.log(`  ✅ Migrated ${events.length} events`);
  }

  // 3. Cronjob Config
  const cronjobs = readTable('cronjob_config') as Array<{
    id: number; name: string; enabled: number; schedule_time: string;
    webhook_url: string; notification_days: number; notification_type: string;
    weekly_days: string | null; weekly_scope: string | null;
    created_at: string; updated_at: string;
  }>;
  if (cronjobs.length > 0) {
    for (const cj of cronjobs) {
      await prisma.cronjobConfig.upsert({
        where: { id: cj.id },
        update: {},
        create: {
          id: cj.id,
          name: cj.name,
          enabled: Boolean(cj.enabled),
          scheduleTime: cj.schedule_time,
          webhookUrl: cj.webhook_url,
          notificationDays: cj.notification_days,
          notificationType: cj.notification_type,
          weeklyDays: cj.weekly_days,
          weeklyScope: cj.weekly_scope,
          createdAt: new Date(cj.created_at),
          updatedAt: new Date(cj.updated_at),
        },
      });
    }
    console.log(`  ✅ Migrated ${cronjobs.length} cronjob configs`);
  }

  // 4. Company Holidays
  const holidays = readTable('company_holidays') as Array<{
    id: number; name: string; date: string; description: string | null;
    created_at: string; updated_at: string;
  }>;
  if (holidays.length > 0) {
    for (const h of holidays) {
      await prisma.companyHoliday.upsert({
        where: { id: h.id },
        update: {},
        create: {
          id: h.id,
          name: h.name,
          date: h.date,
          description: h.description,
          createdAt: new Date(h.created_at),
          updatedAt: new Date(h.updated_at),
        },
      });
    }
    console.log(`  ✅ Migrated ${holidays.length} company holidays`);
  }

  // 5. Thai Holidays
  const thaiHolidays = readTable('thai_holidays') as Array<{
    id: number; name: string; date: string; type: string;
    year: number; source: string | null; created_at: string;
  }>;
  if (thaiHolidays.length > 0) {
    for (const th of thaiHolidays) {
      await prisma.thaiHoliday.upsert({
        where: { id: th.id },
        update: {},
        create: {
          id: th.id,
          name: th.name,
          date: th.date,
          type: th.type,
          year: th.year,
          source: th.source,
          createdAt: new Date(th.created_at),
        },
      });
    }
    console.log(`  ✅ Migrated ${thaiHolidays.length} Thai holidays`);
  }

  // 6. Admin Config
  const adminConfigs = readTable('admin_config') as Array<{ id: number; pin: string }>;
  if (adminConfigs.length > 0) {
    for (const ac of adminConfigs) {
      await prisma.adminConfig.upsert({
        where: { id: ac.id },
        update: {},
        create: {
          id: ac.id,
          pin: ac.pin,
        },
      });
    }
    console.log(`  ✅ Migrated ${adminConfigs.length} admin configs`);
  }

  // Reset sequences so autoincrement continues from the right place
  const tables = ['employees', 'events', 'cronjob_config', 'company_holidays', 'thai_holidays', 'admin_config'];
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`
      );
    } catch (e) {
      // Ignore if sequence doesn't exist
    }
  }

  console.log('\n🎉 Migration complete!\n');

  // Verify counts
  console.log('📋 Verification:');
  console.log(`  Employees:        ${await prisma.employee.count()}`);
  console.log(`  Events:           ${await prisma.event.count()}`);
  console.log(`  Cronjob Configs:  ${await prisma.cronjobConfig.count()}`);
  console.log(`  Company Holidays: ${await prisma.companyHoliday.count()}`);
  console.log(`  Thai Holidays:    ${await prisma.thaiHoliday.count()}`);
  console.log(`  Admin Configs:    ${await prisma.adminConfig.count()}`);

  await prisma.$disconnect();
  sqlite.close();
}

migrate().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
