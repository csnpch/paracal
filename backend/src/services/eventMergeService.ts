import { getPrisma } from "../database/connection";
import { EventService } from "./eventService";
import type { Event, LeaveDuration } from "../../../shared/types";
import moment from "moment";
import Logger from "../utils/logger";

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

// How far back/forward to scan for mergeable events. Bounds DB load to avoid
// loading the whole events table into memory on each cron tick.
const SCAN_PAST_DAYS = 365;
const SCAN_FUTURE_DAYS = 90;

export class EventMergeService {
  private get prisma() { return getPrisma(); }
  private eventService = new EventService();

  private canStartChain(d: LeaveDuration | undefined): boolean {
    return d === "full" || d === "afternoon" || d === undefined;
  }

  private canEndChain(d: LeaveDuration | undefined): boolean {
    return d === "full" || d === "morning" || d === undefined;
  }

  private isExtendableMiddle(d: LeaveDuration | undefined): boolean {
    return d === "full" || d === undefined;
  }

  private resolveRangeDuration(first: LeaveDuration | undefined, last: LeaveDuration | undefined): LeaveDuration {
    const startsHalf = first === "afternoon";
    const endsHalf = last === "morning";
    if (startsHalf && endsHalf) return "afternoon_morning";
    if (startsHalf) return "afternoon_full";
    if (endsHalf) return "full_morning";
    return "full";
  }

  private buildRangeDescription(startDate: string, endDate: string, sourceDescriptions: string[]): string {
    const startFmt = moment(startDate).format("DD/MM/YYYY");
    const endFmt = moment(endDate).format("DD/MM/YYYY");
    const prefix = `ช่วงวันที่: ${startFmt} - ${endFmt}`;
    const note = sourceDescriptions
      .map((d) => d.trim())
      .filter((d) => d.length > 0 && !d.startsWith("ช่วงวันที่:"))
      .find(Boolean);
    return note ? `${prefix} - ${note}` : prefix;
  }

  /**
   * Find all single-day events and group consecutive ones.
   * Honors leaveDuration so half-days don't merge across a day the user worked.
   */
  async findConsecutiveEvents(): Promise<EventGroup[]> {
    const today = moment().utcOffset("+07:00");
    const fromDate = today.clone().subtract(SCAN_PAST_DAYS, "days").format("YYYY-MM-DD");
    const toDate = today.clone().add(SCAN_FUTURE_DAYS, "days").format("YYYY-MM-DD");

    // The legacy `date` field is set iff startDate === endDate (eventService.computeLegacyDate).
    // Filtering on it lets Prisma return only single-day events.
    const rows = await this.prisma.event.findMany({
      where: {
        date: { not: null, gte: fromDate, lte: toDate },
      },
      orderBy: [{ employeeId: "asc" }, { leaveType: "asc" }, { startDate: "asc" }],
    });

    if (rows.length === 0) return [];

    // Pre-load company holidays once into a Set instead of querying per-day.
    const holidayRows = await this.prisma.companyHoliday.findMany({
      where: { date: { gte: fromDate, lte: toDate } },
      select: { date: true },
    });
    const holidaySet = new Set(holidayRows.map((h) => h.date));

    const isHoliday = (date: string): boolean => {
      const day = moment(date).day();
      if (day === 0 || day === 6) return true;
      return holidaySet.has(date);
    };

    const workingDaysBetween = (a: string, b: string): number => {
      let count = 0;
      const cur = moment(a).add(1, "day");
      const end = moment(b);
      while (cur.isBefore(end)) {
        if (!isHoliday(cur.format("YYYY-MM-DD"))) count++;
        cur.add(1, "day");
      }
      return count;
    };

    const events: Event[] = rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      leaveType: row.leaveType as Event["leaveType"],
      leaveDuration: (row.leaveDuration ?? undefined) as LeaveDuration | undefined,
      date: row.date ?? undefined,
      startDate: row.startDate!,
      endDate: row.endDate!,
      description: row.description ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    }));

    const grouped = new Map<string, Event[]>();
    for (const e of events) {
      const key = `${e.employeeId}-${e.leaveType}`;
      let list = grouped.get(key);
      if (!list) { list = []; grouped.set(key, list); }
      list.push(e);
    }

    const consecutiveGroups: EventGroup[] = [];

    for (const list of grouped.values()) {
      if (list.length < 2) continue;

      let chain: Event[] = [];

      const finalize = () => {
        if (chain.length >= 2) {
          const last = chain[chain.length - 1]!;
          if (this.canEndChain(last.leaveDuration)) {
            const head = chain[0]!;
            consecutiveGroups.push({
              employeeId: head.employeeId,
              employeeName: head.employeeName,
              leaveType: head.leaveType,
              events: chain,
            });
          }
        }
        chain = [];
      };

      for (const ev of list) {
        if (chain.length === 0) {
          if (this.canStartChain(ev.leaveDuration)) chain = [ev];
          continue;
        }
        const prev = chain[chain.length - 1]!;
        const continuous = workingDaysBetween(prev.startDate, ev.startDate) === 0;
        const prevExtendable = this.isExtendableMiddle(prev.leaveDuration) || (chain.length === 1 && this.canStartChain(prev.leaveDuration));
        const currMergeable = this.isExtendableMiddle(ev.leaveDuration) || this.canEndChain(ev.leaveDuration);
        if (continuous && prevExtendable && currMergeable) {
          chain.push(ev);
        } else {
          finalize();
          if (this.canStartChain(ev.leaveDuration)) chain = [ev];
        }
      }
      finalize();
    }

    return consecutiveGroups;
  }

  /**
   * Merge a group of consecutive events into a single range event
   */
  async mergeEventGroup(group: EventGroup): Promise<MergeResult> {
    const { employeeId, employeeName, leaveType, events } = group;

    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    if (!firstEvent || !lastEvent) {
      return { success: false, eventsCount: 0, startDate: "", endDate: "", error: "Missing start or end event" };
    }

    const startDate = firstEvent.startDate;
    const endDate = lastEvent.startDate;
    const leaveDuration = this.resolveRangeDuration(firstEvent.leaveDuration, lastEvent.leaveDuration);
    const description = this.buildRangeDescription(
      startDate,
      endDate,
      events.map((e) => e.description ?? "")
    );

    try {
      const newEvent = await this.eventService.createEvent({
        employeeId,
        leaveType: leaveType as Event["leaveType"],
        leaveDuration,
        startDate,
        endDate,
        description,
      });

      for (const event of events) {
        await this.eventService.deleteEvent(event.id);
      }

      Logger.info(
        `[EventMerge] Merged ${events.length} events → ${newEvent.id} (${employeeName}, ${leaveType}/${leaveDuration}, ${startDate}→${endDate})`
      );

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
