import { getPrisma } from "../database/connection";
import { EventService } from "./eventService";
import type { Event } from "../types";
import moment from "moment";
import Logger from "../utils/logger";
import { CompanyHolidayService } from "./companyHolidayService";

interface EventGroup {
  employeeId: number;
  employeeName: string;
  leaveType: string;
  events: Event[];
}

interface MergeResult {
  success: boolean;
  eventsCount: number;
  startDate: string;
  endDate: string;
  error?: string;
}

export class EventMergeService {
  private get prisma() { return getPrisma(); }
  private eventService = new EventService();
  private companyHolidayService = new CompanyHolidayService();

  /**
   * Check if a given date is a holiday (weekend or company holiday)
   */
  private async isHoliday(date: string): Promise<boolean> {
    const momentDate = moment(date);
    const dayOfWeek = momentDate.day();

    // Check weekend (Saturday=6, Sunday=0)
    if (dayOfWeek === 0 || dayOfWeek === 6) return true;

    // Check company holiday
    return await this.companyHolidayService.isCompanyHoliday(date);
  }

  /**
   * Count working days between two dates (excluding the dates themselves)
   */
  private async countWorkingDaysBetween(startDate: string, endDate: string): Promise<number> {
    const start = moment(startDate);
    const end = moment(endDate);

    let workingDays = 0;
    const current = start.clone().add(1, "day");

    while (current.isBefore(end)) {
      const dateStr = current.format("YYYY-MM-DD");
      if (!(await this.isHoliday(dateStr))) {
        workingDays++;
      }
      current.add(1, "day");
    }

    return workingDays;
  }

  /**
   * Find all single-day events and group them
   */
  async findConsecutiveEvents(): Promise<EventGroup[]> {
    const singleDayEvents = await this.prisma.event.findMany({
      where: {
        startDate: { not: null },
        endDate: { not: null },
      },
      orderBy: [{ employeeId: 'asc' }, { leaveType: 'asc' }, { startDate: 'asc' }],
    });

    // Filter single-day events in JS (startDate === endDate)
    const filtered = singleDayEvents
      .filter((e) => e.startDate === e.endDate)
      .map((row): Event => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        leaveType: row.leaveType as import('../types').LeaveType,
        date: row.date ?? undefined,
        startDate: row.startDate!,
        endDate: row.endDate!,
        description: row.description ?? undefined,
        createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
      }));

    if (filtered.length === 0) return [];

    // Group by employeeId + leaveType
    const grouped = new Map<string, Event[]>();
    for (const event of filtered) {
      const key = `${event.employeeId}-${event.leaveType}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(event);
    }

    // Find consecutive sequences within each group
    const consecutiveGroups: EventGroup[] = [];

    for (const [key, events] of grouped.entries()) {
      if (events.length < 2) continue;

      const firstEvent = events[0];
      if (!firstEvent) continue;

      let currentGroup: Event[] = [firstEvent];

      for (let i = 1; i < events.length; i++) {
        const prevEvent = events[i - 1];
        const currEvent = events[i];
        if (!prevEvent || !currEvent) continue;

        const workingDaysBetween = await this.countWorkingDaysBetween(prevEvent.startDate, currEvent.startDate);

        if (workingDaysBetween === 0) {
          currentGroup.push(currEvent);
        } else {
          if (currentGroup.length >= 2) {
            const groupFirst = currentGroup[0];
            if (groupFirst) {
              consecutiveGroups.push({
                employeeId: groupFirst.employeeId,
                employeeName: groupFirst.employeeName,
                leaveType: groupFirst.leaveType,
                events: [...currentGroup],
              });
            }
          }
          currentGroup = [currEvent];
        }
      }

      if (currentGroup.length >= 2) {
        const groupFirst = currentGroup[0];
        if (groupFirst) {
          consecutiveGroups.push({
            employeeId: groupFirst.employeeId,
            employeeName: groupFirst.employeeName,
            leaveType: groupFirst.leaveType,
            events: [...currentGroup],
          });
        }
      }
    }

    return consecutiveGroups;
  }

  /**
   * Merge a group of consecutive events into a single range event
   */
  async mergeEventGroup(group: EventGroup): Promise<MergeResult> {
    const { employeeId, employeeName, leaveType, events } = group;

    const allSameEmployee = events.every((e) => e.employeeId === employeeId);
    const allSameType = events.every((e) => e.leaveType === leaveType);

    if (!allSameEmployee || !allSameType) {
      return { success: false, eventsCount: 0, startDate: "", endDate: "", error: "Events do not have matching employee or leave type" };
    }

    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    if (!firstEvent || !lastEvent) {
      return { success: false, eventsCount: 0, startDate: "", endDate: "", error: "Missing start or end event" };
    }

    const startDate = firstEvent.startDate;
    const endDate = lastEvent.startDate;
    const description = events.find((e) => e.description)?.description || null;

    try {
      const newEvent = await this.eventService.createEvent({
        employeeId,
        leaveType: leaveType as any,
        startDate,
        endDate,
        description: description || undefined,
      });

      Logger.info(`[EventMerge] Created range event ${newEvent.id} for ${employeeName} (${leaveType}, ${startDate} to ${endDate})`);

      for (const event of events) {
        await this.eventService.deleteEvent(event.id);
      }

      Logger.info(`[EventMerge] Deleted ${events.length} individual events for merge`);

      return { success: true, eventsCount: events.length, startDate, endDate };
    } catch (error) {
      Logger.error("[EventMerge] Error merging event group:", error);
      return { success: false, eventsCount: 0, startDate, endDate, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }

  /**
   * Main method to execute the merge job
   */
  async executeMergeJob(): Promise<void> {
    const startTime = moment().utcOffset("+07:00").format("YYYY-MM-DD HH:mm:ss");
    Logger.info(`[EventMerge] Starting merge job at ${startTime}`);

    try {
      const groups = await this.findConsecutiveEvents();

      if (groups.length === 0) {
        Logger.info("[EventMerge] No consecutive events found to merge");
        return;
      }

      Logger.info(`[EventMerge] Found ${groups.length} group(s) to merge`);

      let totalEvents = 0;
      let successCount = 0;
      let failCount = 0;

      for (const group of groups) {
        const result = await this.mergeEventGroup(group);

        if (result.success) {
          successCount++;
          totalEvents += result.eventsCount;
          Logger.info(
            `[EventMerge] Merged ${result.eventsCount} events for ${group.employeeName} ` +
            `(${group.leaveType}, ${moment(result.startDate).format("DD/MM")}-${moment(result.endDate).format("DD/MM")})`
          );
        } else {
          failCount++;
          Logger.error(`[EventMerge] Failed to merge group for ${group.employeeName}: ${result.error}`);
        }
      }

      Logger.info(
        `[EventMerge] Merge job completed: ${successCount} groups merged, ${totalEvents} events consolidated, ${failCount} failures`
      );
    } catch (error) {
      Logger.error("[EventMerge] Error during merge job execution:", error);
    }
  }
}
