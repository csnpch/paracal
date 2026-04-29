import { describe, test, expect } from "bun:test";
import { EventMergeService } from "../../src/services/eventMergeService";
import type { LeaveDuration } from "../../../shared/types";

const svc = new EventMergeService() as any;

describe("EventMergeService.resolveRangeDuration", () => {
  const cases: Array<[LeaveDuration | undefined, LeaveDuration | undefined, LeaveDuration]> = [
    ["full", "full", "full"],
    ["afternoon", "full", "afternoon_full"],
    ["full", "morning", "full_morning"],
    ["afternoon", "morning", "afternoon_morning"],
    [undefined, undefined, "full"],
    [undefined, "morning", "full_morning"],
    ["afternoon", undefined, "afternoon_full"],
  ];

  for (const [first, last, expected] of cases) {
    test(`first=${first ?? "∅"} last=${last ?? "∅"} → ${expected}`, () => {
      expect(svc.resolveRangeDuration(first, last)).toBe(expected);
    });
  }
});

describe("EventMergeService.buildRangeDescription", () => {
  test("without note returns prefix only", () => {
    const out = svc.buildRangeDescription("2026-04-16", "2026-04-17", []);
    expect(out).toBe("ช่วงวันที่: 16/04/2026 - 17/04/2026");
  });

  test("with single note appends note", () => {
    const out = svc.buildRangeDescription("2026-04-16", "2026-04-17", ["ลาพักร้อน"]);
    expect(out).toBe("ช่วงวันที่: 16/04/2026 - 17/04/2026 - ลาพักร้อน");
  });

  test("ignores empty/whitespace descriptions", () => {
    const out = svc.buildRangeDescription("2026-04-16", "2026-04-17", ["", "   ", "ลากิจ"]);
    expect(out).toBe("ช่วงวันที่: 16/04/2026 - 17/04/2026 - ลากิจ");
  });

  test("strips already-prefixed source descriptions to avoid double prefix", () => {
    const out = svc.buildRangeDescription("2026-04-16", "2026-04-17", [
      "ช่วงวันที่: 16/04/2026 - 16/04/2026",
      "ลาพักร้อน",
    ]);
    expect(out).toBe("ช่วงวันที่: 16/04/2026 - 17/04/2026 - ลาพักร้อน");
  });

  test("uses first non-empty non-prefixed note", () => {
    const out = svc.buildRangeDescription("2026-04-16", "2026-04-18", [
      "First reason",
      "Second reason",
    ]);
    expect(out).toBe("ช่วงวันที่: 16/04/2026 - 18/04/2026 - First reason");
  });
});

describe("EventMergeService.findConsecutiveEvents (chain detection)", () => {
  const today = new Date();
  const baseEvent = (overrides: any) => ({
    id: 0,
    employeeId: 1,
    employeeName: "Alice",
    leaveType: "vacation",
    leaveDuration: "full",
    description: null,
    createdAt: today,
    updatedAt: today,
    ...overrides,
    date: overrides.startDate, // legacy field
    endDate: overrides.startDate, // single-day events
  });

  const buildSvc = (events: any[], holidays: string[] = []) => {
    const fakePrisma = {
      event: { findMany: async () => events },
      companyHoliday: { findMany: async () => holidays.map((d) => ({ date: d })) },
    };
    const s = new EventMergeService() as any;
    Object.defineProperty(s, "prisma", { get: () => fakePrisma, configurable: true });
    return s;
  };

  test("merges two adjacent weekday full-day events", async () => {
    const s = buildSvc([
      baseEvent({ id: 1, startDate: "2026-04-20" }), // Mon
      baseEvent({ id: 2, startDate: "2026-04-21" }), // Tue
    ]);
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(1);
    expect(groups[0].events.length).toBe(2);
  });

  test("merges across weekend (Fri + Mon)", async () => {
    const s = buildSvc([
      baseEvent({ id: 1, startDate: "2026-04-17" }), // Fri
      baseEvent({ id: 2, startDate: "2026-04-20" }), // Mon
    ]);
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(1);
    expect(groups[0].events.length).toBe(2);
  });

  test("merges across company holiday", async () => {
    const s = buildSvc(
      [
        baseEvent({ id: 1, startDate: "2026-04-20" }), // Mon
        baseEvent({ id: 2, startDate: "2026-04-22" }), // Wed (Tue is holiday)
      ],
      ["2026-04-21"]
    );
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(1);
    expect(groups[0].events.length).toBe(2);
  });

  test("does NOT merge when a working day sits between", async () => {
    const s = buildSvc([
      baseEvent({ id: 1, startDate: "2026-04-20" }), // Mon
      baseEvent({ id: 2, startDate: "2026-04-22" }), // Wed (Tue is a working day)
    ]);
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(0);
  });

  test("does NOT merge across different leaveType", async () => {
    const s = buildSvc([
      baseEvent({ id: 1, startDate: "2026-04-20", leaveType: "vacation" }),
      baseEvent({ id: 2, startDate: "2026-04-21", leaveType: "sick" }),
    ]);
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(0);
  });

  test("merges Mon-afternoon + Tue-full into afternoon_full chain", async () => {
    const s = buildSvc([
      baseEvent({ id: 1, startDate: "2026-04-20", leaveDuration: "afternoon" }),
      baseEvent({ id: 2, startDate: "2026-04-21", leaveDuration: "full" }),
    ]);
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(1);
    const ev = groups[0].events;
    expect(ev[0].leaveDuration).toBe("afternoon");
    expect(ev[ev.length - 1].leaveDuration).toBe("full");
  });

  test("does NOT merge Mon-morning + Tue-full (user worked Mon afternoon)", async () => {
    const s = buildSvc([
      baseEvent({ id: 1, startDate: "2026-04-20", leaveDuration: "morning" }),
      baseEvent({ id: 2, startDate: "2026-04-21", leaveDuration: "full" }),
    ]);
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(0);
  });

  test("does NOT merge Mon-full + Tue-afternoon (user worked Tue morning)", async () => {
    const s = buildSvc([
      baseEvent({ id: 1, startDate: "2026-04-20", leaveDuration: "full" }),
      baseEvent({ id: 2, startDate: "2026-04-21", leaveDuration: "afternoon" }),
    ]);
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(0);
  });

  test("merges full-afternoon-morning chain into afternoon_morning", async () => {
    const s = buildSvc([
      baseEvent({ id: 1, startDate: "2026-04-20", leaveDuration: "afternoon" }),
      baseEvent({ id: 2, startDate: "2026-04-21", leaveDuration: "full" }),
      baseEvent({ id: 3, startDate: "2026-04-22", leaveDuration: "morning" }),
    ]);
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(1);
    expect(groups[0].events.length).toBe(3);
  });

  test("rejects middle 'morning' (breaks continuity), no merge produced", async () => {
    const s = buildSvc([
      baseEvent({ id: 1, startDate: "2026-04-20", leaveDuration: "full" }),
      baseEvent({ id: 2, startDate: "2026-04-21", leaveDuration: "morning" }),
      baseEvent({ id: 3, startDate: "2026-04-22", leaveDuration: "full" }),
    ]);
    const groups = await s.findConsecutiveEvents();
    // First chain (Mon+Tue) ends at morning → emits as 2-day chain
    // Wed-full alone doesn't form a chain
    expect(groups.length).toBe(1);
    expect(groups[0].events.length).toBe(2);
  });

  test("separates chains by employee", async () => {
    const s = buildSvc([
      baseEvent({ id: 1, employeeId: 1, employeeName: "Alice", startDate: "2026-04-20" }),
      baseEvent({ id: 2, employeeId: 2, employeeName: "Bob", startDate: "2026-04-21" }),
    ]);
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(0);
  });

  test("ignores singleton (length < 2)", async () => {
    const s = buildSvc([baseEvent({ id: 1, startDate: "2026-04-20" })]);
    const groups = await s.findConsecutiveEvents();
    expect(groups.length).toBe(0);
  });
});

describe("EventMergeService chain validity helpers", () => {
  test("canStartChain accepts full/afternoon/undefined, rejects morning", () => {
    expect(svc.canStartChain("full")).toBe(true);
    expect(svc.canStartChain("afternoon")).toBe(true);
    expect(svc.canStartChain(undefined)).toBe(true);
    expect(svc.canStartChain("morning")).toBe(false);
  });

  test("canEndChain accepts full/morning/undefined, rejects afternoon", () => {
    expect(svc.canEndChain("full")).toBe(true);
    expect(svc.canEndChain("morning")).toBe(true);
    expect(svc.canEndChain(undefined)).toBe(true);
    expect(svc.canEndChain("afternoon")).toBe(false);
  });

  test("isExtendableMiddle only allows full/undefined", () => {
    expect(svc.isExtendableMiddle("full")).toBe(true);
    expect(svc.isExtendableMiddle(undefined)).toBe(true);
    expect(svc.isExtendableMiddle("morning")).toBe(false);
    expect(svc.isExtendableMiddle("afternoon")).toBe(false);
  });
});
