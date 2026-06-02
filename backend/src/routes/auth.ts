import { Elysia, t } from 'elysia';
import { getPrisma } from '../database/connection';
import { logService } from '../services/logService';
import bcrypt from 'bcryptjs';
import Logger from '../utils/logger';
import {
  assertAdminAuth,
  createAdminSession,
  getBearerToken,
  isValidAdminSession,
  revokeAdminSession,
} from '../utils/adminSession';

const DEFAULT_ADMIN_PIN = '000000';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .post('/login', async ({ body }) => {
    try {
      const prisma = getPrisma();
      const adminConfig = await prisma.adminConfig.findFirst({ orderBy: { id: 'desc' } });
      
      if (!adminConfig) {
        return { success: false, message: 'Admin config not found' };
      }

      const isValid = bcrypt.compareSync(body.pin, adminConfig.pin);

      if (isValid) {
        const token = createAdminSession();
        await logService.writeLog({ action: 'LOGIN', entity: 'admin', detail: 'Admin logged in' });
        return { success: true, token };
      } else {
        return { success: false, message: 'Invalid PIN' };
      }
    } catch (error) {
      Logger.error('Login error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }, {
    body: t.Object({
      pin: t.String()
    })
  })
  .post('/change-pin', async ({ body, headers }) => {
    try {
      assertAdminAuth(headers.authorization);
      const prisma = getPrisma();
      const adminConfig = await prisma.adminConfig.findFirst({ orderBy: { id: 'desc' } });
      
      if (!adminConfig) {
        return { success: false, message: 'Admin config not found' };
      }

      const newPinHash = bcrypt.hashSync(body.newPin, 10);
      await prisma.adminConfig.update({
        where: { id: adminConfig.id },
        data: { pin: newPinHash },
      });

      Logger.info('Admin PIN changed successfully');
      await logService.writeLog({ action: 'CHANGE_PIN', entity: 'admin', detail: 'Admin PIN changed' });
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        return { success: false, message: 'Unauthorized' };
      }
      Logger.error('Change PIN error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }, {
    body: t.Object({
      newPin: t.String()
    })
  })
  .post('/reset-pin', async ({ body, headers }) => {
    try {
      assertAdminAuth(headers.authorization);

      const prisma = getPrisma();
      const adminConfig = await prisma.adminConfig.findFirst({ orderBy: { id: 'desc' } });

      if (!adminConfig) {
        return { success: false, message: 'Admin config not found' };
      }

      const isValid = bcrypt.compareSync(body.pin, adminConfig.pin);
      if (!isValid) {
        return { success: false, message: 'Invalid PIN' };
      }

      const defaultPinHash = bcrypt.hashSync(DEFAULT_ADMIN_PIN, 10);
      await prisma.adminConfig.update({
        where: { id: adminConfig.id },
        data: { pin: defaultPinHash },
      });

      Logger.info('Admin PIN reset to default');
      await logService.writeLog({ action: 'RESET_PIN', entity: 'admin', detail: 'Admin PIN reset to default' });
      return { success: true, defaultPin: DEFAULT_ADMIN_PIN };
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        return { success: false, message: 'Unauthorized' };
      }
      Logger.error('Reset PIN error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }, {
    body: t.Object({
      pin: t.String(),
    }),
  })
  .get('/verify', ({ headers }) => {
    const token = getBearerToken(headers.authorization);
    return { success: isValidAdminSession(token) };
  })
  .post('/logout', ({ headers }) => {
    revokeAdminSession(getBearerToken(headers.authorization));
    return { success: true };
  });
