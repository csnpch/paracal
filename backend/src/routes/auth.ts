import { Elysia, t } from 'elysia';
import { getPrisma } from '../database/connection';
import { logService } from '../services/logService';
import bcrypt from 'bcryptjs';
import Logger from '../utils/logger';

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
        await logService.writeLog({ action: 'LOGIN', entity: 'admin', detail: 'Admin logged in' });
        return { success: true };
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
  .post('/change-pin', async ({ body }) => {
    try {
      const prisma = getPrisma();
      const adminConfig = await prisma.adminConfig.findFirst({ orderBy: { id: 'desc' } });
      
      if (!adminConfig) {
        return { success: false, message: 'Admin config not found' };
      }

      const isValid = bcrypt.compareSync(body.oldPin, adminConfig.pin);

      if (!isValid) {
        return { success: false, message: 'Invalid old PIN' };
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
      Logger.error('Change PIN error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }, {
    body: t.Object({
      oldPin: t.String(),
      newPin: t.String()
    })
  });
