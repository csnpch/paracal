# Event merge validation — 2026-10-02

The bugfix joins single-day events with existing ranges, as well as adjacent ranges, while preserving the working half-days represented by the source events.

Tan's regression case is covered through the production Prisma driver and a temporary PostgreSQL engine: Oct 20 afternoon + Oct 21–23 full persists as one Oct 20–23 `afternoon_full` event, with both sources removed.

## Verification

| Check | Result |
| --- | --- |
| Focused merge suite | 158 passed, 0 failed; 204 assertions |
| Endpoint combinations | 98 cases covering every pair of 7 event shapes, with adjacent and shared dates |
| Backend bundle | Passed; 614 modules bundled |
| Independent code review | No remaining blocking findings; holiday endpoint finding fixed with RED → GREEN tests |
| `git diff --check` | Passed |
| Default backend `bun run test` | Fails on the 16 legacy EmployeeService tests |
| All five other service suites | 14 passed, 65 failed, 173 errors; see individual failures below |
| Final combined `bun test tests` run | Not executed: automatic permission review timed out twice; focused merge tests and the other five suites were executed separately |
| Full backend typecheck | Fails in existing unrelated files; no errors in the modified merge service, cron registration, or merge tests |

Run the focused suite from `backend/` with `bun run test:merge`. It uses an in-memory PGlite PostgreSQL engine and the production PrismaPg driver on a temporary localhost port. It never reads or connects to the application's DATABASE_URL.

## TDD evidence and behavior

- The original Tan test failed because the scan returned no group.
- Range/range, range-end continuity, legacy date, and composite-duration regressions failed before implementation.
- Persistence, note retention, rollback, stale source, singleton-group rejection, and failure propagation tests failed before their fixes.
- Weekend/company-holiday half-day endpoints and unknown durations received their own failing tests before fixes.
- Working day and half-day gaps remain separate; overlapping records are left intact, except complementary morning/afternoon boundaries.
- Writes run in a Serializable transaction. Source snapshots and conditional deletion protect against stale groups and intervening event edits. Insert or delete failure preserves all original events.
- Existing notes are retained without duplicate generated range prefixes. Repeated jobs do not recreate a merged range, and a newly added adjacent event can extend it.
- The cron still runs at 03:30 Asia/Bangkok and on startup. Its callback awaits the merge job and logs failures; failed groups now cause the job/API to report failure.

## Limits

These changes have not been deployed or applied to production events. PGlite runs one connection, so transaction tests cover stale snapshots and rollback, not real simultaneous multi-connection PostgreSQL interleavings. The production isolation and conditional deletion safeguards were reviewed. Changing the holiday calendar after scanning is an existing race outside this bounded fix.

The other service tests still use the pre-Prisma synchronous SQLite harness and were already failing before this work. Type errors remain in logger middleware, auth, worklog/shared Jira types, and the legacy service tests. This report does not claim the entire project is passing or that every possible production input has been proven correct.

## Existing test failures

- EmployeeService > createEmployee > should create an employee successfully
- EmployeeService > createEmployee > should create an employee with Thai name
- EmployeeService > getAllEmployees > should return all employees ordered by name
- EmployeeService > getAllEmployees > should ensure all employees have required fields
- EmployeeService > updateEmployee > should update employee successfully
- EmployeeService > updateEmployee > should return null for non-existent employee
- EmployeeService > updateEmployee > should handle update with same data
- EmployeeService > getEmployeeById > should return employee by ID
- EmployeeService > getEmployeeById > should return null for non-existent employee
- EmployeeService > deleteEmployee > should delete employee successfully
- EmployeeService > deleteEmployee > should return false for non-existent employee
- EmployeeService > searchEmployees > should search employees by name
- EmployeeService > searchEmployees > should return empty array for no matches
- EmployeeService > searchEmployees > should handle partial name search
- EmployeeService > getEmployeeStats > should return correct employee count
- EmployeeService > getEmployeeStats > should handle dynamic employee count changes
- DashboardService > getDashboardSummary - Basic Functionality > should return summary for all events when no filters applied
- DashboardService > getDashboardSummary - Basic Functionality > should filter by date range correctly
- DashboardService > getDashboardSummary - Basic Functionality > should calculate most common leave type correctly
- DashboardService > getDashboardSummary - Basic Functionality > should filter by event type
- DashboardService > getDashboardSummary - Basic Functionality > should combine date range and event type filters
- DashboardService > getDashboardSummary - Multi-Day Events (BUG TEST) > should count multi-day events within date range
- DashboardService > getDashboardSummary - Multi-Day Events (BUG TEST) > should count events that start before and end within range
- DashboardService > getDashboardSummary - Multi-Day Events (BUG TEST) > should count events that start within and end after range
- DashboardService > getDashboardSummary - Multi-Day Events (BUG TEST) > should NOT count events completely outside date range
- DashboardService > getDashboardSummary - Employee Ranking > should rank employees by total events descending
- DashboardService > getDashboardSummary - Employee Ranking > should include event type breakdown for each employee
- DashboardService > getDashboardSummary - Employee Ranking > should filter ranking by event type
- DashboardService > getDashboardSummary - Edge Cases > should handle no events
- DashboardService > getDashboardSummary - Edge Cases > should handle date range with no matching events
- DashboardService > getDashboardSummary - Edge Cases > should handle event type filter with no matches
- DashboardService > getDashboardSummary - Return Type Validation > should return mostCommonType as raw leave type key, not Thai translation
- DashboardService > getDashboardSummary - Return Type Validation > should have correct structure for employeeRanking
- DashboardService > getDashboardSummary - Future Events Filtering > should exclude future events by default
- DashboardService > getDashboardSummary - Future Events Filtering > should exclude future events when includeFutureEvents is false
- DashboardService > getDashboardSummary - Future Events Filtering > should include future events when includeFutureEvents is true
- DashboardService > getDashboardSummary - Future Events Filtering > should handle events starting today
- DashboardService > getDashboardSummary - Future Events Filtering > should exclude events starting tomorrow
- DashboardService > getDashboardSummary - Future Events Filtering > should work with date range filter
- DashboardService > getDashboardSummary - Future Events Filtering > should correctly rank employees excluding future events
- DashboardService > getDashboardSummary - Business Days Integration > should calculate total business days correctly
- DashboardService > getDashboardSummary - Business Days Integration > should show business days per employee
- DashboardService > getDashboardSummary - Business Days Integration > should handle weekend events correctly
- EventService > createEvent > should create an event successfully
- EventService > createEvent > should create an event without description
- EventService > getAllEvents > should return all events ordered by date descending
- EventService > getEventById > should return event by ID
- EventService > getEventById > should return null for non-existent event
- EventService > getEventsByDate > should return events for specific date
- EventService > getEventsByDateRange > should return events within date range
- EventService > updateEvent > should update event successfully
- EventService > updateEvent > should return null for non-existent event
- EventService > deleteEvent > should delete event successfully
- EventService > deleteEvent > should return false for non-existent event
- EventService > searchEvents > should search events by employee name
- EventService > getEventStats > should return event statistics
- CronjobService > testNotification - Invalid Webhook URL Cases > should return error for 405 Method Not Allowed (google.com case)
- CronjobService > testNotification - Invalid Webhook URL Cases > should return error for non-existent cronjob config
- CronjobService > Weekly notification configuration tests > should create weekly notification configuration correctly
- CronjobService > Weekly notification configuration tests > should test weekly notification successfully with valid webhook
- CronjobService > Weekly notification configuration tests > should handle weekly notification with invalid webhook URL
- CronjobService > Weekly notification configuration tests > should handle daily notification with invalid webhook URL
- CronjobService > Weekly notification configuration tests > should handle another invalid webhook URL case
- CronjobService > Weekly notification configuration tests > should convert daily cronjob to weekly configuration
- CronjobService > getAllConfigs with weekly configurations > should return all configurations including weekly ones
