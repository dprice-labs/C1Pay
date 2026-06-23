# Story 4.2: Inbox & Pending Request Display

Status: ready-for-dev

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

- [ ] Task 1: Define `InboxRequestItem` interface and implement `getInboxRequests` (AC: #1, #7)
  - [ ] Define `InboxRequestItem` type mirroring `TransactionHistoryItem` pattern (Story 3.4)
  - [ ] Implement single-query join: `payment_requests` INNER JOIN `users` on `requester_id`
  - [ ] Filter: `recipientId = userId` AND `status = 'PENDING'`
  - [ ] Order: newest first (`createdAt DESC`, tie-break on `id DESC`)
  - [ ] Add integration test to `tests/integration/requests.test.ts`
- [ ] Task 2: Add GET handler to `/api/requests` route (AC: #2)
  - [ ] Authenticate via `getAuthUser()` with try/catch pattern
  - [ ] Call `getInboxRequests(userId)` and return JSON
  - [ ] Handle `AppError` and unexpected errors with `errorResponse`
- [ ] Task 3: Create `/inbox` page as Server Component (AC: #3, #6)
  - [ ] Create `src/app/(protected)/inbox/page.tsx` following HistoryPage pattern
  - [ ] Call service directly (Server Component, no `'use client'`)
  - [ ] Render empty state when no pending requests
  - [ ] Make home page Inbox section a `<Link href="/inbox">` for navigation
- [ ] Task 4: Create `RequestCard` component (AC: #3, #4, #5)
  - [ ] Create `src/app/(protected)/inbox/RequestCard.tsx` as presentational Server Component
  - [ ] Follow `TransactionRow` layout: icon box, username, note, amount, timestamp
  - [ ] Render text status badge (`PENDING`) with supporting colour — never colour alone (UX-DR3)
  - [ ] Include compact state lifecycle indicator showing `PENDING → PAID|DECLINED|CANCELLED` (UX-DR12)

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

qwen3.6:27b

#### Debug Log References

N/A — planning phase

#### Completion Notes List

- Story mirrors 3.4 (Transaction History) patterns exactly for consistency
- State lifecycle indicator (UX-DR12) is a new UI element not present in TransactionRow — this is the key differentiator
- The `getInboxRequests` query is simpler than `getTransactionHistory`: one join (requester only), single WHERE clause (recipientId + PENDING status)
- Home page Inbox section currently shows Badge but is not clickable — converting to Link is a minimal change

#### File List

Files created/modified by this story:
- `src/lib/requests.ts`
- `src/app/api/requests/route.ts`
- `src/app/(protected)/inbox/page.tsx` (new)
- `src/app/(protected)/inbox/RequestCard.tsx` (new)
- `src/app/(protected)/page.tsx`
- `tests/integration/requests.test.ts`
