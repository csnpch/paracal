import { Elysia, t } from 'elysia';
import { getDatabase } from '../database/connection';
import bcrypt from 'bcryptjs';
import Logger from '../utils/logger';

export const authRoutes = new Elysia({ prefix: '/auth' })
  .post('/login', ({ body }) => {
    try {
      const db = getDatabase();
      const adminConfig = db.prepare("SELECT pin FROM admin_config ORDER BY id DESC LIMIT 1").get() as { pin: string } | undefined;
      
      if (!adminConfig) {
        return { success: false, message: 'Admin config not found' };
      }

      const isValid = bcrypt.compareSync(body.pin, adminConfig.pin);

      if (isValid) {
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
  .post('/change-pin', ({ body }) => {
    try {
      const db = getDatabase();
      const adminConfig = db.prepare("SELECT pin FROM admin_config ORDER BY id DESC LIMIT 1").get() as { pin: string } | undefined;
      
      if (!adminConfig) {
        return { success: false, message: 'Admin config not found' };
      }

      const isValid = bcrypt.compareSync(body.oldPin, adminConfig.pin);

      if (!isValid) {
        return { success: false, message: 'Invalid old PIN' };
      }

      const newPinHash = bcrypt.hashSync(body.newPin, 10);
      db.prepare("UPDATE admin_config SET pin = ?").run(newPinHash);

      Logger.info('Admin PIN changed successfully');
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
