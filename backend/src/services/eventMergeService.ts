import { getPrisma } from "../database/connection";
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
const SUPPORTED_DURATIONS = new Set<LeaveDuration>([
  "full", "morning", "afternoon", "afternoon_full", "full_morning", "afternoon_morning",
]);

export class EventMergeService {
  private get prisma() { return getPrisma(); }

  private startsAfternoon(d: LeaveDuration | undefined): boolean {
    return d === "afternoon" || d === "afternoon_full" || d === "afternoon_morning";
  }

  private endsMorning(d: LeaveDuration | undefined): boolean {
    return d === "morning" || d === "full_morning" || d === "afternoon_morning";
  }

  private resolveRangeDuration(first: LeaveDuration | undefined, last: LeaveDuration | undefined): LeaveDuration {
    const startsHalf = this.startsAfternoon(first);
    const endsHalf = this.endsMorning(last);
    if (startsHalf && endsHalf) return "afternoon_morning";
    if (startsHalf) return "afternoon_full";
    if (endsHalf) return "full_morning";
    return "full";
  }

  private buildRangeDescription(startDate: string, endDate: string, sourceDescriptions: string[]): string {
    const startFmt = moment(startDate).format("DD/MM/YYYY");
    const endFmt = moment(endDate).format("DD/MM/YYYY");
    const prefix = `ช่วงวันที่: ${startFmt} - ${endFmt}`;
    const note = [...new Set(sourceDescriptions
      .map((d) => d.trim().replace(/^ช่วงวันที่:\s*\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4}(?:\s*-\s*)?/, ""))
      .flatMap((d) => d.split("\n").map((line) => line.trim()))
      .filter(Boolean))].join("\n");
    return note ? `${prefix} - ${note}` : prefix;
  }

  /**
   * Group single-day and range events whose leave is continuous.
   * Honors leaveDuration so half-days don't merge across a day the user worked.
   */
  async findConsecutiveEvents(): Promise<EventGroup[]> {
    const today = moment().utcOffset("+07:00");
    const fromDate = today.clone().subtract(SCAN_PAST_DAYS, "days").format("YYYY-MM-DD");
    const toDate = today.clone().add(SCAN_FUTURE_DAYS, "days").format("YYYY-MM-DD");

    // Ranges have no legacy `date`. Include any range overlapping the scan
    // window, as well as older records that only carry the legacy date.
    const rows = await this.prisma.event.findMany({
      where: {
        OR: [
          { startDate: { lte: toDate }, endDate: { gte: fromDate } },
          { date: { gte: fromDate, lte: toDate } },
        ],
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
      startDate: row.startDate ?? row.date ?? "",
      endDate: row.endDate ?? row.date ?? "",
      description: row.description ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    })).filter((e) => (e.leaveDuration === undefined || SUPPORTED_DURATIONS.has(e.leaveDuration))
      && moment(e.startDate, "YYYY-MM-DD", true).isValid()
      && moment(e.endDate, "YYYY-MM-DD", true).isValid() && e.startDate <= e.endDate);

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
      list.sort((a, b) => a.startDate.localeCompare(b.startDate)
        || Number(this.startsAfternoon(a.leaveDuration)) - Number(this.startsAfternoon(b.leaveDuration))
        || a.endDate.localeCompare(b.endDate) || a.id - b.id);

      let chain: Event[] = [];

      const finalize = () => {
        if (chain.length >= 2) {
          const head = chain[0]!;
          consecutiveGroups.push({
            employeeId: head.employeeId,
            employeeName: head.employeeName,
            leaveType: head.leaveType,
            events: chain,
          });
        }
        chain = [];
      };

      for (const ev of list) {
        if (chain.length === 0) {
          chain = [ev];
          continue;
        }
        const prev = chain[chain.length - 1]!;
        const continuous = prev.endDate === ev.startDate
          ? this.endsMorning(prev.leaveDuration) && this.startsAfternoon(ev.leaveDuration)
          : prev.endDate < ev.startDate
            && (!this.endsMorning(prev.leaveDuration) || isHoliday(prev.endDate))
            && (!this.startsAfternoon(ev.leaveDuration) || isHoliday(ev.startDate))
            && workingDaysBetween(prev.endDate, ev.startDate) === 0;
        if (continuous) {
          chain.push(ev);
        } else {
          finalize();
          chain = [ev];
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
    if (!firstEvent || !lastEvent || events.length < 2 || new Set(events.map((e) => e.id)).size !== events.length) {
      return { success: false, eventsCount: 0, startDate: "", endDate: "", error: "A merge requires at least two distinct events" };
    }

    const startDate = firstEvent.startDate;
    const endDate = lastEvent.endDate;
    const leaveDuration = this.resolveRangeDuration(firstEvent.leaveDuration, lastEvent.leaveDuration);
    const description = this.buildRangeDescription(
      startDate,
      endDate,
      events.map((e) => e.description ?? "")
    );

    try {
      const newEvent = await this.prisma.$transaction(async (tx) => {
        const sources = await tx.event.findMany({ where: { id: { in: events.map((e) => e.id) } } });
        const unchanged = sources.length === events.length && events.every((e) => {
          const row = sources.find((r) => r.id === e.id);
          return row && row.employeeId === employeeId && e.employeeId === employeeId
            && row.leaveType === leaveType && e.leaveType === leaveType
            && row.employeeName === e.employeeName
            && (row.startDate ?? row.date) === e.startDate && (row.endDate ?? row.date) === e.endDate
            && (row.date ?? undefined) === e.date
            && (row.leaveDuration ?? "full") === (e.leaveDuration ?? "full")
            && (row.description ?? undefined) === e.description
            && row.updatedAt.toISOString() === e.updatedAt;
        });
        if (!unchanged) throw new Error("Source events changed after scanning; merge skipped");

        // Match the snapshots as well as IDs so a concurrent edit or merge
        // cannot be deleted. Any mismatch rolls back the whole transaction.
        const deleted = await tx.event.deleteMany({ where: { OR: sources.map((row) => ({
          id: row.id, employeeId: row.employeeId, employeeName: row.employeeName,
          leaveType: row.leaveType, leaveDuration: row.leaveDuration,
          date: row.date, startDate: row.startDate, endDate: row.endDate,
          description: row.description, updatedAt: row.updatedAt,
        })) } });
        if (deleted.count !== events.length) throw new Error("Source events changed during merge");

        const employee = await tx.employee.findUnique({ where: { id: employeeId }, select: { name: true } });
        if (!employee) throw new Error(`Employee with id ${employeeId} not found`);
        return tx.event.create({ data: {
          employeeId, employeeName: employee.name, leaveType, leaveDuration,
          startDate, endDate, date: startDate === endDate ? startDate : null, description,
        } });
      }, { isolationLevel: "Serializable" });

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
      if (failCount > 0) throw new Error(`Event merge job failed for ${failCount} group(s)`);
    } catch (error) {
      Logger.error("[EventMerge] Error during merge job execution:", error);
      throw error;
    }
  }
}
