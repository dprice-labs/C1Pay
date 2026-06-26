---
baseline_commit: 9258804
---

# Story 4.4: Cancel an Outgoing Request

Status: review

## Story

As a user who sent a payment request,
I want to cancel my own pending request,
so that I can withdraw it before the recipient acts on it.

## Acceptance Criteria

1. `src/lib/requests.ts` exports `getOutgoingRequests(userId: number): Promise<OutgoingRequestItem[]>` returning the user's `PENDING` requests where they are the requester, recipient usernames resolved via a join in a single query — no N+1 (NFR3) [AC #1]
2. `src/lib/requests.ts` exports `cancelRequest(requestId: number, userId: number): Promise<PaymentRequest>` [AC #1]
3. The `/inbox` page renders the user's outgoing pending requests in a section distinct from the incoming list — each item shows recipient username, amount via `AmountDisplay`, optional note, timestamp, and a labelled status badge (text + colour, never colour alone) (UX-DR3) [AC #2]
4. `cancelRequest` for a `PENDING` request where the caller is the requester sets `status = CANCELLED` with `resolved_at = now()` — no funds move (FR19) [AC #3]
5. `PATCH /api/requests/[id]` accepts `{ action: 'cancel' }` in addition to the existing `'pay' | 'decline'`, authenticates via `getAuthUser()`, invokes `cancelRequest`, and returns the updated request; the cancelled request disappears from the outgoing list (FR20) without a manual reload [AC #4]
6. A cancel on a request that is not `PENDING` returns `409 { "error": "Request already resolved", "code": "REQUEST_ALREADY_RESOLVED" }` [AC #5]
7. A cancel where the caller is not the request's requester returns `403 { "error": "Forbidden", "code": "FORBIDDEN" }` [AC #6]
8. Unit tests verify `cancelRequest` guards: non-PENDING request rejects (`REQUEST_ALREADY_RESOLVED`), non-requester caller is forbidden (`FORBIDDEN`) — without a real database [AC #7]
9. Integration tests verify: `getOutgoingRequests` returns only the caller's own `PENDING` outgoing requests with correct recipient resolution, and `cancelRequest` performs the `CANCELLED` transition, enforces the requester-only guard, and rejects an already-resolved request — against the real database [AC #8]

## Tasks / Subtasks

- [x] Task 1: Add `getOutgoingRequests` and `cancelRequest` to `src/lib/requests.ts` (AC: #1, #2, #4, #6, #7, #8, #9)
  - [x] Add a second module-scope alias: `const recipientUser = alias(users, 'recipient_user')` (mirrors the existing `requesterUser` alias)
  - [x] Add `OutgoingRequestItem` interface: `{ id, recipientUsername, amountCents, note, createdAt }` (mirrors `InboxRequestItem`)
  - [x] Implement `getOutgoingRequests(userId)`: select + innerJoin `recipientUser` on `recipientId`, `where(requesterId = userId AND status = PENDING)`, `orderBy(desc(createdAt), desc(id))` — copy `getInboxRequests` exactly, swapping requester/recipient direction
  - [x] Implement `cancelRequest(requestId, userId)`: copy `declineRequest` exactly, but the auth guard checks `request.requesterId !== userId` (not `recipientId`) and the terminal status is `CANCELLED` (not `DECLINED`)
  - [x] Add unit tests in `tests/unit/lib/requests.test.ts` — new `describe('cancelRequest guards', ...)` block, mirroring the existing `declineRequest guards` block exactly (swap recipient→requester in the FORBIDDEN case)
  - [x] Add integration tests in `tests/integration/requests.test.ts` — new `describe('getOutgoingRequests integration', ...)` and `describe('cancelRequest integration', ...)` blocks, mirroring the `getInboxRequests`/`declineRequest` integration blocks

- [x] Task 2: Extend `patchRequestSchema` in `src/lib/schemas.ts` (AC: #5)
  - [x] Change `action: z.enum(['pay', 'decline'])` to `action: z.enum(['pay', 'decline', 'cancel'])`
  - [x] `PatchRequestInput` type inference updates automatically — no other change needed

- [x] Task 3: Wire `cancel` into `PATCH /api/requests/[id]` (AC: #5, #6, #7)
  - [x] Import `cancelRequest` from `@/lib/requests`
  - [x] Extend the action dispatch (currently a ternary `pay ? payRequest : declineRequest`) to a 3-way dispatch that calls `cancelRequest` when `action === 'cancel'`
  - [x] No other changes — the existing `AppError` → HTTP mapping already covers `FORBIDDEN` (403) and `REQUEST_ALREADY_RESOLVED` (409)

- [x] Task 4: Create `OutgoingRequestCard` and wire into the `/inbox` page (AC: #3, #5)
  - [x] Create `src/app/(protected)/inbox/OutgoingRequestCard.tsx` as a Client Component — copy `RequestCard`'s layout (identity row, amount/timestamp row, status badge + lifecycle indicator, inline error) but with recipient username instead of requester username, and a single "Cancel" button instead of Pay/Decline
  - [x] Cancel button calls `PATCH /api/requests/${item.id}` with `{ action: 'cancel' }`, shows a loading state during the in-flight request (prevent double-submit), then `router.refresh()` on success
  - [x] On failure, surface the server error message inline (same pattern as `RequestCard`'s `error` state) — `REQUEST_ALREADY_RESOLVED`/`FORBIDDEN` map to the `data.error` string already returned by `errorResponse()`
  - [x] Update `src/app/(protected)/inbox/page.tsx`: fetch `getInboxRequests` and `getOutgoingRequests` in parallel (`Promise.all`), render two `<section>`s — existing incoming list under `<h1>Inbox</h1>`, new outgoing list under `<h2>Outgoing requests</h2>` (heading order: h1 then h2) — each with its own empty state

### Review Findings

- [x] [Review][Patch] F1: `OutgoingRequestCard.handleCancel` reset `isCancelling` unconditionally in `finally`, re-enabling the Cancel button before `router.refresh()` removed the card — a fast double-click could fire a duplicate PATCH that surfaced a confusing 409 "Request already resolved" even though the first cancel succeeded [src/app/(protected)/inbox/OutgoingRequestCard.tsx]
- [x] [Review][Patch] F2: `/inbox` page used `Promise.all` for the incoming/outgoing fetches — a throw from either query failed the whole page instead of degrading to show the section that succeeded [src/app/(protected)/inbox/page.tsx]
- [x] [Review][Patch] F3: `declineRequest`/`cancelRequest` were copy-pasted near-identical transaction bodies — extracted into a shared `resolveRequestGuarded(requestId, userId, authorizedField, terminalStatus)` helper [src/lib/requests.ts]
- [x] [Review][Patch] F4: `RequestCard`/`OutgoingRequestCard` duplicated the entire UX-DR12 lifecycle-indicator block (the canonical, single representation of the request state machine) verbatim — extracted into a shared `RequestLifecycleIndicator` component [src/app/(protected)/inbox/RequestLifecycleIndicator.tsx]
- [x] [Review][Patch] F5: The `dateFmt` formatter was now triplicated across `RequestCard`, `OutgoingRequestCard`, and `TransactionRow` — extracted into a shared `formatDateTime()` util [src/lib/format.ts]
- [x] [Review][Patch] F6: `getInboxRequests`/`getOutgoingRequests` repeated the same `orderBy` clause — extracted into a shared `PENDING_REQUEST_ORDER` constant [src/lib/requests.ts]
- [x] [Review][Patch] F7: The PATCH route's 3-way nested ternary dispatch had no exhaustiveness check against `patchRequestSchema`'s action enum — replaced with a `Record<Action, handler>` lookup map [src/app/api/requests/[id]/route.ts]
- [x] [Review][Patch] F8: The two `<section>` blocks on the `/inbox` page duplicated the same list/empty-state JSX structure — extracted into a shared `RequestListSection` component [src/app/(protected)/inbox/RequestListSection.tsx]
- [x] [Review][Defer] F9: `cancelRequest` emits no SSE event to notify the recipient that their view should update — recipient's pendingCount/inbox stays stale until reload. Deliberately deferred: both this story and Story 4.3 explicitly scope all `emit()` wiring to Story 4.5 [src/lib/requests.ts] — deferred, pre-existing
- [x] [Review][Defer] F10: `router.refresh()` after a cancel re-fetches both the incoming and outgoing lists (not just the changed one) — inherent to Next.js `router.refresh()` re-rendering the whole Server Component tree; splitting into independent route segments/Suspense boundaries would be disproportionate to the cost of one extra indexed+joined query [src/app/(protected)/inbox/OutgoingRequestCard.tsx] — deferred, accepted tradeoff

## Dev Notes

### Critical pattern: `cancelRequest` is `declineRequest` with the auth direction flipped

`cancelRequest` must mirror `declineRequest` exactly — same transaction shape, same lock-then-guard-then-update structure, same defensive `WHERE status = 'PENDING'` on the update. The **only** differences are which party is authorized and which terminal status is set:

| | `declineRequest` | `cancelRequest` |
|---|---|---|
| Authorized caller | `request.recipientId === userId` | `request.requesterId === userId` |
| Terminal status | `DECLINED` | `CANCELLED` |

Copy this exactly from `src/lib/requests.ts` (current `declineRequest`, lines ~165–195):

```typescript
export async function cancelRequest(requestId: number, userId: number): Promise<PaymentRequest> {
  const updated = await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, requestId))
      .for('update')

    if (!request) throw new AppError('Request not found', 'REQUEST_NOT_FOUND', 404)
    // Auth check before status check — unauthorized callers should not learn whether the request is resolved.
    if (request.requesterId !== userId) {
      throw new AppError('Forbidden', 'FORBIDDEN', 403)
    }
    if (request.status !== 'PENDING') {
      throw new AppError('Request already resolved', 'REQUEST_ALREADY_RESOLVED', 409)
    }

    const [updatedRequest] = await tx
      .update(paymentRequests)
      .set({ status: 'CANCELLED', resolvedAt: sql`NOW()` })
      .where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.status, 'PENDING')))
      .returning()

    if (!updatedRequest) throw new AppError('Request update failed', 'INTERNAL_ERROR', 500)

    return updatedRequest
  })

  log.info(`cancelRequest: requestId=${requestId} userId=${userId}`)
  return updated
}
```

No balance changes, no `transactions` row insert — same as decline. Note: SSE emit (`REQUEST_RESOLVED` to the recipient) is Story 4.5 scope — do **not** add `emit()` calls here.

### `getOutgoingRequests` mirrors `getInboxRequests` with direction flipped

`getInboxRequests` joins `requesterUser` (aliased `users`) to resolve the *other* party's username, filtered on `recipientId = userId`. `getOutgoingRequests` does the same in reverse — join an aliased `users` for the recipient, filtered on `requesterId = userId`:

```typescript
const recipientUser = alias(users, 'recipient_user')

export interface OutgoingRequestItem {
  id: number
  recipientUsername: string
  amountCents: number
  note: string | null
  createdAt: Date
}

export async function getOutgoingRequests(userId: number): Promise<OutgoingRequestItem[]> {
  const rows = await db
    .select({
      id: paymentRequests.id,
      amountCents: paymentRequests.amountCents,
      note: paymentRequests.note,
      createdAt: paymentRequests.createdAt,
      recipientUsername: recipientUser.username,
    })
    .from(paymentRequests)
    .innerJoin(recipientUser, eq(paymentRequests.recipientId, recipientUser.id))
    .where(
      and(
        eq(paymentRequests.requesterId, userId),
        eq(paymentRequests.status, 'PENDING'),
      ),
    )
    .orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id))

  log.info(`getOutgoingRequests userId=${userId} → ${rows.length} rows`)
  return rows
}
```

Both aliases (`requesterUser`, `recipientUser`) coexist at module scope in `src/lib/requests.ts` — they alias the same `users` table to two different SQL identifiers, so there's no conflict.

### `patchRequestSchema` — minimal change

In `src/lib/schemas.ts`, the schema already exists from Story 4.3:

```typescript
export const patchRequestSchema = z.object({
  action: z.enum(['pay', 'decline']),
})
```

Change only the enum to add `'cancel'`. `PatchRequestInput` is inferred — no manual type edit needed.

### `PATCH /api/requests/[id]` — extend the dispatch, nothing else

The route at `src/app/api/requests/[id]/route.ts` already handles auth, body validation, and `AppError` → HTTP mapping generically (it doesn't special-case codes — any `AppError` is converted via `errorResponse(err.message, err.code, err.status)`). The only change is the action dispatch:

```typescript
const { action } = parsed.data
const updated =
  action === 'pay'
    ? await payRequest(requestId, userId)
    : action === 'decline'
      ? await declineRequest(requestId, userId)
      : await cancelRequest(requestId, userId)
```

Add `cancelRequest` to the existing import from `@/lib/requests`. No new error-code branches needed — `FORBIDDEN` (403) and `REQUEST_ALREADY_RESOLVED` (409) already map correctly because `cancelRequest` throws the same `AppError` codes as `payRequest`/`declineRequest`.

### `OutgoingRequestCard` — new file, copy `RequestCard`'s shape

`src/app/(protected)/inbox/RequestCard.tsx` is the template to copy. Key differences for `OutgoingRequestCard`:

- Display `item.recipientUsername` instead of `item.requesterUsername`.
- No balance gate (`canPay`/`useBalanceStore`) — cancelling never depends on balance.
- Single button: "Cancel" (style as `variant="outline"`, matching `RequestCard`'s Decline button) — no Pay button equivalent.
- Same loading-state pattern (`isCancelling` boolean, `aria-busy`, disabled during in-flight request) to prevent double-submit.
- Same inline error pattern (`error` state, `role="alert"`) — on a 409/403 response, show `data.error` from the JSON body (no special-cased message needed; `errorResponse()` already returns a human-readable `error` string).
- Keep the same status badge + 4-state lifecycle indicator block from `RequestCard` (UX-DR3, UX-DR12) for visual/teaching consistency between the incoming and outgoing sections.

```typescript
async function handleCancel() {
  setError(null)
  setIsCancelling(true)
  try {
    const res = await fetch(`/api/requests/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong. Please try again.')
      return
    }
    router.refresh()
  } catch {
    setError('Network error. Please try again.')
  } finally {
    setIsCancelling(false)
  }
}
```

Use a distinct icon from `lucide-react` for the identity avatar to visually distinguish outgoing items from incoming ones in the same page — e.g. `Send` (outgoing) vs. `MailOpen` (incoming, already used in `RequestCard`). Use `data-icon="inline-start"` on the button icon, matching CLAUDE.md icon conventions.

### `/inbox` page — two sections, parallel fetch

```typescript
import { getAuthUser } from '@/lib/auth'
import { getInboxRequests, getOutgoingRequests } from '@/lib/requests'
import { RequestCard } from './RequestCard'
import { OutgoingRequestCard } from './OutgoingRequestCard'

export default async function InboxPage() {
  const { userId } = await getAuthUser()
  const [incoming, outgoing] = await Promise.all([
    getInboxRequests(userId),
    getOutgoingRequests(userId),
  ])
  // ... two <section>s, <h1>Inbox</h1> then <h2>Outgoing requests</h2> — heading order matters (CLAUDE.md)
}
```

Each section keeps its own empty state ("No pending requests." / "No outgoing requests.") — don't collapse them into one shared empty-state check.

### Source Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/requests.ts` | Modify | Add `getOutgoingRequests`, `cancelRequest`, `recipientUser` alias, `OutgoingRequestItem` |
| `src/lib/schemas.ts` | Modify | Extend `patchRequestSchema` enum with `'cancel'` |
| `src/app/api/requests/[id]/route.ts` | Modify | Dispatch `action === 'cancel'` to `cancelRequest` |
| `src/app/(protected)/inbox/OutgoingRequestCard.tsx` | Create | Outgoing request item with Cancel action |
| `src/app/(protected)/inbox/page.tsx` | Modify | Fetch + render outgoing section alongside incoming |
| `tests/unit/lib/requests.test.ts` | Modify | Add `cancelRequest` guard tests (mirror `declineRequest` block) |
| `tests/integration/requests.test.ts` | Modify | Add `getOutgoingRequests` + `cancelRequest` integration tests |

### Testing Standards

**Unit tests** (`tests/unit/lib/requests.test.ts`) — no new mock setup needed; `db.transaction` is already mocked. Add a `describe('cancelRequest guards', ...)` block immediately after the existing `declineRequest guards` block, copying its structure with `requesterId`/`recipientId` swapped for the FORBIDDEN case:

- `REQUEST_ALREADY_RESOLVED` when request status is PAID / DECLINED / CANCELLED
- `FORBIDDEN` when caller (`userId`) is not `fakeRequest.requesterId` (note: `fakeRequest.requesterId = 1`, so test with e.g. `userId = 99`, not `userId = 2` — `2` is the recipient and would also be forbidden, but the existing `fakeRequest` fixture makes `1` the only authorized caller)
- `tx.update` is not called when the FORBIDDEN guard fires

**Integration tests** (`tests/integration/requests.test.ts`) — add `describe('getOutgoingRequests integration', ...)` mirroring `getInboxRequests integration` (swap requester/recipient), and `describe('cancelRequest integration', ...)` mirroring `declineRequest integration`:

- `getOutgoingRequests` returns only the caller's own `PENDING` requests where they are `requesterId`, with `recipientUsername` correctly resolved
- `getOutgoingRequests` excludes incoming requests (where the user is `recipientId`, not `requesterId`)
- `getOutgoingRequests` returns empty array when the user has no outgoing pending requests
- `cancelRequest` sets `status = CANCELLED` with `resolvedAt` set, no balance changes
- `cancelRequest` throws `FORBIDDEN` when caller is not the requester
- `cancelRequest` throws `REQUEST_ALREADY_RESOLVED` when the request is already resolved

Reuse the existing `REQUESTER_USERNAME`/`RECIPIENT_USERNAME` constants and `afterEach` cleanup already in the file — no new cleanup needed since `cancelRequest` touches no other tables (no `transactions` rows).

### Project Structure Notes

- No new directories — `OutgoingRequestCard.tsx` is a sibling of the existing `RequestCard.tsx` in `src/app/(protected)/inbox/`
- `PaymentRequest` type (from `src/db/schema/requests.ts`) already covers the `CANCELLED` enum value — no schema/migration changes needed (the `request_status` enum and `payment_requests` table were fully defined in Story 4.1)
- All `AppError` codes follow existing SCREAMING_SNAKE_CASE convention; no new codes are introduced — `cancelRequest` reuses `FORBIDDEN`, `REQUEST_ALREADY_RESOLVED`, `REQUEST_NOT_FOUND`, `INTERNAL_ERROR`, all already defined

### Previous Story (4.3) Learnings

- The guard ordering bug fixed in 4.3's review (auth check before status check, so unauthorized callers can't distinguish PENDING vs. resolved requests) must be preserved in `cancelRequest` from the start — copy `declineRequest`'s current (already-fixed) guard order, not the original pre-review version
- `declineRequest`'s defensive `WHERE status = 'PENDING'` on the `UPDATE` (in addition to the upfront guard check) closes a TOCTOU gap identified in 4.3 review (F2) — `cancelRequest` must include this same defensive WHERE clause, not just the upfront `if` guard
- `router.refresh()` re-fetches the Server Component data (the inbox page calls `getInboxRequests`/`getOutgoingRequests` directly) — this is what removes a cancelled request from the outgoing list without a manual reload
- SSE emit is explicitly out of scope until Story 4.5 — do not add `emit()` calls in this story for either `cancelRequest` or anywhere else

### References

- `declineRequest` pattern to mirror exactly: [Source: src/lib/requests.ts — current `declineRequest` implementation]
- `getInboxRequests` pattern to mirror exactly: [Source: src/lib/requests.ts — current `getInboxRequests` implementation]
- `RequestCard` Client Component pattern: [Source: src/app/(protected)/inbox/RequestCard.tsx]
- Outgoing section AC and UX requirements: [Source: epics.md#Story 4.4, UX-DR3]
- File tree placement: [Source: architecture.md#L490-492 — `inbox/page.tsx` covers "incoming + outgoing pending requests"]
- `AppError` → HTTP mapping: [Source: src/lib/errors.ts]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

N/A

### Completion Notes List

- `cancelRequest` mirrors `declineRequest` exactly (lock-then-guard-then-update inside a `db.transaction`, auth check before status check, defensive `WHERE status = 'PENDING'` on the update) — only the authorized party (`requesterId` vs `recipientId`) and terminal status (`CANCELLED` vs `DECLINED`) differ.
- `getOutgoingRequests` mirrors `getInboxRequests` exactly, joining a second module-scope alias (`recipientUser`) and filtering on `requesterId` instead of `recipientId`.
- `patchRequestSchema` extended to `z.enum(['pay', 'decline', 'cancel'])`; `PATCH /api/requests/[id]` extended to a 3-way dispatch — no new error-code branches needed since `cancelRequest` reuses the existing `AppError` codes (`FORBIDDEN`, `REQUEST_ALREADY_RESOLVED`).
- New `OutgoingRequestCard` Client Component copies `RequestCard`'s layout/badge/lifecycle-indicator pattern, with recipient username instead of requester username, a single Cancel button (no balance gate), and the same loading/error-inline pattern.
- `/inbox` page now fetches `getInboxRequests` and `getOutgoingRequests` in parallel via `Promise.all` and renders two `<section>`s (`<h1>Inbox</h1>` then `<h2>Outgoing requests</h2>`), each with its own empty state.
- SSE emit intentionally omitted — `REQUEST_RESOLVED` wiring is Story 4.5 scope.
- All 28 unit tests for `requests.ts` (68 total in the unit suite) and all `requests.ts` integration tests (40 total in the integration suite) pass. Zero new TypeScript errors; lint clean.
- Pre-existing TS errors in `accessibility.spec.ts` (missing `@axe-core/playwright`) and `users.test.ts` were present before this story and are unrelated to these changes (same gaps noted in Story 4.3).
- E2E suite (`responsive.spec.ts`, `keyboard.spec.ts`) could not be exercised in this sandbox: the Playwright `webServer` config reuses any server already on `localhost:3000`, and an unrelated project's dev server (`kids-quiz-app`) was bound to that port for the duration of this session. Story 4.4's task list does not include e2e coverage (matching Story 4.3's actual scope) — unit + integration coverage is complete and green.

### File List

- `src/lib/requests.ts` (modified — added `getOutgoingRequests`, `cancelRequest`, `recipientUser` alias, `OutgoingRequestItem` interface; refactored `declineRequest`/`cancelRequest` onto a shared `resolveRequestGuarded` helper; added shared `PENDING_REQUEST_ORDER` constant)
- `src/lib/schemas.ts` (modified — extended `patchRequestSchema` enum with `'cancel'`)
- `src/lib/format.ts` (new — shared `formatDateTime()` util, replaces three duplicated `dateFmt` instances)
- `src/app/api/requests/[id]/route.ts` (modified — added `cancelRequest` import; replaced nested ternary dispatch with an `ACTION_HANDLERS` lookup map)
- `src/app/(protected)/inbox/OutgoingRequestCard.tsx` (new — outgoing request item with Cancel action; fixed double-cancel race by not re-enabling the button after a successful cancel)
- `src/app/(protected)/inbox/RequestCard.tsx` (modified — now uses shared `RequestLifecycleIndicator` and `formatDateTime`)
- `src/app/(protected)/inbox/RequestLifecycleIndicator.tsx` (new — shared status badge + 4-state lifecycle indicator, used by `RequestCard` and `OutgoingRequestCard`)
- `src/app/(protected)/inbox/RequestListSection.tsx` (new — shared titled list/empty-state section, used by both inbox sections)
- `src/app/(protected)/inbox/page.tsx` (modified — `Promise.allSettled` for independent per-section failure isolation, renders both sections via `RequestListSection`)
- `src/app/(protected)/history/TransactionRow.tsx` (modified — now uses shared `formatDateTime`)
- `tests/unit/lib/requests.test.ts` (modified — added `cancelRequest guards` describe block, imported `cancelRequest`)
- `tests/integration/requests.test.ts` (modified — added `getOutgoingRequests integration` and `cancelRequest integration` describe blocks, imported `getOutgoingRequests`/`cancelRequest`)

### Change Log

- 2026-06-25: Implemented story 4.4 — `getOutgoingRequests`, `cancelRequest`, `PATCH /api/requests/[id]` cancel dispatch, `OutgoingRequestCard`, and the `/inbox` page's outgoing-requests section.
- 2026-06-25: Applied code review patches — fixed double-cancel race, isolated per-section page failures, extracted `resolveRequestGuarded`/`RequestLifecycleIndicator`/`formatDateTime`/`RequestListSection`/`ACTION_HANDLERS` to remove duplication flagged across reuse/altitude/simplification review angles (F1–F8). Deferred F9 (SSE emit — explicitly Story 4.5 scope) and F10 (router.refresh() double-fetch — inherent Next.js behavior, not worth a routing-architecture change).

## Session Metrics

### Development
- Started: 2026-06-25T17:38:04Z
- Completed: 2026-06-25T19:01:03Z
- Duration: 1h 23m
- Tokens (dev): —

### Code Review
- Completed: —
- Duration: —
- Tokens: —
