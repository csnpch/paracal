import type { Event } from '../types';
import { LEAVE_TYPE_LABELS } from '../../../shared/constants';
import type { LeaveType } from '../../../shared/types';
import config from '../config';
import axios from 'axios';
import Logger from '../utils/logger';

// ─── Types ───────────────────────────────────────────────────

export interface TeamsNotificationPayload {
  type: 'AdaptiveCard';
  attachments: Array<{
    contentType: 'application/vnd.microsoft.card.adaptive';
    contentUrl: null;
    content: {
      type: 'AdaptiveCard';
      body: Array<Record<string, any>>;
      actions?: Array<{ type: 'Action.OpenUrl'; title: string; url: string }>;
    };
  }>;
}

// ─── Helpers ─────────────────────────────────────────────────

function getLeaveTypeInThai(leaveType: string): string {
  return LEAVE_TYPE_LABELS[leaveType as LeaveType] || leaveType;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Bangkok',
  }).format(date);
}

function isValidWebhookResponse(webhookUrl: string, responseText: string, status: number): boolean {
  const validDomains = [
    'hooks.slack.com', 'outlook.office.com', 'hooks.teams.microsoft.com',
    'discord.com', 'discordapp.com', 'hooks.zapier.com', 'logic.azure.com', 'httpbin.org',
    'powerplatform.com',
  ];

  const urlDomain = new URL(webhookUrl).hostname;
  if (validDomains.some((d) => urlDomain.includes(d))) return true;

  if (status === 200) {
    const lower = responseText.toLowerCase();
    const invalidIndicators = ['<html', '<!doctype', '<head>', '<body>', '<title>', 'google', 'search', 'javascript', '<script', '<style'];
    if (invalidIndicators.some((i) => lower.includes(i))) return false;

    const validIndicators = ['success', 'accepted', 'received', 'ok', 'webhook', 'notification', 'message sent', 'delivered'];
    const hasValid = validIndicators.some((i) => lower.includes(i));
    const isShort = responseText.length < 100 && !lower.includes('<');
    return hasValid || isShort;
  }

  return false;
}

// ─── Event Grouping Helpers ──────────────────────────────────

function buildEventListByType(events: Event[]): string {
  const eventsByType = events.reduce((acc, event) => {
    const thaiType = getLeaveTypeInThai(event.leaveType || 'other');
    if (!acc[thaiType]) acc[thaiType] = [];
    acc[thaiType].push(event);
    return acc;
  }, {} as Record<string, Event[]>);

  let text = '';
  Object.entries(eventsByType).forEach(([type, typeEvents]) => {
    text += `\n- **${type}** (${typeEvents.length} คน):\n`;
    typeEvents.forEach((event) => {
      const name = event.employeeName || 'ไม่ระบุชื่อ';
      // For general list by type (daily notification on a specific day, assume `startDate` or just generally list its global status if start!=end)
      let durationLabel = '';
      let postfix = '';
      
      if (event.startDate !== event.endDate) {
         if (event.leaveDuration === 'afternoon_morning') postfix = ' (บ่ายวันเริ่ม-เช้าวันสิ้นสุด)';
         else if (event.leaveDuration === 'afternoon_full') postfix = ' (บ่ายวันเริ่ม-เต็มวันสิ้นสุด)';
         else if (event.leaveDuration === 'full_morning') postfix = ' (เต็มวันเริ่ม-เช้าวันสิ้นสุด)';
      } else {
         durationLabel = event.leaveDuration === 'morning' ? '🌤️ ' : event.leaveDuration === 'afternoon' ? '🌥️ ' : '';
         postfix = event.leaveDuration === 'morning' ? ' (ครึ่งเช้า)' : event.leaveDuration === 'afternoon' ? ' (ครึ่งบ่าย)' : '';
      }
      
      text += event.description?.trim() ? `  - ${durationLabel}${name}${postfix} - * ${event.description} *\n` : `  - ${durationLabel}${name}${postfix}\n`;
    });
  });
  return text;
}

function buildEventListByDate(events: Event[]): string {
  const eventsByDate = events.reduce((acc, event) => {
    const eventDate = event.startDate || event.date;
    if (!eventDate) return acc;
    if (!acc[eventDate]) acc[eventDate] = {};
    const thaiType = getLeaveTypeInThai(event.leaveType || 'other');
    if (!acc[eventDate]![thaiType]) acc[eventDate]![thaiType] = [];
    acc[eventDate]![thaiType]!.push(event);
    return acc;
  }, {} as Record<string, Record<string, Event[]>>);

  let text = '';
  Object.entries(eventsByDate).sort().forEach(([date, dateEvents]) => {
    const dateFormatted = formatDate(date);
    const dayEvents = Object.values(dateEvents).flat();
    text += `\n**📅 ${dateFormatted}** (${dayEvents.length} เหตุการณ์):\n`;

    Object.entries(dateEvents).forEach(([type, typeEvents]) => {
      text += `- **${type}** (${typeEvents.length} คน):\n`;
      typeEvents.forEach((event) => {
        const name = event.employeeName || 'ไม่ระบุชื่อ';
        
        let isMorningOnThisDate = event.leaveDuration === 'morning';
        let isAfternoonOnThisDate = event.leaveDuration === 'afternoon';
        
        if (event.startDate !== event.endDate) {
          if ((event.leaveDuration === 'full_morning' || event.leaveDuration === 'afternoon_morning') && date === event.endDate) {
            isMorningOnThisDate = true;
          }
          if ((event.leaveDuration === 'afternoon_full' || event.leaveDuration === 'afternoon_morning') && date === event.startDate) {
            isAfternoonOnThisDate = true;
          }
        }

        const durationLabel = isMorningOnThisDate ? '🌤️ ' : isAfternoonOnThisDate ? '🌥️ ' : '';
        const postfix = isMorningOnThisDate ? ' (ครึ่งเช้า)' : isAfternoonOnThisDate ? ' (ครึ่งบ่าย)' : '';
        
        text += event.description?.trim() ? `  - ${durationLabel}${name}${postfix} - *${event.description}*\n` : `  - ${durationLabel}${name}${postfix}\n`;
      });
    });
  });
  return text;
}

// ─── Adaptive Card Builder ───────────────────────────────────

function createAdaptiveCard(headerText: string, summaryText: string, eventListText: string, customMessage?: string): TeamsNotificationPayload {
  const appUrl = config.appUrl;
  const appName = config.appName;

  const bodyItems: Array<Record<string, any>> = [
    { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: `✳ **${appName}**` },
  ];

  if (customMessage) {
    bodyItems.push({
      type: 'TextBlock',
      spacing: 'Medium',
      text: `📢 ${customMessage}`,
      wrap: true,
      color: 'attention',
      weight: 'Bolder'
    });
  } else if (!eventListText) {
    // No events card
    const items: Array<Record<string, any>> = [
      { type: 'TextBlock', spacing: 'None', text: headerText, wrap: true, color: 'good', weight: 'Bolder' },
      { type: 'TextBlock', spacing: 'None', text: summaryText, wrap: true, color: 'accent' }
    ];

    bodyItems.push({
      type: 'ColumnSet',
      columns: [{
        type: 'Column', width: 'stretch',
        items,
      }],
    });
  } else {
    // Has events card
    const items: Array<Record<string, any>> = [
      { type: 'TextBlock', spacing: 'None', text: headerText, wrap: true, color: 'default', weight: 'Bolder' },
      { type: 'TextBlock', spacing: 'None', text: summaryText.trim(), wrap: true, color: 'default' },
      { type: 'TextBlock', spacing: 'None', text: eventListText.trim(), wrap: true, color: 'default' }
    ];

    bodyItems.push({
      type: 'ColumnSet',
      columns: [{
        type: 'Column', width: 'stretch',
        items,
      }],
    });
  }

  return {
    type: 'AdaptiveCard',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      contentUrl: null,
      content: {
        type: 'AdaptiveCard',
        body: bodyItems,
        actions: [{ type: 'Action.OpenUrl', title: `Open ${appName}`, url: `${appUrl}/` }],
      },
    }],
  };
}

// ─── Public API ──────────────────────────────────────────────

export class NotificationService {
  /**
   * Create daily notification payload.
   */
  static createDailyPayload(events: Event[], notificationDate: string, notificationDays: number, customMessage?: string): TeamsNotificationPayload {
    let dateLabel: string;
    if (notificationDays === 0) dateLabel = 'วันนี้';
    else if (notificationDays === 1) dateLabel = 'พรุ่งนี้';
    else if (notificationDays === 7) dateLabel = '1 สัปดาห์ข้างหน้า';
    else dateLabel = `${notificationDays} วันข้างหน้า`;

    const dateFormatted = formatDate(notificationDate);
    const headerText = `📅 แจ้งเตือนปฏิทิน - ${dateLabel}`;

    if (events.length === 0) {
      return createAdaptiveCard(headerText, `${dateFormatted} | ไม่มีเหตุการณ์${dateLabel} ✅`, '', customMessage);
    }

    const summaryText = `**${dateFormatted}** | **${events.length} เหตุการณ์**`;
    const eventListText = buildEventListByType(events);
    return createAdaptiveCard(headerText, summaryText, eventListText, customMessage);
  }

  /**
   * Create weekly notification payload.
   */
  static createWeeklyPayload(events: Event[], startDate: string, endDate: string, scope: 'current' | 'next', customMessage?: string): TeamsNotificationPayload {
    const startFormatted = formatDate(startDate);
    const endFormatted = formatDate(endDate);
    const scopeText = scope === 'current' ? 'สัปดาห์นี้' : 'สัปดาห์หน้า';
    const headerText = `📅 แจ้งเตือนปฏิทิน - ${scopeText}`;

    if (events.length === 0) {
      return createAdaptiveCard(headerText, `${startFormatted} - ${endFormatted} | ไม่มีเหตุการณ์${scopeText} ✅`, '', customMessage);
    }

    const summaryText = `**${startFormatted} - ${endFormatted}** | **${events.length} เหตุการณ์**`;
    const eventListText = buildEventListByDate(events);
    return createAdaptiveCard(headerText, summaryText, eventListText, customMessage);
  }

  /**
   * Send a payload to a webhook URL with detailed error reporting.
   */
  static async sendNotification(webhookUrl: string, payload: TeamsNotificationPayload): Promise<{ success: boolean; error?: string }> {
    try {
      Logger.debug(`Sending notification to: ${webhookUrl}`);
      const response = await axios.post(webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
      });

      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      if (!isValidWebhookResponse(webhookUrl, responseText, response.status)) {
        const errorMessage = `Invalid webhook endpoint: ${webhookUrl} does not appear to be a valid webhook. Response: ${responseText.substring(0, 200)}`;
        Logger.error('Invalid webhook endpoint:', errorMessage);
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (error: any) {
      if (error.response) {
        if (error.response.status === 405) return { success: false, error: `Method not allowed: ${webhookUrl} (405)` };
        if (error.response.status === 404) return { success: false, error: `Not found: ${webhookUrl} (404)` };

        const responseText = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
        return { success: false, error: `Webhook failed with status ${error.response.status}: ${responseText}` };
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
      Logger.error('Error sending notification:', error);
      return { success: false, error: `Network error: ${errorMessage}` };
    }
  }

  /**
   * Convenience: create daily payload + send.
   */
  static async sendDailyNotification(
    events: Event[], webhookUrl: string, notificationDate: string, notificationDays: number, customMessage?: string
  ): Promise<{ success: boolean; error?: string }> {
    const payload = this.createDailyPayload(events, notificationDate, notificationDays, customMessage);
    return this.sendNotification(webhookUrl, payload);
  }

  /**
   * Convenience: create weekly payload + send.
   */
  static async sendWeeklyNotification(
    events: Event[], webhookUrl: string, startDate: string, endDate: string, scope: 'current' | 'next', customMessage?: string
  ): Promise<{ success: boolean; error?: string }> {
    const payload = this.createWeeklyPayload(events, startDate, endDate, scope, customMessage);
    return this.sendNotification(webhookUrl, payload);
  }
}