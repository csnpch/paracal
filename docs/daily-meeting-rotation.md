# Daily meeting rotation

Configure everything on **Cronjob Configuration**:

- **Daily Rotation:** turn the feature on/off, drag employees or use the arrow buttons, then save the order. Initial order follows `created_at`, with ID as a tie-breaker; new employees append automatically.
- **ผู้นำสัปดาห์หน้า:** choose an employee independently of queue order, then save. The chosen person leads the first working week on/after next Monday, and rotation continues after them in the saved circular order. The selection can be changed repeatedly before that week and in subsequent weeks without changing past/current assignments. A fully closed week carries the chosen turn forward. Selection is also available before first activation; this starts the rotation next week with that person. If the selected employee is later deleted, forecasting falls back to the surviving queue.
- **Notifications:** `การแจ้งเตือนผู้นำ daily meeting` provides one common notification switch and time. Each webhook has independent event-notification and leader-subscription switches. Multiple subscribed webhooks are supported; identical URLs receive one leader message per week.

Leaders appear as a small violet dot beside the date header in month, week and day views, rather than ordinary event rows. Hover or keyboard focus shows the leader name. The dot has its own tooltip and does not consume an event lane or increase ordinary event counts. Assignment dates remain the first Monday–Friday workday of the ISO week, using Company Holidays and Asia/Bangkok time. Existing add/edit/test forms and read-only date details remain available. A fully closed week has no event or notification and consumes no turn. Turning the feature off hides its calendar events and stops its sends while retaining settings.

Current leader identity remains stable when the order changes; future weeks follow the new order. Unsent current weeks can follow holiday edits, including releasing an unused turn when the whole week becomes closed. After a delivery claim, the assignment date and consumed turn are fixed. Past holiday decisions are retained. Deleted historical leaders retain their names; rotation continues after the last surviving leader. Without an explicit next-week selection, first activation starts in the activation week even if settings were opened earlier.

## Database rollout

Backend `dev`, `build` and `start` automatically run `prisma migrate deploy` first. Migration failure stops the command before compilation or server startup. Docker/Railway starts with `bun run start`, so migrations also run automatically on deployment and restart. Docker image construction only generates the client; `build:compile` is the equivalent database-independent build command.

New databases are created from the committed baseline and rotation migrations. Existing databases created before migration history need **one-time adoption**, with the intended database's `DATABASE_URL` configured. The helper checks the schema before registering already-applied migrations; it does not execute the schema diff, reset the database, or change application data. Unmanaged historical tables are preserved. Partial or mismatched application schemas fail adoption.

```sh
bun run db:adopt   # existing databases without migration history only
bun run db:migrate
```

The original rotation SQL adds three tables and an independent `daily_leader_enabled` column with a `false` default. Existing jobs retain their event settings; the feature and global notification switch initially default to off. On 2026-10-12, production SQL was applied using the verified Railway `paracal-server` environment, and both baseline and rotation migration history entries were then registered after schema validation. `migrate deploy` confirmed no pending migrations. Existing counts stayed unchanged: 15 employees, 107 events, 3 cronjobs. Subsequent committed migrations are applied by the normal startup script. No real Teams test messages were sent.

`prisma/legacy.prisma` and `prisma/rotation-rollout.prisma` are immutable schema checkpoints for validating that one-time transition. New schema changes belong in `prisma/schema.prisma` and a new migration directory; do not edit applied migration SQL or these checkpoints. See [Prisma baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining) and [production migrations](https://www.prisma.io/docs/cli/v7/migrate/deploy).

## Delivery behavior

The existing minute scheduler checks the configured time. Assignment persistence and destination claims commit in one transaction before network calls. The unique `(week_start, webhook_key)` claim prevents duplicate attempts across workers, repeated checks and restarts. Delivery status is `claimed`, `sent` or `failed`. A failed or uncertain send retains its claim and is not retried automatically, because Teams may already have accepted it. As with the existing scheduler, there is no missed-minute catch-up.

## Verification

TDD regression coverage includes holiday postponement, full closure, manual/new/deleted employee order, first activation, switch independence, global time, restart/concurrency, destination deduplication, post-claim holiday edits, transaction-boundary races, slow webhook scheduling, authentication, six-row calendar coverage, and read-only calendar details.

```sh
cd backend
bun run test:migrations
bun run test:rotation
bun run test:merge
cd ../frontend
bun run test
bunx tsc --noEmit -p tsconfig.app.json
bun run build
```

Latest backend results: 7 migration lifecycle tests, 43 rotation tests and 158 existing merge tests passed (208 total); compilation passed. Migration tests exercise real CLI commands against isolated PostgreSQL fixtures: empty database builds, legacy adoption, already-applied SQL, repeated migrations, record preservation, mismatched/partial schema refusal and lifecycle failure propagation. Independent code review approved migration automation. Latest frontend verification passed all 28 tests, build and typecheck. This includes employee-editor focus/save and next-leader selection/preview/empty-team coverage. Actual local UI verification used an isolated PostgreSQL fixture and fake webhook destinations, including order/save, master-off calendar hiding, desktop/narrow configuration layout, and the unchanged calendar with first-workday events.

The standard backend test script still fails its 16 pre-existing EmployeeService tests: synchronous SQLite expectations call asynchronous PostgreSQL methods. Backend-wide TypeScript checking also retains existing errors in legacy tests, logger/auth and worklog code; no errors were reported in the new rotation implementation.

HTTP errors distinguish explicit rotation validation (400), authentication (401) and unexpected infrastructure failures (500). Internal database details are logged server-side and are not included in public error responses. The actual missing-table case is covered by a table-rename regression in isolated PostgreSQL.

The next-week selector sends `nextLeaderEmployeeId` to the authenticated settings PUT. GET returns the next Monday as `nextWeekStart` and the selected/forecast next leader as `nextLeaderEmployeeId` (null when none is available). Migration `20261012120000_daily_leader_start` adds nullable `leader_start_week` and `leader_start_employee_id` config columns; existing settings and queue order are retained. A pending selection remains visible even when a closure exceeds the four-week preview.

Leader notifications show the short card below (with the existing Open Paracal action). When leader and calendar messages are due together, the scheduler waits for leader webhook sends to finish before starting calendar notifications. It keeps the original tick time, and a leader failure does not suppress calendar delivery. No real Teams messages were sent during verification; ordering and failed-response cases use isolated PostgreSQL and local HTTP endpoints.

```text
✳ Paracal

🎙️ นาย A จะนำ Daily Meeting ในสัปดาห์นี้
```
