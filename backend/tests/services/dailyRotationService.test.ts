import { describe, test, expect } from 'bun:test';

// A missing implementation is the initial RED state; all expectations below
// are hand-derived dates/leaders, never produced by the rotation helper itself.
const rotation = await import('../../src/services/dailyRotationService').catch(() => ({})) as any;
const employees = [
  { id: 1, name: 'A', createdAt: new Date('2026-01-01') },
  { id: 2, name: 'B', createdAt: new Date('2026-01-02') },
  { id: 3, name: 'C', createdAt: new Date('2026-01-03') },
];

describe('daily meeting rotation rules', () => {
  test('rotates one person each working week and emits only its first workday', () => {
    expect(rotation.buildAssignments('2026-10-05', '2026-10-26', employees, [], [])).toMatchObject([
      { weekStart: '2026-10-05', date: '2026-10-05', employeeId: 1 },
      { weekStart: '2026-10-12', date: '2026-10-12', employeeId: 2 },
      { weekStart: '2026-10-19', date: '2026-10-19', employeeId: 3 },
      { weekStart: '2026-10-26', date: '2026-10-26', employeeId: 1 },
    ]);
  });
  test('Monday through Wednesday holidays postpone the event to Thursday', () => {
    expect(rotation.buildAssignments('2026-10-12', '2026-10-12', employees,
      ['2026-10-12', '2026-10-13', '2026-10-14'], [])).toMatchObject([
      { date: '2026-10-15', employeeId: 1 },
    ]);
  });
  test('a fully closed week does not consume a turn', () => {
    expect(rotation.buildAssignments('2026-10-05', '2026-10-19', employees,
      ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'], [])).toMatchObject([
      { weekStart: '2026-10-05', employeeId: 1 },
      { weekStart: '2026-10-19', employeeId: 2 },
    ]);
  });
  test('default order uses creation time, while newcomers append to manual order', () => {
    expect(rotation.reconcileOrder([], [...employees].reverse())).toEqual([1, 2, 3]);
    expect(rotation.reconcileOrder([3, 1, 2], [...employees, { id: 4, createdAt: new Date('2026-10-09') }])).toEqual([3, 1, 2, 4]);
    expect(rotation.reconcileOrder([3, 1, 2], employees.slice(1))).toEqual([3, 2]);
  });
  test('a published leader survives reordering and the next working week follows them in the new queue', () => {
    expect(rotation.buildAssignments('2026-10-05', '2026-10-12', [employees[2], employees[0], employees[1]], [],
      [{ weekStart: '2026-10-05', date: '2026-10-05', employeeId: 1, employeeName: 'A' }])).toMatchObject([
      { employeeId: 1 }, { employeeId: 2 },
    ]);
  });
  test('a next-week anchor chooses C and resumes the circular queue after C', () => {
    expect(rotation.buildAssignments('2026-10-05', '2026-10-26', employees, [], [],
      { weekStart: '2026-10-12', employeeId: 3 }).map((a: any) => a.employeeId)).toEqual([1, 3, 1, 2]);
  });
  test('a next-week anchor waits through fully closed weeks without using the turn', () => {
    expect(rotation.buildAssignments('2026-10-05', '2026-10-26', employees,
      ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'], [],
      { weekStart: '2026-10-12', employeeId: 3 }).map((a: any) => a.employeeId)).toEqual([1, 3, 1]);
  });
  test('handles the year boundary and an empty team', () => {
    expect(rotation.buildAssignments('2026-12-28', '2027-01-04', employees, ['2026-12-28'], [])).toMatchObject([
      { date: '2026-12-29', employeeId: 1 }, { date: '2027-01-04', employeeId: 2 },
    ]);
    expect(rotation.buildAssignments('2026-10-05', '2026-10-12', [], [], [])).toEqual([]);
  });
  test('deleting the current leader continues after the last surviving leader rather than restarting', () => {
    expect(rotation.buildAssignments('2026-10-05', '2026-10-19', [employees[0], employees[2]], [], [
      { weekStart: '2026-10-05', date: '2026-10-05', employeeId: 1, employeeName: 'A' },
      { weekStart: '2026-10-12', date: '2026-10-12', employeeId: 2, employeeName: 'B' },
    ])).toMatchObject([{ employeeId: 1 }, { employeeId: 2 }, { employeeId: 3 }]);
  });
});
