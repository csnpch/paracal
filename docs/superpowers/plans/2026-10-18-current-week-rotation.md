# Current-week rotation UX implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Steps use checkbox syntax for tracking.

**Goal:** Compact the calendar leader dot, reset the calendar on a new tab session, and make rotation always active with current-week selection and notification settings on Daily Rotation.

**Architecture:** Retain existing assignment/snapshot and delivery-claim mechanisms. Add current-week selection on the existing settings API while retaining next-week fields for older clients. Correct only the current snapshot and anchor under the config lock; past snapshots and delivery claims remain intact. Move date persistence to sessionStorage and remove the module-wide initial-state cache.

**Tech Stack:** React/TypeScript, Radix, Vitest, Elysia/Prisma, isolated PostgreSQL/PGlite.

**Spec:** User messages on 2026-10-18: smaller dot close to day number; no Daily Rotation enable switch; choose this week's actual leader at the top of Daily Rotation; put global leader notification switch/time at the former rotation-switch location; Notifications contains only per-webhook switches; new browser/tab session defaults to today. User authorizes autonomous TDD and existing dev/main publication.

## Global constraints

- Rotation always runs; notification global/per-webhook switches independently control sends.
- Current-week correction preserves past assignments, resumes circular order after the selected user, and does not resend existing delivery claims.
- Full-week closure consumes no turn and carries a chosen leader to the next working week.
- Existing manual queue/new-user append and first-workday event rules remain intact.
- No real Teams test sends or manual production-setting edits.
- Use sessionStorage for date/view state; ignore legacy localStorage state; refresh in the same tab retains navigation and a new session starts today.
- Preserve the verified npm Docker build fix ce2071d; no new database schema is necessary.

## Review focus

- Current selection after a notification claim must update calendar/future rotation without another notification.
- Repeated current corrections and selecting after a closed week keep history stable.
- Legacy enabled=false config/input must not hide rotation, while notificationEnabled=false still suppresses sends.
- Tabs contain only the intended switches and selection precedes queue UI.
- Session reset must ignore legacy persisted state; same-tab navigation/remount must use the latest stored date.

### Task 1: Compact dot and tab-session calendar state

**Files:** frontend/src/components/CalendarGrid.tsx; frontend/src/lib/calendarStorage.ts; frontend/src/pages/CalendarEvents.tsx; new frontend/src/lib/calendarStorage.test.ts.

**Interfaces:** Existing getStoredCalendarState/setStoredCalendarState signatures unchanged. Browser sessionStorage owns the payload; new session returns null for the page's today fallback.

- [x] Write tests for ignoring old localStorage dates, same-session roundtrip, session clear/new-session reset, invalid data fallback; run RED.
- [x] Use sessionStorage and remove the stale module-wide initial-state cache; make dot 6px inside a 12px trigger with a 2px day-header gap and a thin keyboard-focus ring.
- [x] Run storage and calendar tests, typecheck; inspect the compact dot in browser and commit.

### Task 2: Always-on current-week rotation configuration

**Files:** shared/types.ts; backend/src/routes/dailyRotation.ts; backend/src/services/dailyRotationService.ts; backend/tests/services/dailyRotation.integration.test.ts; frontend/src/components/DailyRotationPanel.tsx; frontend/src/pages/CronjobConfig.tsx; frontend/src/pages/CronjobConfig.test.tsx; docs/daily-meeting-rotation.md.

**Interfaces:** GET adds currentWeekStart:string and currentLeaderEmployeeId:number|null. PUT accepts currentLeaderEmployeeId?:number (exclusive with legacy nextLeaderEmployeeId). enabled remains a deprecated always-true response/ignored legacy update. Existing next-week API remains compatible. No schema migration.

- [x] Add RED integration tests for current selection, repeated correction/past stability, post-send correction without duplicates, closed-week carry, invalid IDs/conflicting inputs, always-active legacy configs.
- [x] Update obsolete feature-OFF tests to always-active expectations; retain global/per-webhook notification suppression and legacy next-week tests.
- [x] Add RED UI tests: top current-week selector, single global notification switch/time on Daily Rotation, no enable-rotation switch, no global card on Notifications, per-webhook switches retained.
- [x] Implement always-active settings and current anchor/snapshot correction atomically; expose current fields and validated admin input.
- [x] Move global notification inputs into the panel header, move current-week selector to first content section, retain queue and preview below; remove old global Notifications card.
- [x] Run complete frontend suite/typecheck/build, backend rotation/merge suites/compile and standard backend tests; report known legacy failures separately.
- [x] Verify actual components with isolated browser fixtures/screenshots, obtain one full-diff review, fix findings via RED/GREEN, commit and publish dev/main; verify production builds including npm pin. (Implementation, browser verification and review complete; publication is the final pending action.)
