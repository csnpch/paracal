import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { createMergeDatabase } from '../helpers/mergeDatabase';
import type { LeaveDuration } from '../../../shared/types';
import moment from 'moment';
import Logger from '../../src/utils/logger';

describe('EventMergeService with PostgreSQL', () => {
  let fixture: Awaited<ReturnType<typeof createMergeDatabase>>;
  const originalNow = moment.now;
  const originalSilent = Logger.silent;
  beforeAll(async () => {
    moment.now = () => Date.parse('2026-10-02T12:00:00Z');
    Logger.silent = true;
    fixture = await createMergeDatabase();
  });
  beforeEach(async () => { await fixture.reset(); });
  afterAll(async () => {
    try { if (fixture) await fixture.close(); }
    finally { moment.now = originalNow; Logger.silent = originalSilent; }
  });

  const add = (startDate: string, endDate = startDate, leaveDuration: LeaveDuration = 'full', description?: string) =>
    fixture.events.createEvent({ employeeId: 1, leaveType: 'vacation', startDate, endDate, leaveDuration, description });

  test('Tan: Oct 20 afternoon joins the existing Oct 21–23 range', async () => {
    await add('2026-10-20', '2026-10-20', 'afternoon');
    await add('2026-10-21', '2026-10-23');
    const groups = await fixture.merger().findConsecutiveEvents();
    expect(groups).toHaveLength(1);
    expect(groups[0]!.events.map(e => [e.startDate, e.endDate])).toEqual([
      ['2026-10-20', '2026-10-20'], ['2026-10-21', '2026-10-23'],
    ]);
  });

  for (const [first, last, want] of [
    ['full', 'full', true],
    ['afternoon_full', 'full', true],
    ['full', 'full_morning', true],
    ['afternoon_full', 'full_morning', true],
    ['full_morning', 'full', false],
    ['afternoon_morning', 'full', false],
    ['full', 'afternoon_full', false],
    ['full', 'afternoon_morning', false],
  ] as const) {
    test(`adjacent ranges ${first} + ${last}: merge=${want}`, async () => {
      await add('2026-10-19', '2026-10-20', first);
      await add('2026-10-21', '2026-10-23', last);
      expect(await fixture.merger().findConsecutiveEvents()).toHaveLength(want ? 1 : 0);
    });
  }

  test('ranges join across a weekend using the previous end date', async () => {
    await add('2026-10-19', '2026-10-23');
    await add('2026-10-26', '2026-10-28');
    expect(await fixture.merger().findConsecutiveEvents()).toHaveLength(1);
  });

  test('ranges join across a company holiday', async () => {
    await add('2026-10-19', '2026-10-20');
    await fixture.prisma.companyHoliday.create({ data: { name: 'Holiday', date: '2026-10-21' } });
    await add('2026-10-22', '2026-10-23');
    expect(await fixture.merger().findConsecutiveEvents()).toHaveLength(1);
  });

  test('a half-day endpoint on Saturday does not invent a working gap before Monday', async () => {
    await add('2026-10-19', '2026-10-24', 'full_morning');
    await add('2026-10-26');
    await fixture.merger().executeMergeJob();
    expect(await fixture.events.getAllEvents()).toMatchObject([
      { startDate: '2026-10-19', endDate: '2026-10-26', leaveDuration: 'full' },
    ]);
    expect(await fixture.events.getAllEvents()).toHaveLength(1);
  });

  test('a half-day start on Sunday does not invent a working gap after Friday', async () => {
    await add('2026-10-23');
    await add('2026-10-25', '2026-10-27', 'afternoon_full');
    await fixture.merger().executeMergeJob();
    expect(await fixture.events.getAllEvents()).toMatchObject([
      { startDate: '2026-10-23', endDate: '2026-10-27', leaveDuration: 'full' },
    ]);
    expect(await fixture.events.getAllEvents()).toHaveLength(1);
  });

  test('a morning end on a company holiday can join the next working day', async () => {
    await fixture.prisma.companyHoliday.create({ data: { name: 'Holiday', date: '2026-10-20' } });
    await add('2026-10-19', '2026-10-20', 'full_morning');
    await add('2026-10-21');
    expect(await fixture.merger().findConsecutiveEvents()).toHaveLength(1);
  });

  test('a missing working day separates ranges', async () => {
    await add('2026-10-19', '2026-10-20');
    await add('2026-10-22', '2026-10-23');
    expect(await fixture.merger().findConsecutiveEvents()).toHaveLength(0);
  });

  test('overlapping ranges are left intact', async () => {
    await add('2026-10-19', '2026-10-22');
    await add('2026-10-21', '2026-10-23');
    expect(await fixture.merger().findConsecutiveEvents()).toHaveLength(0);
  });

  test('same-day morning and afternoon join without extending into the next morning', async () => {
    await add('2026-10-20', '2026-10-20', 'morning');
    await add('2026-10-20', '2026-10-20', 'afternoon');
    const groups = await fixture.merger().findConsecutiveEvents();
    expect(groups).toHaveLength(1);
    expect(groups[0]!.events).toHaveLength(2);
  });

  test('legacy date-only records can join a range', async () => {
    await fixture.prisma.event.create({ data: {
      employeeId: 1, employeeName: 'Tan', leaveType: 'vacation',
      date: '2026-10-20', leaveDuration: 'afternoon',
    } });
    await add('2026-10-21', '2026-10-23');
    const groups = await fixture.merger().findConsecutiveEvents();
    expect(groups).toHaveLength(1);
    expect(groups[0]!.events[0]!.startDate).toBe('2026-10-20');
  });

  test('an unrecognized duration is not silently merged as a full day', async () => {
    await fixture.prisma.event.create({ data: {
      employeeId: 1, employeeName: 'Tan', leaveType: 'vacation',
      startDate: '2026-10-20', endDate: '2026-10-20', date: '2026-10-20', leaveDuration: 'quarter_day',
    } });
    await add('2026-10-21');
    const originals = await fixture.events.getAllEvents();
    await fixture.merger().executeMergeJob();
    expect(await fixture.events.getAllEvents()).toEqual(originals);
  });

  test('ranges at the edge of the scan window are selected by overlap', async () => {
    await add('2025-09-29', '2025-10-02');
    await add('2025-10-03');
    expect(await fixture.merger().findConsecutiveEvents()).toHaveLength(1);
  });

  test('does not scan single-day events outside the configured window', async () => {
    await add('2027-02-01');
    await add('2027-02-02');
    expect(await fixture.merger().findConsecutiveEvents()).toHaveLength(0);
  });

  test('the job persists Tan as Oct 20–23 afternoon_full and removes both sources', async () => {
    await add('2026-10-20', '2026-10-20', 'afternoon');
    await add('2026-10-21', '2026-10-23');
    await fixture.merger().executeMergeJob();
    const rows = await fixture.events.getAllEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      startDate: '2026-10-20', endDate: '2026-10-23', leaveDuration: 'afternoon_full',
    });
    expect(rows[0]!.date).toBeUndefined();
  });

  test('range + single-day morning preserves the start and end half-days', async () => {
    await add('2026-10-19', '2026-10-21', 'afternoon_full');
    await add('2026-10-22', '2026-10-22', 'morning');
    await fixture.merger().executeMergeJob();
    expect(await fixture.events.getAllEvents()).toMatchObject([
      { startDate: '2026-10-19', endDate: '2026-10-22', leaveDuration: 'afternoon_morning' },
    ]);
  });

  test('complementary halves on the same day persist as a full single-day event', async () => {
    // Reverse creation order must not change morning-before-afternoon ordering.
    await add('2026-10-20', '2026-10-20', 'afternoon');
    await add('2026-10-20', '2026-10-20', 'morning');
    await fixture.merger().executeMergeJob();
    expect(await fixture.events.getAllEvents()).toMatchObject([
      { date: '2026-10-20', startDate: '2026-10-20', endDate: '2026-10-20', leaveDuration: 'full' },
    ]);
  });

  test('repeated job runs do not recreate an already merged event', async () => {
    await add('2026-10-20', '2026-10-20', 'afternoon');
    await add('2026-10-21', '2026-10-23');
    const merger = fixture.merger();
    await merger.executeMergeJob();
    const once = await fixture.events.getAllEvents();
    await merger.executeMergeJob();
    expect(await fixture.events.getAllEvents()).toEqual(once);
  });

  test('a newly added adjacent event extends an already merged range', async () => {
    await add('2026-10-19');
    await add('2026-10-20');
    const merger = fixture.merger();
    await merger.executeMergeJob();
    await add('2026-10-21', '2026-10-23', 'full_morning');
    await merger.executeMergeJob();
    expect(await fixture.events.getAllEvents()).toMatchObject([
      { startDate: '2026-10-19', endDate: '2026-10-23', leaveDuration: 'full_morning' },
    ]);
  });

  test('keeps distinct notes, including notes in an existing range description', async () => {
    await add('2026-10-20', '2026-10-20', 'afternoon', 'First reason');
    await add('2026-10-21', '2026-10-23', 'full', 'ช่วงวันที่: 21/10/2026 - 23/10/2026 - Second reason');
    await fixture.merger().executeMergeJob();
    const rows = await fixture.events.getAllEvents();
    expect(rows[0]!.description).toBe('ช่วงวันที่: 20/10/2026 - 23/10/2026 - First reason\nSecond reason');
  });

  test('rolls back the created range and all deletes if deleting a source fails', async () => {
    await add('2026-10-19');
    const second = await add('2026-10-20');
    const merger = fixture.merger();
    const [group] = await merger.findConsecutiveEvents();
    const originals = await fixture.events.getAllEvents();
    await fixture.prisma.$executeRawUnsafe(`CREATE FUNCTION reject_merge_delete() RETURNS trigger AS $$
      BEGIN IF OLD.id = ${second.id} THEN RAISE EXCEPTION 'delete failure'; END IF; RETURN OLD; END;
    $$ LANGUAGE plpgsql`);
    await fixture.prisma.$executeRawUnsafe('CREATE TRIGGER reject_merge_delete BEFORE DELETE ON events FOR EACH ROW EXECUTE FUNCTION reject_merge_delete()');
    try {
      expect((await merger.mergeEventGroup(group!)).success).toBe(false);
      expect(await fixture.events.getAllEvents()).toEqual(originals);
    } finally {
      await fixture.prisma.$executeRawUnsafe('DROP TRIGGER reject_merge_delete ON events');
      await fixture.prisma.$executeRawUnsafe('DROP FUNCTION reject_merge_delete()');
    }
  });

  test('a stale group cannot create a duplicate after another job merged it', async () => {
    await add('2026-10-19');
    await add('2026-10-20');
    const merger = fixture.merger();
    const [group] = await merger.findConsecutiveEvents();
    expect((await merger.mergeEventGroup(group!)).success).toBe(true);
    const once = await fixture.events.getAllEvents();
    expect((await fixture.merger().mergeEventGroup(group!)).success).toBe(false);
    expect(await fixture.events.getAllEvents()).toEqual(once);
  });

  test('an edit after scanning is preserved instead of overwritten by a stale group', async () => {
    const first = await add('2026-10-19');
    await add('2026-10-20');
    const merger = fixture.merger();
    const [group] = await merger.findConsecutiveEvents();
    await fixture.events.updateEvent(first.id, { leaveDuration: 'morning', description: 'Changed' });
    const edited = await fixture.events.getAllEvents();
    expect((await merger.mergeEventGroup(group!)).success).toBe(false);
    expect(await fixture.events.getAllEvents()).toEqual(edited);
  });

  test('does not turn a one-event group into a successful merge', async () => {
    const event = await add('2026-10-19');
    const originals = await fixture.events.getAllEvents();
    expect((await fixture.merger().mergeEventGroup({
      employeeId: 1, employeeName: event.employeeName, leaveType: 'vacation', events: [event],
    })).success).toBe(false);
    expect(await fixture.events.getAllEvents()).toEqual(originals);
  });

  test('the job reports failure when creating a merged event fails', async () => {
    await add('2026-10-19');
    await add('2026-10-20');
    const originals = await fixture.events.getAllEvents();
    await fixture.prisma.$executeRawUnsafe('ALTER TABLE events ADD CONSTRAINT reject_range CHECK (start_date = end_date)');
    try {
      await expect(fixture.merger().executeMergeJob()).rejects.toThrow();
      expect(await fixture.events.getAllEvents()).toEqual(originals);
    } finally {
      await fixture.prisma.$executeRawUnsafe('ALTER TABLE events DROP CONSTRAINT reject_range');
    }
  });

  // Independently specified endpoints for every supported shape. Exhaustive
  // pair tests catch both added working half-days and truncated range ends.
  const shapes: Array<{ name: string; duration: LeaveDuration; days: number; start: 'AM' | 'PM'; end: 'AM' | 'PM' }> = [
    { name: 'single full', duration: 'full', days: 0, start: 'AM', end: 'PM' },
    { name: 'single morning', duration: 'morning', days: 0, start: 'AM', end: 'AM' },
    { name: 'single afternoon', duration: 'afternoon', days: 0, start: 'PM', end: 'PM' },
    { name: 'range full', duration: 'full', days: 1, start: 'AM', end: 'PM' },
    { name: 'range afternoon/full', duration: 'afternoon_full', days: 1, start: 'PM', end: 'PM' },
    { name: 'range full/morning', duration: 'full_morning', days: 1, start: 'AM', end: 'AM' },
    { name: 'range afternoon/morning', duration: 'afternoon_morning', days: 1, start: 'PM', end: 'AM' },
  ];
  for (const left of shapes) for (const right of shapes) {
    for (const sharedBoundary of [false, true]) {
      test(`endpoint matrix ${left.name} + ${right.name}, shared day=${sharedBoundary}`, async () => {
        const start = '2026-10-19';
        const boundary = left.days ? '2026-10-20' : '2026-10-19';
        const nextStart = sharedBoundary ? boundary : left.days ? '2026-10-21' : '2026-10-20';
        const nextEnd = moment(nextStart).add(right.days, 'days').format('YYYY-MM-DD');
        const reversedHalves = sharedBoundary && left.days === 0 && right.days === 0
          && left.duration === 'afternoon' && right.duration === 'morning';
        const expectedJoin = sharedBoundary
          ? (left.end === 'AM' && right.start === 'PM') || reversedHalves
          : left.end === 'PM' && right.start === 'AM';
        await add(start, boundary, left.duration);
        await add(nextStart, nextEnd, right.duration);
        await fixture.merger().executeMergeJob();
        const rows = await fixture.events.getAllEvents();
        expect(rows).toHaveLength(expectedJoin ? 1 : 2);
        if (expectedJoin) {
          const duration = reversedHalves ? 'full' : left.start === 'PM'
            ? right.end === 'AM' ? 'afternoon_morning' : 'afternoon_full'
            : right.end === 'AM' ? 'full_morning' : 'full';
          expect(rows[0]).toMatchObject({ startDate: start, endDate: nextEnd, leaveDuration: duration });
        }
      });
    }
  }
});
