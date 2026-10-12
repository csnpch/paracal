import { describe, test, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { resolve } from 'node:path';

const backend = resolve(import.meta.dir, '..');

async function database() {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port: 0, host: '127.0.0.1' });
  await server.start();
  return {
    db,
    url: `postgresql://postgres@${server.getServerConn()}/postgres?sslmode=disable`,
    async close() { await server.stop(); await db.close(); },
  };
}

async function run(script: string, url: string) {
  const process = Bun.spawn([Bun.which('bun')!, 'run', script], {
    cwd: backend,
    env: { ...Bun.env, DATABASE_URL: url, NODE_ENV: 'production' },
    stdout: 'pipe', stderr: 'pipe',
  });
  const timeout = setTimeout(() => process.kill(), 20000);
  const [code, stdout, stderr] = await Promise.all([
    process.exited, new Response(process.stdout).text(), new Response(process.stderr).text(),
  ]);
  clearTimeout(timeout);
  return { code, output: stdout + stderr };
}

describe('automatic database migrations', () => {
  test('build:compile creates the artifact without connecting to a database', async () => {
    expect(await run('build:compile', 'postgresql://postgres@127.0.0.1:1/unreachable?connect_timeout=1')).toMatchObject({ code: 0 });
    expect(await Bun.file(`${backend}/dist/index.js`).exists()).toBe(true);
  }, 60000);
  test('build applies committed migrations to an empty database before compiling', async () => {
    const fixture = await database();
    try {
      const result = await run('build', fixture.url);
      expect(result).toMatchObject({ code: 0 });
      const tables = await fixture.db.query<{ name: string }>(`SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'`);
      expect(tables.rows.map(row => row.name)).toContain('daily_rotation_config');
      expect(tables.rows.map(row => row.name)).toContain('_prisma_migrations');
    } finally { await fixture.close(); }
  }, 60000);

  test('adopts the legacy database and deploys pending rotation SQL without changing records', async () => {
    const fixture = await database();
    try {
      await fixture.db.exec(await Bun.file(`${backend}/prisma/migrations/20260901000000_baseline/migration.sql`).text());
      await fixture.db.exec(`INSERT INTO employees (name) VALUES ('Existing user');
        INSERT INTO events (employee_id, employee_name, leave_type, date) VALUES (1, 'Existing user', 'vacation', '2026-10-12');
        INSERT INTO cronjob_config (name, schedule_time, webhook_url) VALUES ('Existing job', '09:00', 'http://unused.invalid');`);
      expect(await run('db:adopt', fixture.url)).toMatchObject({ code: 0 });
      expect(await run('db:migrate', fixture.url)).toMatchObject({ code: 0 });
      expect(await run('db:migrate', fixture.url)).toMatchObject({ code: 0 });
      expect((await fixture.db.query(`SELECT name FROM employees`)).rows).toEqual([{ name: 'Existing user' }]);
      expect((await fixture.db.query(`SELECT date FROM events`)).rows).toEqual([{ date: '2026-10-12' }]);
      expect((await fixture.db.query(`SELECT name, enabled, daily_leader_enabled FROM cronjob_config`)).rows).toEqual([
        { name: 'Existing job', enabled: true, daily_leader_enabled: false },
      ]);
      expect((await fixture.db.query(`SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY migration_name`)).rows).toEqual([
        { migration_name: '20260901000000_baseline' }, { migration_name: '20261009100000_daily_meeting_rotation' },
      ]);
    } finally { await fixture.close(); }
  }, 60000);

  test('adopts already-applied rotation SQL, preserving settings and unrelated legacy tables', async () => {
    const fixture = await database();
    try {
      await fixture.db.exec(await Bun.file(`${backend}/prisma/migrations/20260901000000_baseline/migration.sql`).text());
      await fixture.db.exec(await Bun.file(`${backend}/prisma/migrations/20261009100000_daily_meeting_rotation/migration.sql`).text());
      await fixture.db.exec(`CREATE TABLE teams (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE "_EmployeeToTeam" ("A" INTEGER REFERENCES employees(id), "B" INTEGER REFERENCES teams(id));
        INSERT INTO employees (name) VALUES ('Preserved user');
        INSERT INTO teams (name) VALUES ('Preserved team');
        INSERT INTO daily_rotation_config (start_week, enabled, notification_enabled, employee_order) VALUES ('2026-10-12', true, true, '[1]');`);
      expect(await run('db:adopt', fixture.url)).toMatchObject({ code: 0 });
      expect(await run('db:adopt', fixture.url)).toMatchObject({ code: 0 });
      expect(await run('db:migrate', fixture.url)).toMatchObject({ code: 0 });
      expect((await fixture.db.query(`SELECT enabled, notification_enabled, employee_order FROM daily_rotation_config`)).rows).toEqual([
        { enabled: true, notification_enabled: true, employee_order: [1] },
      ]);
      expect((await fixture.db.query(`SELECT name FROM teams`)).rows).toEqual([{ name: 'Preserved team' }]);
      expect((await fixture.db.query(`SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL`)).rows).toEqual([{ count: 2 }]);
    } finally { await fixture.close(); }
  }, 60000);

  test('refuses to adopt a mismatched legacy schema without marking it applied', async () => {
    const fixture = await database();
    try {
      await fixture.db.exec(await Bun.file(`${backend}/prisma/migrations/20260901000000_baseline/migration.sql`).text());
      await fixture.db.exec('ALTER TABLE employees DROP COLUMN updated_at');
      const result = await run('db:adopt', fixture.url);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain('Database schema does not match');
      expect((await fixture.db.query(`SELECT to_regclass('public._prisma_migrations')::text AS history`)).rows).toEqual([{ history: null }]);
    } finally { await fixture.close(); }
  }, 60000);

  test('dev, build and start stop when migration fails, leaving existing data intact', async () => {
    const fixture = await database();
    try {
      await fixture.db.exec(`CREATE TABLE employees (id SERIAL PRIMARY KEY, name TEXT NOT NULL);
        INSERT INTO employees (name) VALUES ('Do not reset');`);
      for (const script of ['dev', 'build', 'start']) {
        const result = await run(script, fixture.url);
        expect(result.code).not.toBe(0);
        expect(result.output).toContain('P3005');
      }
      expect((await fixture.db.query(`SELECT name FROM employees`)).rows).toEqual([{ name: 'Do not reset' }]);
      expect((await fixture.db.query(`SELECT to_regclass('public.events')::text AS events`)).rows).toEqual([{ events: null }]);
    } finally { await fixture.close(); }
  }, 60000);

  test('refuses partial rotation SQL instead of falsely recording a complete migration', async () => {
    const fixture = await database();
    try {
      await fixture.db.exec(await Bun.file(`${backend}/prisma/migrations/20260901000000_baseline/migration.sql`).text());
      await fixture.db.exec('CREATE TABLE daily_rotation_config (id INTEGER PRIMARY KEY)');
      const result = await run('db:adopt', fixture.url);
      expect(result.code).not.toBe(0);
      expect(result.output).toContain('Partial rotation schema');
      expect((await fixture.db.query(`SELECT to_regclass('public._prisma_migrations')::text AS history`)).rows).toEqual([{ history: null }]);
    } finally { await fixture.close(); }
  }, 60000);
});
