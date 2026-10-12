import 'dotenv/config';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// One-time bridge for databases created by db push or the original SQL rollout.
// Normal dev/build/start use migrate deploy; this never executes schema-diff SQL.
const backend = resolve(import.meta.dir, '..');
const baseline = '20260901000000_baseline';
const rotation = '20261009100000_daily_meeting_rotation';
const legacyTables = ['employees', 'events', 'cronjob_config', 'company_holidays', 'thai_holidays', 'admin_config', 'activity_logs'];
const rotationTables = ['daily_rotation_config', 'daily_meeting_weeks', 'daily_leader_deliveries'];
const managedTables = new Set([...legacyTables, ...rotationTables, '_prisma_migrations']);

async function prismaCommand(args: string[]) {
  const child = Bun.spawn([process.execPath, resolve(backend, 'node_modules/prisma/build/index.js'), ...args], {
    cwd: backend, env: process.env, stdout: 'pipe', stderr: 'pipe',
  });
  const [code, stdout, stderr] = await Promise.all([
    child.exited, new Response(child.stdout).text(), new Response(child.stderr).text(),
  ]);
  if (code !== 0) throw new Error(`Prisma ${args[0]} ${args[1]} failed.\n${stderr}`);
  return stdout;
}

async function adopt() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, max: 1 }) });
  let hasRotation = false;
  let applied: string[] = [];
  try {
    const tables = await db.$queryRawUnsafe<Array<{ tablename: string }>>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
    const names = new Set(tables.map(row => row.tablename));
    if (!legacyTables.every(name => names.has(name))) throw new Error('Legacy tables are missing. Use db:migrate for an empty database; partial schemas cannot be adopted.');
    const present = rotationTables.filter(name => names.has(name));
    if (present.length !== 0 && present.length !== rotationTables.length) throw new Error('Partial rotation schema cannot be adopted.');
    hasRotation = present.length === rotationTables.length;
    if (hasRotation) {
      const checks = await db.$queryRawUnsafe<Array<{ definition: string }>>(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid = 'public.daily_rotation_config'::regclass AND contype = 'c'`);
      if (!checks.some(row => row.definition.replace(/[()\s]/g, '') === 'CHECKid=1')) throw new Error('Rotation singleton constraint is missing; adoption stopped.');
    }
    if (names.has('_prisma_migrations')) {
      const history = await db.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>(`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`);
      if (history.some(row => !row.finished_at && !row.rolled_back_at)) throw new Error('Failed migration exists. Resolve it before adoption.');
      applied = history.filter(row => row.finished_at && !row.rolled_back_at).map(row => row.migration_name);
      if (applied.includes(baseline) && (!hasRotation || applied.includes(rotation))) {
        console.log('Migration history already registered. Use db:migrate for pending migrations.');
        return;
      }
      if (applied.some(name => name !== baseline && name !== rotation)) throw new Error('Unrecognized migration history; adoption stopped.');
    }
  } finally { await db.$disconnect(); }

  const schema = hasRotation ? 'prisma/rotation-rollout.prisma' : 'prisma/legacy.prisma';
  const diff = await prismaCommand(['migrate', 'diff', '--from-config-datasource', '--to-schema', schema, '--script']);
  const statements = diff.replace(/--[^\n]*/g, '').split(';').map(sql => sql.trim()).filter(Boolean);
  // Unmanaged historical tables (e.g. teams) are preserved. Any difference in
  // managed tables, columns, indexes or foreign keys stops adoption.
  for (const sql of statements) {
    const extraTable = sql.match(/^DROP TABLE "([^"]+)"$/)?.[1]
      ?? sql.match(/^ALTER TABLE "([^"]+)" DROP CONSTRAINT "[^"]+"$/)?.[1];
    if (!extraTable || managedTables.has(extraTable)) throw new Error('Database schema does not match the known rollout. Migration history was not adopted.');
  }
  for (const name of hasRotation ? [baseline, rotation] : [baseline]) {
    if (!applied.includes(name)) await prismaCommand(['migrate', 'resolve', '--applied', name]);
  }
  console.log(`Registered existing schema (${hasRotation ? 'baseline and rotation' : 'baseline'}). Application data was not modified.`);
}

await adopt().catch(error => { console.error(error.message); process.exitCode = 1; });
