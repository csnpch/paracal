import moment from 'moment';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '../generated/prisma/client';
import type { Event, EventNotificationResult } from '../../../shared/types';
import { getPrisma } from '../database/connection';
import { NotificationService, type TeamsNotificationPayload } from './notificationService';
import Logger from '../utils/logger';

export class EventNotificationError extends Error {
  constructor(message: string, public status: 400 | 404) { super(message); }
}
export class EventNotificationService {
  constructor(private database?: PrismaClient,
    private send = (url: string, payload: TeamsNotificationPayload) => NotificationService.sendNotification(url, payload)) {}
  private get prisma() { return this.database ?? getPrisma(); }

  async notify(eventId: number): Promise<EventNotificationResult> {
    const today = moment().utcOffset('+07:00').format('YYYY-MM-DD');
    const delivery = await this.prisma.$transaction(async tx => {
      const event = await tx.event.findUnique({ where: { id: eventId } });
      if (!event) throw new EventNotificationError('Event not found', 404);
      const start = event.startDate ?? event.date;
      const end = event.endDate ?? event.date;
      if (!start || !end || start > today || end < today) throw new EventNotificationError('Event does not include today', 400);
      const targets = await tx.cronjobConfig.findMany({ where: { enabled: true }, orderBy: { id: 'asc' } });
      const destinations = [...new Set(targets.map(t => t.webhookUrl))];
      const claimed = [];
      for (const url of destinations) {
        const webhookKey = createHash('sha256').update(url).digest('hex');
        const claim = await tx.eventNotificationDelivery.createMany({ data: { eventId, webhookKey }, skipDuplicates: true });
        if (claim.count) claimed.push({ url, webhookKey });
      }
      return { event, destinations, claimed };
    }, { timeout: 30000 });
    const saved: Event = { ...delivery.event, startDate: delivery.event.startDate ?? delivery.event.date ?? '',
      endDate: delivery.event.endDate ?? delivery.event.date ?? '', date: delivery.event.date ?? undefined,
      description: delivery.event.description ?? undefined, leaveType: delivery.event.leaveType as Event['leaveType'],
      leaveDuration: delivery.event.leaveDuration as Event['leaveDuration'], createdAt: delivery.event.createdAt.toISOString(), updatedAt: delivery.event.updatedAt.toISOString() };
    const payload = NotificationService.createDailyPayload([saved], today, 0);
    const result = { sent: 0, failed: 0, alreadyClaimed: delivery.destinations.length - delivery.claimed.length, total: delivery.destinations.length };
    // Durable claims precede external sends; uncertain outcomes never retry automatically.
    for (const { url, webhookKey } of delivery.claimed) {
      let success = false;
      try { success = (await this.send(url, payload)).success; }
      catch { Logger.error(`Immediate event notification failed for event ${eventId}`); }
      result[success ? 'sent' : 'failed']++;
      await this.prisma.eventNotificationDelivery.updateMany({ where: { eventId, webhookKey }, data: { status: success ? 'sent' : 'failed' } });
    }
    return result;
  }
}
