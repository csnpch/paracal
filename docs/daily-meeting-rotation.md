# Daily meeting rotation

Configure everything on **Cronjob Configuration**:

- **Daily Rotation:** turn the feature on/off, drag employees or use the arrow buttons, then save the order. Initial order follows `created_at`, with ID as a tie-breaker; new employees append automatically.
- **Notifications:** `การแจ้งเตือนผู้นำ daily meeting` provides one common notification switch and time. Each webhook has independent event-notification and leader-subscription switches. Multiple subscribed webhooks are supported; identical URLs receive one leader message per week.

The calendar layout and existing add/edit/test forms remain unchanged. Leaders appear as read-only, single-day calendar events on the first Monday–Friday workday of the ISO week, using Company Holidays and Asia/Bangkok time. A fully closed week has no event or notification and consumes no turn. Turning the feature off hides its calendar events and stops its sends while retaining settings.

Current leader identity remains stable when the order changes; future weeks follow the new order. Unsent current weeks can follow holiday edits, including releasing an unused turn when the whole week becomes closed. After a delivery claim, the assignment date and consumed turn are fixed. Past holiday decisions are retained. Deleted historical leaders retain their names; rotation continues after the last surviving leader. First activation starts in the activation week even if settings were opened earlier.

## Database rollout

This repository previously had no Prisma migration baseline. Apply the additive SQL **once**, using the intended deployment database, before starting this version of the backend. It adds three tables and an independent `daily_leader_enabled` column with a `false` default; existing jobs retain their event settings. The feature and its common notification switch initially default to off.

From `backend/`, with the deployment's `DATABASE_URL` configured:

```sh
bunx prisma db execute --file prisma/migrations/20261009100000_daily_meeting_rotation/migration.sql
bunx prisma generate
```

Then deploy/restart the backend and frontend together. The initial implementation session applied this SQL only to isolated test databases. On 2026-10-12, the user authorized the production migration; it was applied in one transaction using the verified Railway `paracal-server` production environment. Existing counts stayed unchanged: 15 employees, 107 events, 3 cronjobs. No real Teams test messages were sent.

## Delivery behavior

The existing minute scheduler checks the configured time. Assignment persistence and destination claims commit in one transaction before network calls. The unique `(week_start, webhook_key)` claim prevents duplicate attempts across workers, repeated checks and restarts. Delivery status is `claimed`, `sent` or `failed`. A failed or uncertain send retains its claim and is not retried automatically, because Teams may already have accepted it. As with the existing scheduler, there is no missed-minute catch-up.

## Verification

TDD regression coverage includes holiday postponement, full closure, manual/new/deleted employee order, first activation, switch independence, global time, restart/concurrency, destination deduplication, post-claim holiday edits, transaction-boundary races, slow webhook scheduling, authentication, six-row calendar coverage, and read-only calendar details.

```sh
cd backend
bun run test:rotation
bun run test:merge
cd ../frontend
bun run test
bunx tsc --noEmit -p tsconfig.app.json
bun run build
```

Latest results: 30 rotation tests and 158 existing merge tests passed; all 18 frontend tests passed; both builds and the frontend typecheck passed. Independent code review approved the final transaction fix. Actual local UI verification used an isolated PostgreSQL fixture and fake webhook destinations, including order/save, master-off calendar hiding, desktop/narrow configuration layout, and the unchanged calendar with first-workday events.

The standard backend test script still fails its 16 pre-existing EmployeeService tests: synchronous SQLite expectations call asynchronous PostgreSQL methods. Backend-wide TypeScript checking also retains existing errors in legacy tests, logger/auth and worklog code; no errors were reported in the new rotation implementation.

HTTP errors distinguish explicit rotation validation (400), authentication (401) and unexpected infrastructure failures (500). Internal database details are logged server-side and are not included in public error responses. The actual missing-table case is covered by a table-rename regression in isolated PostgreSQL.
