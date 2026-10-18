# Daily meeting rotation

Configure everything on **Cronjob Configuration**:

- **ผู้นำสัปดาห์นี้:** the first card on Daily Rotation selects the actual leader of the current ISO week. Saving corrects only the current week and resumes the saved circular order after that person; past weeks stay unchanged. Repeated corrections and replacing a deleted employee are supported. A fully closed week carries the choice to the next working week.
- **Daily Rotation:** rotation always runs and has no feature-enable switch. Drag employees or use the arrow buttons to save their order. Initial order follows `created_at`, with ID as a tie-breaker; new employees append automatically. The header contains the global leader-notification switch and common time.
- **Notifications:** contains webhook items only, with independent event and leader-subscription switches. Multiple subscribed webhooks are supported; identical URLs receive one leader message per week. Global notification off pauses sends while the calendar keeps showing the rotation.

Leaders appear as a small violet dot beside the date header in month, week and day views, rather than ordinary event rows. Hover or keyboard focus shows the leader name. The dot has its own tooltip and does not consume an event lane or increase ordinary event counts. Assignment dates remain the first Monday–Friday workday of the ISO week, using Company Holidays and Asia/Bangkok time. Existing add/edit/test forms and read-only date details remain available. A fully closed week has no event or notification and consumes no turn. Disabling leader notifications stops sends while retaining calendar indicators and queue settings.

Current leader identity remains stable when the order changes; future weeks follow the new order. Unsent current weeks can follow holiday edits, including releasing an unused turn when the whole week becomes closed. After a delivery claim, the assignment date is fixed. An explicit current-week correction may replace the leader and subsequent cursor, while the existing delivery claim prevents resending an already queued/sent message. Past holiday decisions are retained. Deleted historical leaders retain their names; rotation continues after the last surviving leader. A new configuration starts automatically in its creation week. Legacy feature-disable updates are accepted but ignored; rotation remains active.

## Database rollout

Backend `dev`, `build` and `start` automatically run `prisma migrate deploy` first. Migration failure stops the command before compilation or server startup. Docker/Railway starts with `bun run start`, so migrations also run automatically on deployment and restart. Docker image construction only generates the client; `build:compile` is the equivalent database-independent build command.

New databases are created from the committed baseline and rotation migrations. Existing databases created before migration history need **one-time adoption**, with the intended database's `DATABASE_URL` configured. The helper checks the schema before registering already-applied migrations; it does not execute the schema diff, reset the database, or change application data. Unmanaged historical tables are preserved. Partial or mismatched application schemas fail adoption.

```sh
bun run db:adopt   # existing databases without migration history only
bun run db:migrate
```

The original rotation SQL adds three tables and an independent `daily_leader_enabled` column with a `false` default. Existing jobs retain their event settings; the original feature flag and global notification switch initially defaulted to off. Rotation now runs automatically; notification defaults remain off. On 2026-10-12, production SQL was applied using the verified Railway `paracal-server` environment, and both baseline and rotation migration history entries were then registered after schema validation. `migrate deploy` confirmed no pending migrations. Existing counts stayed unchanged: 15 employees, 107 events, 3 cronjobs. Subsequent committed migrations are applied by the normal startup script. No real Teams test messages were sent.

`prisma/legacy.prisma` and `prisma/rotation-rollout.prisma` are immutable schema checkpoints for validating that one-time transition. New schema changes belong in `prisma/schema.prisma` and a new migration directory; do not edit applied migration SQL or these checkpoints. See [Prisma baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining) and [production migrations](https://www.prisma.io/docs/cli/v7/migrate/deploy).

## Delivery behavior

The existing minute scheduler checks the configured time. Assignment persistence and destination claims commit in one transaction before network calls. The unique `(week_start, webhook_key)` claim prevents duplicate attempts across workers, repeated checks and restarts. Delivery status is `claimed`, `sent` or `failed`. A failed or uncertain send retains its claim and is not retried automatically, because Teams may already have accepted it. As with the existing scheduler, there is no missed-minute catch-up.

## Verification

TDD regression coverage includes holiday postponement, full closure, manual/new/deleted employee order, current-week correction and closed-week carry, switch independence, global time, restart/concurrency, destination deduplication, post-claim holiday edits, transaction-boundary races, slow webhook scheduling, authentication, six-row calendar coverage, and read-only calendar details.

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

Latest rotation verification passed 52 tests and backend compilation; the existing merge suite passed 158 tests. The 7 migration lifecycle tests passed during the earlier migration rollout; this change needs no schema migration. Those lifecycle tests exercise real CLI commands against isolated PostgreSQL fixtures: empty database builds, legacy adoption, already-applied SQL, repeated migrations, record preservation, mismatched/partial schema refusal and lifecycle failure propagation. Latest frontend verification passed all 35 tests, typecheck and build. Coverage includes employee-editor focus/save, current-leader correction and removed/empty-team handling, tab ownership of notification settings, session reset, and calendar dot behavior. Actual local UI verification used the real components with isolated sample data: choosing C updated the preview to C → A → B, Notifications contained webhook rows only, and the calendar dot measured 6px inside a 12px trigger with a 2px date gap. Independent full-diff review found no remaining issues.

The standard backend test script still fails its 16 pre-existing EmployeeService tests: synchronous SQLite expectations call asynchronous PostgreSQL methods. Backend-wide TypeScript checking also retains existing errors in legacy tests, logger/auth and worklog code; no errors were reported in the new rotation implementation.

HTTP errors distinguish explicit rotation validation (400), authentication (401) and unexpected infrastructure failures (500). Internal database details are logged server-side and are not included in public error responses. The actual missing-table case is covered by a table-rename regression in isolated PostgreSQL.

The current-week selector sends `currentLeaderEmployeeId` to the authenticated settings PUT. GET returns `currentWeekStart` (ISO Monday) and `currentLeaderEmployeeId` (current/carry-forward leader or null). Current and legacy next-week selections are mutually exclusive and must identify an existing employee. The legacy `nextLeaderEmployeeId`, `nextWeekStart` and always-true `enabled` API fields remain for older clients. No new database migration is needed: current-week selection reuses the anchor columns from `20261012120000_daily_leader_start`. Dates and claims remain intact when correcting the current snapshot, including after a notification was sent.

Calendar date/view/mode are stored in `sessionStorage`, so a fresh tab/browser session starts at today and ignores old `localStorage` dates. Reloading or returning to the calendar during the same tab session retains its latest navigation. The leader indicator uses a 6px dot inside a 12px focusable trigger, with a 2px gap beside the day number.

Leader notifications show the short card below (with the existing Open Paracal action). When leader and calendar messages are due together, the scheduler waits for leader webhook sends to finish before starting calendar notifications. It keeps the original tick time, and a leader failure does not suppress calendar delivery. No real Teams messages were sent during verification; ordering and failed-response cases use isolated PostgreSQL and local HTTP endpoints.

```text
✳ Paracal

🎙️ นาย A จะนำ Daily Meeting ในสัปดาห์นี้
```
