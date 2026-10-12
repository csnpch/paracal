# Next-week leader selection implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Steps use checkbox syntax for tracking.

**Goal:** Let an administrator choose who leads next week independently of queue order, repeatedly and before first activation.

**Architecture:** Store one nullable rotation anchor (Monday and employee ID) in the singleton config. While forecasting, apply that anchor at the first working week on/after its Monday, then resume the configured circular order. Before replacing an anchor, persist existing history through the current week under the config lock.

**Tech Stack:** React, TypeScript, Elysia, Prisma/PostgreSQL, Vitest, Bun and isolated PGlite integration tests.

**Spec:** User instructions in this conversation: next week can start with any employee; may be changed repeatedly for resignations or swaps. Current/past weeks stay unchanged; closed weeks do not consume a turn. No inactive user feature requested. In-chat design: separate next-week dropdown and save button on Daily Rotation, no other page redesign.

## Global constraints

- Preserve original employee order; new users still append by created_at.
- Keep calendar events and notifications on first workday only and once weekly.
- No real Teams test sends or changes to live rotation settings.
- Add migration rather than modify applied SQL; dev/build/start apply it automatically.
- Implement autonomously with TDD; push dev, merge main under existing authorization.

## Review focus

- Choosing before first activation must start with the selected person next week.
- Repeated selections must preserve historical/current published assignments.
- Full-week holidays must carry the selected turn forward.
- Deleted selected employee must fall back to the remaining queue; invalid new IDs must be rejected.
- Future calendar and Teams payload must agree, and delivery deduplication must remain intact.

### Task 1: Next-week selection end to end

**Files:**
- Modify: backend/prisma/schema.prisma (nullable leaderStartWeek, leaderStartEmployeeId)
- Create: backend/prisma/migrations/20261012120000_daily_leader_start/migration.sql
- Modify: backend/src/services/dailyRotationService.ts (anchor forecasting and updates)
- Modify: backend/src/routes/dailyRotation.ts (admin input validation)
- Modify: shared/types.ts (nextWeekStart, nextLeaderEmployeeId and update input)
- Modify: frontend/src/components/DailyRotationPanel.tsx (selector/save/status copy)
- Test: backend/tests/services/dailyRotation.integration.test.ts
- Test: backend/tests/services/dailyRotationService.test.ts
- Test: backend/tests/migrations.test.ts
- Test: frontend/src/pages/CronjobConfig.test.tsx
- Update: docs/daily-meeting-rotation.md

**Interfaces:**
- Consumes: existing settings PUT, config row lock, durable weekly snapshots, queue reconciliation.
- Produces: PUT accepts optional nextLeaderEmployeeId integer; GET returns nextWeekStart ISO Monday and nextLeaderEmployeeId (forecast or null). Internal anchor columns are nullable and not foreign keys so deletion cannot erase historical records.
- buildAssignments gains optional anchor { weekStart: string; employeeId: number } and retains existing callers.

- [x] Write failing integration tests: configured A/B/C, select C for Oct12 => Oct5 A, Oct12 C, Oct19 A, Oct26 B; select again => next week changes, current stays; fully closed Oct12 => C on Oct19; configure while OFF then activate => first event Oct12 C; delete C before Oct12 => surviving queue; reject ID999; authenticated route persists selection and local webhook sends it once.
- [x] Write frontend failing interaction test: select C via accessible combobox, save only nextLeaderEmployeeId=3, updated weekly preview shows C and subsequent A/B, queue stays A/B/C. Empty team disables control.
- [x] Run new tests against unchanged implementation; expect selection ignored/backend wrong IDs and missing UI control.
- [x] Add nullable migration, regenerate client, implement anchor and authenticated API validation; update integration fixture to apply the new migration and migration history expectations to include it.
- [x] Add selector with label above dropdown, next Monday date and helper describing circular continuation and closed weeks. Keep queue and existing controls unchanged.
- [x] Run frontend full suite, typecheck/build; backend rotation and migration suites plus compile. Run standard backend test command and report any known legacy failures separately.
- [x] Check real component in browser with isolated data, save selection and verify preview; save screenshot.
- [ ] Review full diff, resolve substantive findings with TDD; commit feature, push dev and merge/push main, verify Railway migration and successful deployment.

## Verification and review

Frontend: 24 tests passed, TypeScript check and production build passed. Backend: 40 rotation tests, 7 migration tests and 158 merge checks passed; production compile passed. The standard backend suite retains 16 pre-existing EmployeeService failures, confirmed on unchanged main.

Independent review found OFF-state anchor replacement could change unsaved history after prior activation. Added a failing integration regression, then preserved history through the current week even while OFF; the rotation suite now passes 40/40. Real component checked in the browser with isolated fixtures and screenshot retained in the main workspace output directory. Publication and Railway verification follow the existing dev/main authorization.
