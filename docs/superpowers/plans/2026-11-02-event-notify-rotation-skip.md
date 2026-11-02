# Same-day notification confirmation and rotation skip

> **For agentic workers:** Use superpowers:executing-plans inline. User has opted out of questions and authorized implementation and dev/main publication.

**Goal:** Offer an explicit Teams send after creating today's event; exclude selected users from daily leadership without deleting their account or order position.

**Architecture:** Separate event creation from authenticated notify-now POST. Claim each event/destination durably before network sends. Persist skipped IDs on rotation config, retaining full queue and historical snapshots. Existing scheduler stays unchanged.

**Tech Stack:** React/Radix, Elysia, Prisma/PostgreSQL, Bun/PGlite, Vitest.

**Spec:** User requests in this chat on 2026-11-02, including correction from automatic sending to confirmation after successful creation.

## Constraints and design decisions
- Today uses Asia/Bangkok. Range events including today qualify; past/future-only events do not. Edits do not trigger the popup.
- Event creation never sends automatically. Popup offers ส่งแจ้งเตือน and ไม่ส่งตอนนี้. Cancelling/dismissing preserves the created event.
- Only enabled event-notification webhooks receive this one created event; schedules/types do not restrict an explicit send. Same URL is sent once. Per-leader subscriptions are unrelated.
- Auth required; server validates saved event/date. Unique event/destination claims prevent duplicate clicks/requests; uncertain failures are reported without automatic resend. Event creation remains successful if sending fails.
- Skip is rotation-specific, reversible and durable; full employeeOrder and user/event records remain. New users participate by default.
- Past and claimed current assignments remain historical. Skipped unclaimed current/future assignments are recalculated; all skipped means no assignment/send. Resuming restores original position. Skipped users cannot be explicitly selected as current/next leader.
- Use new additive migrations, automatic startup migration, isolated fixtures and local webhooks only for verification. No real Teams test messages.

## Review focus
- Server date is authoritative when popup crosses midnight.
- Double requests and duplicate destinations cannot duplicate a message.
- Failure/cancel never creates another event; no-destination is visible to user.
- Skip last leader in queue and preserve circular successor, including past snapshots of skipped users.
- All skipped, resume, pending anchors, sent current week and deleted IDs remain coherent.

### Task 1: Explicit same-day notification
**Files:** New eventNotificationService.ts, eventNotifications.ts route, integration tests; Prisma schema/additive migration; frontend api + CalendarEvents + EventNotificationDialog + tests.
**Interfaces:** POST /events/:id/notify-now returns ApiResponse<EventNotificationResult {sent,failed,alreadyClaimed,total}>; service notify(eventId:number) validates and claims. Popup consumes created Event, closes independently of creation form.
- [ ] RED: real saved event today/range/Bangkok boundary, future/past/missing rejects, auth, duplicate calls/destinations, disabled/no targets, failed webhook preserves event.
- [ ] Implement schema + minimal service/route and explicit API call; register route without altering event creation.
- [ ] RED UI: no send before confirmation; today-only post-create popup, dismiss, success/failure, non-today and edits excluded.
- [ ] Implement confirmation component and calendar integration; verify targeted suites and commit.

### Task 2: Skip rotation users
**Files:** Rotation schema migration, service/routes/shared types, DailyRotationPanel, backend integration and frontend config tests, docs.
**Interfaces:** GET/PUT rotation settings adds skippedEmployeeIds:number[]. List retains all users; selection excludes skipped users. PUT validates unique existing IDs and selected leader conflicts atomically.
- [ ] RED: skip B in A/B/C yields A/C/A/C with B and historical records retained; skip current unsent advances; claimed current preserved; all skipped no events/sends; resume original order; invalid IDs and excluded selection reject; restart persists.
- [ ] Implement config persistence and candidate selection with full cursor order and past/claim preservation.
- [ ] RED UI: row skip/resume and state, selector excludes skipped users, empty eligible queue message.
- [ ] Implement per-row skip action and visible badge; refresh preview through existing settings API.
- [ ] Verify full frontend, rotation/new notifications/merge/migrations, compile/build and standard backend tests (report known EmployeeService failures). Browser-check real components using sample data, review entire diff, publish authorized dev/main and verify deployments.
