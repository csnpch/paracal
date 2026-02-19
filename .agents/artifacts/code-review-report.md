# 📋 Code Review Report — zcalendar-qa

**Reviewed on:** 2026-02-19  
**Scope:** Full Backend & Frontend

---

## Summary

| Category | Score | Notes |
|---|---|---|
| Best Practices | ⚠️ 5/10 | Several critical issues need fixing |
| Clean Code | 🟡 6/10 | Generally readable, some large files |
| No Duplicate Code | ⚠️ 4/10 | Significant duplication found |

---

## 🔴 Critical Issues

### 1. Hardcoded Secrets in Source Code
**Severity: CRITICAL** 🚨

Multiple passwords and API keys are hardcoded directly in source code:

| File | Secret |
|---|---|
| `backend/src/routes/events.ts` (lines 259, 286, 312) | Password `!C@len12` repeated 3 times |
| `frontend/src/contexts/AuthContext.tsx` (line 13) | Same password `!C@len12` |
| `frontend/src/pages/EventsManagement.tsx` (line 248) | Same password `!C@len12` |
| `backend/src/services/holidayService.ts` (line 59) | API key `h7EPXfb9fLSkyeNUwai6DVfCbgaub1Re` |

**Fix:** Move all secrets to environment variables. Create a shared config module.

```typescript
// backend/src/config/index.ts
export const config = {
  adminPassword: process.env.ADMIN_PASSWORD || '',
  calendarificApiKey: process.env.CALENDARIFIC_API_KEY || '',
  appUrl: process.env.APP_URL || 'http://localhost:8080',
};
```

### 2. Hardcoded Internal IP Address
**Severity: HIGH**

`http://192.168.42.106:8080/` is hardcoded **6 times** in `notificationService.ts`. This should be an environment variable.

### 3. Frontend LeaveType Out of Sync with Backend
**Severity: HIGH**

The backend supports **12 leave types**: `vacation, personal, sick, absent, maternity, bereavement, study, military, sabbatical, unpaid, compensatory, other`

But the frontend `apiDatabase.ts` and `database.ts` only define **4**: `vacation, personal, sick, other`

Likewise, `lib/utils.ts` only has labels/colors for 4 leave types. This means 8 leave types will show as unstyled or mislabeled in the UI.

---

## 🟠 Duplicate Code

### 4. Duplicated Service Layer (Frontend)
**Severity: MEDIUM-HIGH**

The frontend has **3 layers** of service abstraction that essentially do the same thing:

1. `services/database.ts` — localStorage-based (dead code? never imported in active paths)
2. `services/apiDatabase.ts` — wraps `api.ts` with class methods
3. `services/eventService.ts` & `services/employeeService.ts` — wraps `apiDatabase.ts` again

This creates a 3-layer indirection: `Page → Service → ApiDatabase → ApiClient → HTTP`

Each layer is just a pass-through with minimal added logic. **`eventService.ts` and `employeeService.ts` are effectively useless wrappers** — every method just calls `this.db.<sameMethod>()`.

**Fix:** Eliminate `eventService.ts` and `employeeService.ts`. Have `useCalendarData.ts` call `apiDatabase.ts` directly, or better yet, call `apiClient` directly.

### 5. Duplicated Type Definitions
**Severity: MEDIUM**

The `Employee` and `Event` interfaces are defined in **multiple places**:

- `backend/src/types/index.ts` — 12 leave types
- `frontend/src/services/apiDatabase.ts` — 4 leave types
- `frontend/src/services/database.ts` — 4 leave types (dead code)
- `frontend/src/services/api.ts` — `EmployeeEvent` (yet another variant)

**Fix:** Create a shared types package in the `interface/` directory (which currently exists but is empty). Have both backend and frontend import from it.

### 6. Duplicated Leave Type Label Maps
**Severity: MEDIUM**

Leave type → Thai name mapping exists in:
- `backend/src/services/notificationService.ts` (12 types, lines 43-57)
- `frontend/src/pages/EventsManagement.tsx` `getLeaveTypeName()` (4 types, lines 163-171)
- `frontend/src/lib/utils.ts` `LEAVE_TYPE_LABELS` (4 types)

All three have overlapping data but are out of sync.

### 7. Duplicated Password Validation Logic
**Severity: MEDIUM**

The password check `body.password !== '!C@len12'` is copy-pasted 3 times in `events.ts` (lines 259, 286, 312). This should be extracted to a middleware or utility function.

```typescript
// Extract to a helper
const validateAdminPassword = (password: string): void => {
  if (!password || password !== config.adminPassword) {
    throw new Error('Invalid password');
  }
};
```

### 8. Duplicated SQL SELECT Columns (Backend)
**Severity: LOW-MEDIUM**

The exact same SQL column selection for events is repeated **~10 times** throughout `eventService.ts`:

```sql
SELECT 
  e.id,
  e.employee_id as employeeId,
  e.employee_name as employeeName,
  e.leave_type as leaveType,
  e.date,
  e.start_date as startDate,
  e.end_date as endDate,
  e.description,
  e.created_at as createdAt,
  e.updated_at as updatedAt
FROM events e
```

**Fix:** Extract to a constant:
```typescript
const EVENT_SELECT_COLUMNS = `
  e.id,
  e.employee_id as employeeId,
  e.employee_name as employeeName,
  e.leave_type as leaveType,
  e.date,
  e.start_date as startDate,
  e.end_date as endDate,
  e.description,
  e.created_at as createdAt,
  e.updated_at as updatedAt
`;
```

### 9. Duplicated Daily/Weekly Notification Methods
**Severity: MEDIUM**

In `cronjobService.ts`, there are near-identical method pairs:
- `executeNotification` / `executeNotificationWithError`
- `executeDailyNotification` / `executeDailyNotificationWithError`
- `executeWeeklyNotification` / `executeWeeklyNotificationWithError`

Similarly in `notificationService.ts`:
- `sendTeamsNotification` / `sendTeamsNotificationWithError`
- `sendEventsNotification` / `sendEventsNotificationWithError`
- `sendWeeklyEventsNotification` / `sendWeeklyEventsNotificationWithError`

**Fix:** Always use the `WithError` variant and let callers decide whether to use the error info. This cuts the method count in half.

### 10. Duplicated Adaptive Card Payload Structure
**Severity: MEDIUM**

`notificationService.ts` has `createTeamsPayload()` and `createWeeklyTeamsPayload()` with extremely similar structures — both generate Adaptive Cards with the same base layout. The "no events" and "has events" branches are nearly identical between daily and weekly.

**Fix:** Create a shared `createBaseAdaptiveCard()` method and customize only the header/content.

---

## 🟡 Best Practice Issues

### 11. Mixed Data Access Patterns (Backend)
**Severity: MEDIUM-HIGH**

The backend inconsistently uses **two** database access patterns:
- **Raw SQL via `bun:sqlite`**: `eventService.ts`, `employeeService.ts`, `cronjobService.ts`, `eventMergeService.ts`
- **Prisma ORM**: `companyHolidayService.ts`, `holidayService.ts`

This creates confusion and makes maintenance harder. Choose one approach.

### 12. No Proper Error Response Format (Backend)
**Severity: MEDIUM**

Routes inconsistently handle errors:
- `cronjobs.ts` returns `{ success: false, error: '...' }` (catches errors)
- `events.ts` and `employees.ts` re-throw errors (lets Elysia handle them)

There's no standardized error response shape. Some endpoints return `{ success, data }`, others return raw data.

### 13. Inconsistent Logging (Backend)
**Severity: LOW-MEDIUM**

- `events.ts`, `employees.ts` → Uses `Logger` (winston)
- `cronjobs.ts` → Uses `console.error` / `console.log`
- `cronjobService.ts` → Uses `console.log` / `console.error`
- `notificationService.ts` → Uses `console.log` / `console.error`

**Fix:** Use `Logger` everywhere consistently.

### 14. Dead Code (Frontend)
**Severity: LOW**

- `services/database.ts` — A full localStorage-based database service (225 lines). This appears to be the original implementation before the API backend was added. If it's no longer used, remove it.
- `frontend/src/utils/` — An empty directory.
- `frontend/src/services/holidayService.ts` — Contains ~30 lines of commented-out translation code.

### 15. Frontend Page Components Too Large
**Severity: MEDIUM**

- `CalendarGrid.tsx` — 805 lines
- `EventsManagement.tsx` — 773 lines
- `CronjobConfig.tsx` — 713 lines

These should be broken down into smaller components and custom hooks.

### 16. No Input Validation / Sanitization
**Severity: MEDIUM**

While Elysia's `t.Object()` provides basic type validation, there's no:
- Date format validation (any string is accepted for dates)
- Length limits on most string fields
- SQL injection protection (though prepared statements help)

### 17. Missing Prisma Singleton (Backend)
**Severity: LOW**

`companyHolidayService.ts` creates `new PrismaClient()` in its constructor, meaning every `new CompanyHolidayService()` creates a new Prisma client. Meanwhile, `prisma.ts` already provides a proper singleton.

```typescript
// companyHolidayService.ts — BAD
constructor() {
  this.prisma = new PrismaClient(); // Creates new client each time
}

// Should use:
import { prisma } from '../database/prisma';
```

### 18. Missing `interface/` Shared Types
**Severity: MEDIUM**

The `interface/` directory exists at the project root but is empty. This was likely intended for shared types between frontend and backend but never implemented.

---

## 🟢 What's Good

1. **Project structure** — Clear separation between backend/frontend with logical directory organization
2. **Singleton pattern** — Properly used for `DatabaseConnection` and service instances
3. **Cron scheduling** — Clean implementation using Elysia Cron plugin
4. **Swagger documentation** — API is self-documented
5. **Logger setup** — Winston logger with file + console transports (just not used everywhere)
6. **TypeScript throughout** — Both frontend and backend are fully typed
7. **Custom hooks pattern** — `useCalendarData`, `useHolidays`, `useCompanyHolidays` follow React best practices
8. **Event merge service** — Well-documented business logic with clear comments

---

## 📊 Priority Action Items

| Priority | Issue | Effort |
|---|---|---|
| 🔴 P0 | Move secrets to env vars (#1, #2) | Small |
| 🔴 P0 | Sync frontend leaveType with backend (#3) | Small |
| 🟠 P1 | Remove dead service layers (#4) | Medium |
| 🟠 P1 | Unify type definitions (#5) | Medium |
| 🟠 P1 | Fix mixed data access patterns (#11) | Large |
| 🟠 P1 | Merge duplicate notification methods (#9, #10) | Medium |
| 🟡 P2 | Extract SQL constants (#8) | Small |
| 🟡 P2 | Standardize error responses (#12) | Medium |
| 🟡 P2 | Use Logger everywhere (#13) | Small |
| 🟡 P2 | Remove dead code (#14) | Small |
| 🟢 P3 | Break up large page components (#15) | Large |
| 🟢 P3 | Fix Prisma singleton usage (#17) | Small |
