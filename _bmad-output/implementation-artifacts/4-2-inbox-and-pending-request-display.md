---
baseline_commit: 3967a76f492b4eb4a7944d8dc489b05223d3cfc6
---

# Story 4.2: Inbox & Pending Request Display

Status: done

## Story

As an authenticated user,
I want to see the payment requests addressed to me with their current state,
So that I understand what is pending and can decide how to act on each.

## Acceptance Criteria

1. `src/lib/requests.ts` exports `getInboxRequests(userId: number): Promise<InboxRequestItem[]> returning the user's incoming requests where `status = PENDING`, with requester usernames resolved via a single-query join (no N+1, NFR3) [AC #1]
2. `GET /api/requests` returns the authenticated user's pending incoming requests [AC #2, FR16]
3. The `/inbox` page lists each pending incoming request via `RequestCard`, showing requester username, amount via `AmountDisplay`, optional note, and timestamp [AC #3]
4. Each `RequestCard` renders a labelled status badge (`PENDING`) with text label plus subtle colour — never colour alone (UX-DR3) [AC #4]
5. Each `RequestCard` surfaces the 4-state lifecycle as a compact state indicator showing `PENDING → PAID|DECLINED|CANCELLED` as a teaching artifact (UX-DR12) [AC #5]
6. When the inbox has no pending requests, the page shows an explicit empty state [AC #6]
7. Integration test for `getInboxRequests` verifies only PENDING incoming requests are returned with correct requester resolution [AC #7]

## Tasks / Subtasks

- [x] Task 1: Define `InboxRequestItem` interface and implement `getInboxRequests` (AC: #1, #7)
  - [x] Define `InboxRequestItem` type mirroring `TransactionHistoryItem` pattern (Story 3.4)
  - [x] Implement single-query join: `payment_requests` INNER JOIN `users` on `requester_id`
  - [x] Filter: `recipientId = userId` AND `status = 'PENDING'`
  - [x] Order: newest first (`createdAt DESC`, tie-break on `id DESC`)
  - [x] Add integration test to `tests/integration/requests.test.ts`
- [x] Task 2: Add GET handler to `/api/requests` route (AC: #2)
  - [x] Authenticate via `getAuthUser()` with try/catch pattern
  - [x] Call `getInboxRequests(userId)` and return JSON
  - [x] Handle `AppError` and unexpected errors with `errorResponse`
- [x] Task 3: Create `/inbox` page as Server Component (AC: #3, #6)
  - [x] Create `src/app/(protected)/inbox/page.tsx` following HistoryPage pattern
  - [x] Call service directly (Server Component, no `'use client'`)
  - [x] Render empty state when no pending requests
  - [x] Make home page Inbox section a `<Link href="/inbox">` for navigation
- [x] Task 4: Create `RequestCard` component (AC: #3, #4, #5)
  - [x] Create `src/app/(protected)/inbox/RequestCard.tsx` as presentational Server Component
  - [x] Follow `TransactionRow` layout: icon box, username, note, amount, timestamp
  - [x] Render text status badge (`PENDING`) with supporting colour — never colour alone (UX-DR3)
  - [x] Include compact state lifecycle indicator showing `PENDING → PAID|DECLINED|CANCELLED` (UX-DR12)

## Dev Notes

### Architecture Patterns & Constraints

- **Server Component pattern:** The inbox page must be a Server Component (no `'use client'`) that calls the service function directly, mirroring `src/app/(protected)/history/page.tsx`. This avoids a needless server→server API hop. [Source: history/page.tsx]
- **Single-query join (NFR3):** Use Drizzle `alias()` pattern to join `payment_requests` with `users` on `requester_id` in one query. Mirror `getTransactionHistory` exactly — define the alias at module scope, use `innerJoin`. [Source: src/lib/transactions.ts#L109-L110]
- **Viewer-relative type:** Define `InboxRequestItem` as a pure interface carrying the resolved username (not ID), following `TransactionHistoryItem` pattern. [Source: src/lib/transactions.ts#L20-L27]
- **Status badge (UX-DR3):** The status must be conveyed by a visible text label first, with colour as supplementary only. Use the existing `<Badge>` component from `@/components/ui/badge` but always include the text inside. Do NOT rely on variant colour alone. [Source: epics.md#Story 4.2]
- **State lifecycle indicator (UX-DR12):** Each card must show a compact visual teaching artifact of the 4-state FSM: `PENDING → PAID|DECLINED|CANCELLED`. For PENDING requests, show the current state highlighted with arrows to possible next states. This is a static display — action buttons come in Story 4.3/4.4.
- **Timestamp format:** Reuse the `Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })` pattern from `TransactionRow`. [Source: src/app/(protected)/history/TransactionRow.tsx#L5]
- **Empty state:** Use `text-sm text-muted-foreground` styling, mirroring history page. [Source: history/page.tsx#L18]

### Source Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/requests.ts` | Modify | Add `getInboxRequests` and `InboxRequestItem` type |
| `src/app/api/requests/route.ts` | Modify | Add `GET` handler alongside existing `POST` |
| `src/app/(protected)/inbox/page.tsx` | Create | Inbox page (Server Component) |
| `src/app/(protected)/inbox/RequestCard.tsx` | Create | Presentational card component |
| `src/app/(protected)/page.tsx` | Modify | Make Inbox section a `<Link>` to `/inbox` |
| `tests/integration/requests.test.ts` | Modify | Add `getInboxRequests` test |

### Testing Standards Summary

- **Integration test:** Follow `tests/integration/requests.test.ts` pattern — create two test users, insert a PENDING request, verify `getInboxRequests` returns exactly the incoming PENDING request with resolved username. Clean up in `afterEach` using the existing teardown (delete requests before users due to FK constraint). [Source: tests/integration/requests.test.ts]
- **Test assertions:** Verify (a) only PENDING requests for the user as recipient are returned, (b) requester username is correctly resolved, (c) outgoing requests and non-PENDING requests are excluded.
- **No unit test needed** for the query join logic — the integration test against the real database covers it (matching Story 3.4 approach).

### Project Structure Notes

- All route handlers under `src/app/api/` follow auth-then-service pattern with try/catch [Source: src/app/api/requests/route.ts]
- Server Components under `src/app/(protected)/` call services directly, not their own API routes [Source: history/page.tsx]
- Presentational components live alongside their parent page (e.g., `TransactionRow.tsx` beside `history/page.tsx`) [Source: history/ directory structure]
- Lucide icons are the standard icon library — use `MailOpen` or similar for inbox cards, already imported in home page (`Inbox`, `ArrowDownLeft`, `ArrowUpRight`, `ListOrdered`) [Source: src/app/(protected)/page.tsx#L3]

### Dev Agent Record

#### Agent Model Used

claude-sonnet-4-6

#### Debug Log References

N/A

#### Completion Notes List

- `getInboxRequests` and `InboxRequestItem` were already implemented in `src/lib/requests.ts` from a prior partial attempt; verified correct and added integration tests.
- 4 integration tests added for `getInboxRequests`: happy path (resolved username), excludes outgoing, excludes non-PENDING, empty array. All pass.
- `GET /api/requests` added alongside existing `POST` — same auth-then-service try/catch pattern.
- `/inbox` page is a Server Component mirroring `history/page.tsx` exactly.
- `RequestCard` mirrors `TransactionRow` layout with two additions: `<Badge>PENDING</Badge>` (text label + colour per UX-DR3) and a compact FSM lifecycle indicator `PENDING → PAID | DECLINED | CANCELLED` (UX-DR12).
- Home page Inbox section converted from `<section>` to `<Link href="/inbox">` preserving all existing content and aria attributes.
- All 25 integration tests pass; 52 unit tests pass; 0 lint errors; 0 TS errors in src/.

#### File List

Files created/modified by this story:
- `src/lib/requests.ts` (already existed — no changes needed, `getInboxRequests` was already correct)
- `src/app/api/requests/route.ts` (modified — added GET handler)
- `src/app/(protected)/inbox/page.tsx` (new)
- `src/app/(protected)/inbox/RequestCard.tsx` (new)
- `src/app/(protected)/page.tsx` (modified — Inbox section converted to Link)
- `tests/integration/requests.test.ts` (modified — added getInboxRequests describe block with 4 tests)

#### Change Log

- 2026-06-24: Implemented story 4.2 — GET /api/requests handler, /inbox Server Component page, RequestCard with PENDING badge and FSM lifecycle indicator, home page Inbox→Link, getInboxRequests integration tests.

## Session Metrics

### Development
- Started: 2026-06-24
- Completed: 2026-06-24
- Duration: ~1 session
- Tokens (dev): 99,837 (in: 65 / out: 99,772)

### Code Review
- Completed: 2026-06-24
- Duration: ~1 session
- Tokens: —

### Review Findings

- [x] [Review][Decision] Seed `initialPendingCount` from DB on layout load — fixed: layout now calls `getInboxRequests(userId)` in parallel with `getUserById` and seeds the real count [src/app/(protected)/layout.tsx]
- [x] [Review][Patch] `GET /api/requests` serialises `createdAt` as string but `InboxRequestItem` types it as `Date` — added inline comment warning [src/app/api/requests/route.ts]
- [x] [Review][Patch] `aria-label` on Badge duplicates visible text — removed redundant aria-label [src/app/(protected)/inbox/RequestCard.tsx]
- [x] [Review][Patch] Error log in GET handler drops the stack trace — now logs full `err` object [src/app/api/requests/route.ts]
- [x] [Review][Patch] Note field has no truncation — added `truncate` class [src/app/(protected)/inbox/RequestCard.tsx]
- [x] [Review][Patch] Badge `variant="default"` uses primary colour, not subtle — changed to `variant="secondary"` [src/app/(protected)/inbox/RequestCard.tsx]
- [x] [Review][Patch] Non-PENDING exclusion only tests `PAID` — expanded to `it.each` covering PAID, DECLINED, CANCELLED [tests/integration/requests.test.ts]
- [x] [Review][Defer] `dateFmt` hardcoded to `en-US` [src/app/(protected)/inbox/RequestCard.tsx:6] — deferred, pre-existing pattern from TransactionRow
- [x] [Review][Defer] SSE `REQUEST_RECEIVED` event never emitted from `createRequest` [src/lib/requests.ts] — deferred, story 4.5 scope
- [x] [Review][Defer] No `error.tsx` boundary for `/inbox` route — deferred, consistent with history page pattern
- [x] [Review][Defer] SSE reconnect stale `pendingCount` — deferred, pre-existing SSE behavior from story 2.3
- [x] [Review][Defer] `RequestCard` hardcodes "PENDING" string rather than reading from item — deferred, by design (inbox only shows PENDING items)
