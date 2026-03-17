import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import Logger from '../utils/logger';
import bcrypt from 'bcryptjs';

// ── Singleton Prisma Client ─────────────────────────────────

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const adapter = new PrismaPg({ connectionString });
    prismaInstance = new PrismaClient({ adapter });
    Logger.info('Prisma Client initialized successfully');
  }
  return prismaInstance;
}

// ── Seed default data (replaces old initializeSchema) ───────

export async function seedDatabase(maxRetries = 5): Promise<void> {
  const prisma = getPrisma();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Seed default employees if table is empty
      const employeeCount = await prisma.employee.count();
      if (employeeCount === 0) {
        Logger.info('Seeding default employees...');
        await prisma.employee.createMany({
          data: [
            { id: 1, name: 'John Smith' },
            { id: 2, name: 'Sarah Johnson' },
            { id: 3, name: 'Michael Brown' },
            { id: 4, name: 'Emily Davis' },
            { id: 5, name: 'David Wilson' },
          ],
          skipDuplicates: true,
        });
      }

      // Seed default cronjob configs if table is empty
      const cronjobCount = await prisma.cronjobConfig.count();
      if (cronjobCount === 0) {
        Logger.info('Seeding default cronjob configurations...');
        await prisma.cronjobConfig.createMany({
          data: [
            {
              id: 1,
              name: 'Morning Notification',
              enabled: true,
              scheduleTime: '09:00',
              webhookUrl: 'https://prod-56.southeastasia.logic.azure.com:443/workflows/8f1f48a580794efeb7f5363a94366e20/triggers/manual/paths/invoke?api-version=2016-06-01',
              notificationDays: 1,
            },
            {
              id: 2,
              name: 'Evening Notification',
              enabled: true,
              scheduleTime: '17:30',
              webhookUrl: 'https://prod-56.southeastasia.logic.azure.com:443/workflows/8f1f48a580794efeb7f5363a94366e20/triggers/manual/paths/invoke?api-version=2016-06-01',
              notificationDays: 0,
            },
          ],
          skipDuplicates: true,
        });
      }

      // Seed default admin PIN if table is empty
      const adminCount = await prisma.adminConfig.count();
      if (adminCount === 0) {
        Logger.info('Initializing default admin PIN...');
        const defaultPinHash = bcrypt.hashSync('000000', 10);
        await prisma.adminConfig.create({ data: { pin: defaultPinHash } });
      }

      // Reset PIN if env var is set
      if (process.env.RESET_PIN === 'TRUE') {
        Logger.info('RESET_PIN is set to TRUE. Resetting admin PIN to 000000...');
        const defaultPinHash = bcrypt.hashSync('000000', 10);
        await prisma.adminConfig.updateMany({ data: { pin: defaultPinHash } });
      }

      // Reset sequences so autoincrement continues from max(id)+1
      const tables = ['employees', 'cronjob_config', 'admin_config'];
      for (const table of tables) {
        try {
          await prisma.$executeRawUnsafe(
            `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)`
          );
        } catch {
          // Ignore if sequence doesn't exist
        }
      }

      Logger.info('Database seed completed successfully');
      return; // Success — exit the retry loop
    } catch (error) {
      Logger.error(`Failed to seed database (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt < maxRetries) {
        const delay = attempt * 3000;
        Logger.info(`Retrying database seed in ${delay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}

export default getPrisma;