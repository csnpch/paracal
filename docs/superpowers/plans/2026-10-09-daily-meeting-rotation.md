# Daily Meeting Rotation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Steps use checkbox syntax.

**Goal:** Add weekly daily meeting leadership with ordered employees, optional calendar events and independent Teams subscriptions.

**Architecture:** Store one global rotation/notification configuration, immutable past/claimed week assignments, and durable per-week webhook dispatch claims. Existing leave events and schedules remain independent. Calendar receives read-only synthetic single-day events from a separate endpoint.

**Tech Stack:** Bun, Elysia, Prisma/PostgreSQL, React, Vitest, PGlite integration tests.

**Spec:** The user's latest selected Notifications mockup and corrections in this conversation.

## Global Constraints

- Red/green tests before implementation; no production data migration or real webhook test sends.
- Change Cronjob Configuration UI only; preserve other layouts and existing add/edit/test forms.
- Global label: `การแจ้งเตือนผู้นำ daily meeting`. Global time applies to every subscribed webhook; subscriptions are independent and may include multiple webhooks.
- Default queue `created_at ASC`, id tie-break; new users append, saved manual order survives.
- Monday–Sunday rotation in Asia/Bangkok; calendar event and notification only on the first Mon–Fri company workday.
- Entire week off consumes no turn. Feature OFF hides calendar leaders and stops their notifications while retaining settings.

## Review Focus

- New/deleted employees after manual reorder: preserve surviving order and append newcomers.
- Fully closed week and year boundary: no skipped turn, correct ISO week.
- Restart/concurrent workers: at most one dispatch attempt per week and destination; do not automatically retry ambiguous failures.
- Feature/notification/subscription OFF: leave notifications unaffected.
- Future forecasts and reorder: preserve current leader identity and past/claimed workday decisions, recompute future weeks.

### Task 1: Rotation calculation and persistence

Files: `backend/src/services/dailyRotationService.ts`, `shared/types.ts`, `backend/prisma/schema.prisma`, migration SQL, `backend/tests/services/dailyRotationService.test.ts`.

Produces: `DailyRotationService.getSettings()`, `.updateSettings(updates)`, `.getAssignments(start,end)`, `.dispatchDue(now)`; calendar assignments include weekStart/date/employeeId/employeeName.

- [x] Write and observe failing tests for A→B→C→A, holiday postponement, full-week carryover, order reconciliation, current snapshot preservation and range validation.
- [x] Implement calculations and durable storage with transaction serialization.
- [x] Run isolated PostgreSQL tests and record result.

### Task 2: API and Teams scheduling

Files: `backend/src/routes/dailyRotation.ts`, `backend/src/index.ts`, cronjob service/routes, notification service, backend integration tests.

Consumes Task 1 service; produces `/daily-rotation`, `/daily-rotation/events`, cronjob `daily_leader_enabled` subscription.

- [x] Write failing integration tests for feature/global/subscription switches, duplicate destination claims, restart and concurrent checks, and common notification time.
- [x] Implement authenticated config updates, public event reads, subscription CRUD, Adaptive Card and separate scheduler invocation.
- [x] Verify actual card payload and isolated webhook dispatch; run existing backend suites and report pre-existing failures.

### Task 3: Configuration UI and calendar data

Files: `frontend/src/pages/CronjobConfig.tsx`, rotation config component, API service, calendar page/grid/details, UI tests.

Consumes API and assignments. Produces Daily Rotation/Notifications tabs, central leader notification settings, ordered list and independent per-webhook switches. Existing forms stay unchanged. Calendar uses read-only single-day event chips and existing details layout; sidebar remains leave-only.

- [x] Write failing user interaction tests for order movement/save, global settings and independent subscriptions; single-day rendering and read-only actions.
- [x] Implement approved Notifications card layout and rotation settings.
- [x] Verify frontend suite, typechecks/builds and local browser; review diff and record outcomes.

## Execution ledger

Ruling: Execute inline on `codex/daily-meeting-rotation` in this checkout; user explicitly requested no questions and autonomous completion. No worktree was requested. No commits/push/deploy are necessary for delivery.

Baseline: frontend 4/4 pass. Backend standard test command fails 16 EmployeeService tests because old synchronous SQLite tests call async PostgreSQL methods. New integration tests will use isolated PGlite and never read application DATABASE_URL.


Completion ledger: TDD RED→GREEN observed for rotation rules, API/dispatch, UI interactions, delayed activation, current unsent full closure, post-claim holiday edits, scheduler minute blocking, transaction-boundary claim race, sixth-row calendar coverage, rotation-only load failure and leader-name visibility. Final targeted backend 28/28 plus existing merge 158/158 (186 total); frontend 18/18; frontend typecheck and both production builds passed. Standard backend script retains 16 baseline failures; backend-wide typecheck retains legacy errors. `git diff --check` passed.

Review ruling: A closed current week with no delivery claim releases its unused turn. Any durable claim freezes that week's date and consumed turn. Assignment and destination claims commit under one config lock; external sends occur afterward. Calendar chips put the leader name first so narrow cells show who leads.

Independent reviewer approved all final Important fixes. Local browser verified ordering/save, master-off calendar hiding, six-row leader rendering and unchanged calendar/sidebar layout using isolated PGlite fixtures and fake URLs. Rollout instructions and existing-check limitations are recorded in `docs/daily-meeting-rotation.md`. No application database migration, real Teams send, commit, push or deployment was performed.
