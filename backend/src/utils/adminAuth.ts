import { getPrisma } from '../database/connection';
import bcrypt from 'bcryptjs';
import { assertAdminAuth } from './adminSession';

export { assertAdminAuth, getBearerToken, createAdminSession, isValidAdminSession, revokeAdminSession } from './adminSession';

export async function validateAdminPassword(pin: string | undefined): Promise<void> {
  if (!pin) throw new Error('Invalid PIN');

  const prisma = getPrisma();
  const adminConfig = await prisma.adminConfig.findFirst({ orderBy: { id: 'desc' } });

  if (!adminConfig) throw new Error('Admin config not found');

  const isValid = bcrypt.compareSync(pin, adminConfig.pin);
  if (!isValid) throw new Error('Invalid PIN');
}
