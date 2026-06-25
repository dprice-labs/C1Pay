---
baseline_commit: 9258804f90772de0646440c8933c3f14d09d174c
---

# Bug 22: Auth Infrastructure Errors Silently Return 401 Instead of 500

**Status:** review
**GitHub Issue:** #22
**Type:** Bug

---

## Problem

Every API route calls `getAuthUser()` inside a `try/catch`. The catch block correctly returns `401` when `getAuthUser()` throws an `AppError` (e.g. missing/invalid JWT). But for **any other exception** (DB connection failure, network timeout, unexpected crash), it falls through to the same `return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)` fallback — masking the real error as an auth failure.

This means a Postgres outage during session lookup looks identical to an unauthenticated request, both to the client and to monitoring/alerting.

---

## Acceptance Criteria

- **AC1:** When `getAuthUser()` throws a non-`AppError` exception, all affected routes return `500 INTERNAL_ERROR` (not `401 UNAUTHORIZED`).
- **AC2:** When `getAuthUser()` throws an `AppError`, the existing behaviour is preserved — the `AppError`'s status/code is used (typically `401`).
- **AC3:** The unexpected exception is logged (via the route's existing `log.error`) before the 500 is returned.
- **AC4:** All 6 affected handlers are fixed — no affected route is left with the old fallback.

---

## Affected Files

All routes with the `getAuthUser()` catch-fallback pattern — more than the issue identified:

| File | Handlers |
|------|----------|
| `src/app/api/requests/route.ts` | `GET`, `POST` |
| `src/app/api/transactions/route.ts` | `GET`, `POST` |
| `src/app/api/sse/route.ts` | `GET` |
| `src/app/api/requests/[id]/route.ts` | `PATCH` |
| `src/app/api/users/search/route.ts` | `GET` |

`src/app/api/balance/route.ts` uses a single merged `try/catch` that already handles infrastructure errors as 500 — **not affected**.

---

## Fix

In every affected handler, change:

```ts
// BEFORE
try {
  ;({ userId } = await getAuthUser())
} catch (err) {
  if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
  return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
}
```

to:

```ts
// AFTER
try {
  ;({ userId } = await getAuthUser())
} catch (err) {
  if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
  log.error(`unexpected error in getAuthUser: ${err instanceof Error ? err.message : String(err)}`)
  return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
}
```

All affected routes already import `log` from `createLogger` — no new imports needed.

---

## Dev Notes

- Make the same change in all 6 handlers listed above. This is a mechanical find-and-replace — do not miss any.
- `src/app/api/sse/route.ts` uses `log` (verify it's in scope before adding the `log.error` call).
- Do **not** change `src/app/api/balance/route.ts` — it is not affected.
- Do **not** change the `AppError` branch — only the non-`AppError` fallback changes.
- No schema changes, no new dependencies, no new files.

---

## Testing

### Unit tests

Add/update unit tests in `tests/unit/` (or wherever route handler tests live) covering:

- When `getAuthUser()` throws a non-`AppError` (e.g. `new Error('DB down')`), the handler returns 500 with `code: 'INTERNAL_ERROR'`.
- When `getAuthUser()` throws an `AppError` with status 401, the handler still returns 401 (regression guard).

### Manual smoke test

1. Mock `getAuthUser` to throw a plain `Error`.
2. Call any affected endpoint.
3. Assert response status is `500` and body contains `"INTERNAL_ERROR"`.

---

## Session Metrics

### Development
- Started: 2026-06-25T00:00:00
- Completed: 2026-06-25
- Duration: —
- Tokens (dev): —

### Code Review
- Completed: —
- Duration: —
- Tokens: —

---

## Dev Agent Record

### Implementation Notes

- Fixed 6 handlers across 5 route files — every `getAuthUser()` catch block that previously fell through to `401 UNAUTHORIZED` for non-`AppError` exceptions now returns `500 INTERNAL_ERROR` with a `log.error` call.
- `src/app/api/sse/route.ts` had no logger — added `createLogger('sse-route')` import and `const log` declaration.
- `src/app/api/balance/route.ts` was confirmed not affected (single merged try/catch already 500s correctly).
- No schema changes, no new dependencies, no new files beyond the test file.

### Completion Notes

All 4 acceptance criteria satisfied:
- AC1 ✅ Non-`AppError` from `getAuthUser()` → 500 INTERNAL_ERROR in all 6 handlers
- AC2 ✅ `AppError` branch unchanged — still returns the AppError's own status/code (verified by regression guard tests)
- AC3 ✅ `log.error(...)` called before the 500 response in every handler
- AC4 ✅ All 6 affected handlers fixed; confirmed by reading each file and 14 passing unit tests

### File List

| File | Status |
|------|--------|
| `src/app/api/requests/route.ts` | Modified |
| `src/app/api/transactions/route.ts` | Modified |
| `src/app/api/sse/route.ts` | Modified |
| `src/app/api/requests/[id]/route.ts` | Modified |
| `src/app/api/users/search/route.ts` | Modified |
| `tests/unit/api/auth-error-handling.test.ts` | Added |

### Change Log

| Date | Change |
|------|--------|
| 2026-06-25 | Fixed 6 getAuthUser() catch fallbacks to return 500 instead of 401 for infrastructure errors (GH #22) |
| 2026-06-25 | Added createLogger to sse/route.ts (previously had no logger) |
| 2026-06-25 | Added 14 unit tests covering 500/401 behaviour across all affected handlers |
