import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { EventMergeService } from '../../src/services/eventMergeService';
import { EventService } from '../../src/services/eventService';

// Real PostgreSQL engine + the production Prisma driver, entirely in memory.
// Never reads DATABASE_URL or connects to the application's database.
export async function createMergeDatabase() {
  const db = await PGlite.create();
  await db.exec(`
    CREATE TABLE employees (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE events (
      id SERIAL PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id),
      employee_name TEXT NOT NULL, leave_type TEXT NOT NULL,
      leave_duration TEXT NOT NULL DEFAULT 'full', date TEXT,
      start_date TEXT, end_date TEXT, description TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE company_holidays (
      id SERIAL PRIMARY KEY, name TEXT NOT NULL, date TEXT NOT NULL, description TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  await server.start();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: `postgresql://postgres@${server.getServerConn()}/postgres`, max: 1 }),
  });
  const bind = <T extends object>(service: T): T => {
    Object.defineProperty(service, 'prisma', { get: () => prisma });
    return service;
  };
  return {
    prisma,
    events: bind(new EventService()),
    merger: () => bind(new EventMergeService()),
    async reset() {
      await prisma.$executeRawUnsafe('TRUNCATE events, employees, company_holidays RESTART IDENTITY CASCADE');
      await prisma.employee.create({ data: { name: 'Tan - Bupphachon.suw' } });
    },
    async close() {
      await prisma.$disconnect();
      await server.stop();
      await db.close();
    },
  };
}
