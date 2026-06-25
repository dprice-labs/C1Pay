---
baseline_commit: 71ea28f
---

# Story 4.3: Pay & Decline a Request

Status: done

## Story

As a recipient of a payment request,
I want to pay or decline a pending request,
so that I can resolve it — transferring funds on pay, or dismissing it on decline.

## Acceptance Criteria

1. `src/lib/requests.ts` exports `payRequest(requestId: number, userId: number): Promise<PaymentRequest>` and `declineRequest(requestId: number, userId: number): Promise<PaymentRequest>` [AC #1]
2. `payRequest` for a PENDING request where the caller is the recipient opens a single Drizzle transaction that locks both parties' rows with `SELECT ... FOR UPDATE` (ascending id order, deadlock prevention), debits the payer, credits the requester, inserts a `transactions` row, and sets `status = PAID` with `resolved_at = now()` — all atomically (FR17, FR21) [AC #2]
3. `payRequest` where the payer's balance is insufficient throws `AppError` with code `INSUFFICIENT_BALANCE` — nothing persisted (FR22) [AC #3]
4. `declineRequest` for a PENDING request where the caller is the recipient sets `status = DECLINED` with `resolved_at = now()` — no funds move (FR18) [AC #4]
5. `PATCH /api/requests/[id]` accepts `{ action: 'pay' | 'decline' }`, authenticates via `getAuthUser()`, invokes the matching service, and returns the updated request [AC #5]
6. Any resolve action on a non-PENDING request returns `409 { "error": "Request already resolved", "code": "REQUEST_ALREADY_RESOLVED" }` [AC #6]
7. A PATCH where the caller is not the request's recipient returns `403 { "error": "Forbidden", "code": "FORBIDDEN" }` [AC #7]
8. A resolved request is removed from the recipient's active inbox (FR20) — the UI reflects the resolved state without a manual page reload [AC #8]
9. The Pay button in `RequestCard` is disabled (with explicit reason message) when payer's balance < request amount — "Insufficient balance — you have $X.XX, this request is for $Y.YY" — never just a grey disabled state (UX-DR7, UX-DR9) [AC #9]
10. Unit tests verify: non-PENDING request rejects pay/decline (`REQUEST_ALREADY_RESOLVED`), non-recipient caller is forbidden (`FORBIDDEN`), insufficient balance on pay (`INSUFFICIENT_BALANCE`) — all without a real database [AC #10]
11. Integration test for `payRequest` verifies: atomic debit/credit, `PAID` transition with `resolved_at` set, `transactions` row inserted, insufficient-balance guard — against the real database [AC #11]

## Tasks / Subtasks

- [x] Task 1: Add `payRequest` and `declineRequest` to `src/lib/requests.ts` (AC: #1, #2, #3, #4, #10, #11)
  - [x] Add `sql` import from `drizzle-orm` (already used in `sendMoney` — mirror that exact pattern)
  - [x] Add `transactions` import from `@/db/schema/transactions`
  - [x] Add `db.transaction` block in `payRequest` with `SELECT ... FOR UPDATE` on both users (ascending id to prevent deadlock — see `sendMoney`)
  - [x] Fetch the request row inside the transaction, verify `status === 'PENDING'` (throw `REQUEST_ALREADY_RESOLVED` 409 if not), verify `recipientId === userId` (throw `FORBIDDEN` 403 if not)
  - [x] Check payer balance >= `amountCents` (throw `INSUFFICIENT_BALANCE` 409 if not)
  - [x] Debit payer, credit requester, insert `transactions` row, update request `status = PAID` + `resolvedAt = sql\`NOW()\``
  - [x] Implement `declineRequest`: fetch request, verify PENDING + caller is recipient (same guards), update `status = DECLINED` + `resolvedAt = sql\`NOW()\`` — no balance changes, no transaction wrapper needed
  - [x] Add unit tests in `tests/unit/lib/requests.test.ts` (extend existing mock setup)
  - [x] Add integration tests in `tests/integration/requests.test.ts` (extend existing describe blocks)

- [x] Task 2: Add `patchRequestSchema` to `src/lib/schemas.ts` (AC: #5)
  - [x] `z.object({ action: z.enum(['pay', 'decline']) })`
  - [x] Export as `PatchRequestInput` type inference

- [x] Task 3: Create `src/app/api/requests/[id]/route.ts` — PATCH handler (AC: #5, #6, #7)
  - [x] Create directory `src/app/api/requests/[id]/` and `route.ts`
  - [x] Parse `params.id` as integer — return 400 if NaN
  - [x] Auth via `getAuthUser()`, parse body with `patchRequestSchema`
  - [x] Dispatch to `payRequest` or `declineRequest` based on `action`
  - [x] Map `AppError` codes to HTTP responses (409 for `REQUEST_ALREADY_RESOLVED`/`INSUFFICIENT_BALANCE`, 403 for `FORBIDDEN`, 404 for `REQUEST_NOT_FOUND`)
  - [x] Return updated `PaymentRequest` row as JSON 200

- [x] Task 4: Convert `RequestCard` to a Client Component with Pay/Decline actions (AC: #8, #9)
  - [x] Add `'use client'` directive to `src/app/(protected)/inbox/RequestCard.tsx`
  - [x] Import `useBalanceStore` from `@/store/balance` to read current balance
  - [x] Import `useRouter` from `next/navigation` for refresh after action
  - [x] Add Pay button: disabled + explicit message when `useBalanceStore.balanceCents < item.amountCents`; calls `PATCH /api/requests/${item.id}` with `{ action: 'pay' }` then `router.refresh()`
  - [x] Add Decline button: calls `PATCH /api/requests/${item.id}` with `{ action: 'decline' }` then `router.refresh()`
  - [x] Show loading state on buttons during in-flight request (prevent double-submit)
  - [x] Display error messages inline on failure (specific, not generic — UX-DR9)
  - [x] Keep all existing RequestCard content (badge, FSM indicator, amount, requester, timestamp)

### Review Findings

- [x] [Review][Patch] F1: `payRequest` TOCTOU — `paymentRequests` row not locked with `FOR UPDATE` inside transaction; concurrent pays can both read PENDING and proceed [src/lib/requests.ts]
- [x] [Review][Patch] F2: `declineRequest` non-atomic — no `db.transaction` wrapper and no `AND status = 'PENDING'` guard in UPDATE WHERE; concurrent `payRequest` can commit PAID then `declineRequest` overwrites to DECLINED with funds already moved [src/lib/requests.ts]
- [x] [Review][Patch] F3: `log.info` inside `db.transaction` callback — if logger throws it rolls back the committed payment; move log call outside the transaction [src/lib/requests.ts]
- [x] [Review][Patch] F4: auth-before-status guard ordering — RESOLVED check (409) fires before FORBIDDEN check (403) in both functions; unauthorized callers can distinguish PENDING vs resolved requests without being the recipient [src/lib/requests.ts]
- [x] [Review][Defer] F5: Stale Zustand `balanceCents` in `canPay` gate and INSUFFICIENT_BALANCE error message — Story 4.5 SSE resolution events will keep balance in sync; server enforces the guard regardless [src/app/(protected)/inbox/RequestCard.tsx] — deferred, pre-existing
- [x] [Review][Defer] F6: No `REQUEST_RESOLVED` SSE emitted when request is resolved — inbox badge count drifts until reload — Story 4.5 scope [src/lib/requests.ts] — deferred, pre-existing
- [x] [Review][Defer] F7: Self-payment guard missing in `payRequest` — `createRequest` throws `SELF_REQUEST` upstream so `recipientId === requesterId` requires upstream data corruption to reach this code [src/lib/requests.ts] — deferred, pre-existing
- [x] [Review][Defer] F8: `int4` overflow on requester balance accumulation — cross-cutting concern, already deferred from story 3.1 review [src/lib/requests.ts] — deferred, pre-existing
- [x] [Review][Defer] F9: `declineRequest` integration test coverage gap — FORBIDDEN + double-decline paths untested at integration level; not an AC11 requirement [tests/integration/requests.test.ts] — deferred, pre-existing

## Dev Notes

### Critical Architecture: Atomic `payRequest` Pattern

`payRequest` MUST mirror `sendMoney` exactly at the transaction boundary. Copy the `SELECT ... FOR UPDATE` pattern from `src/lib/transactions.ts#L46-L54`:

```typescript
// Lock in ascending id order (same deadlock prevention as sendMoney)
const rows = await tx.execute<{ id: number; balance_cents: number }>(
  sql`SELECT id, balance_cents FROM users WHERE id IN (${payerId}, ${requesterId}) ORDER BY id FOR UPDATE`
)
```

The additional step is updating the `payment_requests` row inside the same transaction — do it last (after insert of `transactions` row):

```typescript
await tx.update(paymentRequests)
  .set({ status: 'PAID', resolvedAt: sql`NOW()` })
  .where(eq(paymentRequests.id, requestId))
```

The request lookup (to get `recipientId`, `requesterId`, `amountCents`, `status`) must also happen **inside** the transaction, not before — otherwise a concurrent pay could slip through the PENDING check. Use `tx.select()`, not `db.select()`.

### `payRequest` internal order inside the transaction

1. Fetch request row with `tx.select()` + `eq(paymentRequests.id, requestId)`
2. Verify `request.status === 'PENDING'` → throw `REQUEST_ALREADY_RESOLVED` (409)
3. Verify `request.recipientId === userId` → throw `FORBIDDEN` (403)
4. Lock user rows with `SELECT ... FOR UPDATE` (ascending id order: `Math.min`/`Math.max` trick or `ORDER BY id`)
5. Verify payer balance >= `amountCents` → throw `INSUFFICIENT_BALANCE` (409)
6. Debit payer (`senderRow.balance_cents - amountCents`)
7. Credit requester (`requesterRow.balance_cents + amountCents`)
8. Insert `transactions` row: `{ senderId: userId, recipientId: request.requesterId, amountCents: request.amountCents, note: request.note }`
9. Update request: `{ status: 'PAID', resolvedAt: sql\`NOW()\` }`
10. Return updated request row (`.returning()`)

Note: SSE emit is Story 4.5. Do NOT add `emit()` calls in this story.

### `declineRequest` — simpler, no balance changes

No Drizzle transaction wrapper is needed for decline (no balance changes). Fetch the request, verify `status === 'PENDING'` + `recipientId === userId`, then:

```typescript
const [updated] = await db.update(paymentRequests)
  .set({ status: 'DECLINED', resolvedAt: sql`NOW()` })
  .where(eq(paymentRequests.id, requestId))
  .returning()
```

### PATCH Route Handler Pattern

New file: `src/app/api/requests/[id]/route.ts`

```
src/app/api/requests/
├── route.ts          ← existing (GET + POST)
└── [id]/
    └── route.ts      ← NEW (PATCH)
```

Follow auth-then-service pattern from `src/app/api/requests/route.ts`. Parse `params.id`:

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const requestId = parseInt(id, 10)
  if (isNaN(requestId)) return errorResponse('Invalid request ID', 'VALIDATION_ERROR', 400)
  ...
}
```

Note: Next.js App Router v15+ has `params` as a Promise — must be `await`ed. See existing `send/` page for reference if there are dynamic segments.

### RequestCard — Client Component Conversion

The `InboxRequestItem` type in `src/lib/requests.ts` currently has: `{ id, requesterUsername, amountCents, note, createdAt }`. No changes needed to this type — all fields needed for the UI are already there.

For the balance gate (AC #9), read from `useBalanceStore`:

```typescript
'use client'
import { useBalanceStore } from '@/store/balance'
import { useRouter } from 'next/navigation'

export function RequestCard({ item }: { item: InboxRequestItem }) {
  const balanceCents = useBalanceStore((state) => state.balanceCents)
  const router = useRouter()
  const [isPaying, setIsPaying] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canPay = balanceCents >= item.amountCents
  // ... existing card JSX + buttons
}
```

The balance comparison uses integer cents — no float conversion needed. `AmountDisplay` handles the formatting for the error message.

The Pay button disabled message must be explicit (UX-DR7):
```
"Insufficient balance — you have $X.XX, this request is for $Y.YY"
```
Use `AmountDisplay` component's output for each value, or format inline using the same cents-to-dollars conversion: `(cents / 100).toFixed(2)`.

After a successful action, call `router.refresh()` — this re-fetches the Server Component data (inbox page calls `getInboxRequests` directly), which filters out the now-resolved request.

### Source Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/requests.ts` | Modify | Add `payRequest`, `declineRequest` |
| `src/lib/schemas.ts` | Modify | Add `patchRequestSchema` + `PatchRequestInput` |
| `src/app/api/requests/[id]/route.ts` | Create | PATCH handler |
| `src/app/(protected)/inbox/RequestCard.tsx` | Modify | Add `'use client'`, Pay/Decline buttons, balance gate |
| `tests/unit/lib/requests.test.ts` | Modify | Add unit tests for `payRequest`/`declineRequest` guards |
| `tests/integration/requests.test.ts` | Modify | Add integration tests for `payRequest` |

### Testing Standards

**Unit tests** (`tests/unit/lib/requests.test.ts`) — extend existing mock setup:

The existing mock for `db` covers `db.insert`. For `payRequest`/`declineRequest`, you need to mock `db.transaction` (or `db.select` + `db.update` for `declineRequest`). Mock pattern for `declineRequest` (no transaction needed):

```typescript
vi.mock('@/db/index', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),      // add
    update: vi.fn(),      // add
    transaction: vi.fn(), // add
  },
}))
```

Test cases for `payRequest` guards (no real DB):
- `REQUEST_ALREADY_RESOLVED` when request is PAID/DECLINED/CANCELLED
- `FORBIDDEN` when userId !== recipientId
- `INSUFFICIENT_BALANCE` when payer balance < amountCents

Test cases for `declineRequest` guards:
- `REQUEST_ALREADY_RESOLVED` when request is not PENDING
- `FORBIDDEN` when userId !== recipientId

**Integration tests** (`tests/integration/requests.test.ts`) — add a new `describe('payRequest integration')` block:

Use the same `REQUESTER_USERNAME` / `RECIPIENT_USERNAME` constants and `afterEach` cleanup (already deletes requests before users). Add `transactions` table cleanup in `afterEach` as well — `payRequest` inserts a `transactions` row that must be cleaned up before deleting users (FK constraint on `transactions.sender_id`/`transactions.recipient_id`).

Required imports to add: `transactions` table from `@/db/schema/transactions`, `payRequest`, `declineRequest` from `@/lib/requests`.

Integration test cases for `payRequest`:
1. Debits payer balance, credits requester balance, inserts `transactions` row, sets status PAID with resolvedAt
2. Throws `INSUFFICIENT_BALANCE` when payer has 0 balance — no balance change, no transaction row
3. (Optionally) throws `REQUEST_ALREADY_RESOLVED` when status is already PAID

Integration test case for `declineRequest`:
1. Sets status DECLINED with resolvedAt, no balance changes

### Project Structure Notes

- The `[id]` dynamic segment route goes in `src/app/api/requests/[id]/route.ts` — a sibling directory to the existing `route.ts` at `src/app/api/requests/route.ts` (they don't conflict)
- All `AppError` codes follow SCREAMING_SNAKE_CASE (see `src/lib/errors.ts`): `REQUEST_ALREADY_RESOLVED`, `FORBIDDEN`, `INSUFFICIENT_BALANCE`
- Import `sql` from `drizzle-orm` (already imported in `transactions.ts` — same pattern)
- Lucide icons for Pay button: `Check` or `CreditCard`; for Decline: `X` or `XCircle` — use `data-icon` attribute pattern from CLAUDE.md
- The `Button` component is `@/components/ui/button` — use `variant="default"` for Pay, `variant="outline"` for Decline (consistent with home screen Send/Request pattern)

### Previous Story (4.2) Learnings

- `RequestCard` was originally a Server Component without `'use client'` — converting it is a straightforward addition of the directive
- The `Badge` component uses `variant="secondary"` for PENDING (not `variant="default"`) — keep this when adding Pay/Decline buttons
- `createdAt` serialises as ISO string over the wire (noted in `GET /api/requests` route comment) — the `RequestCard` receives the item from the Server Component parent directly, so it's still a `Date` object, not a string. Be careful if you ever pass inbox items via client-side fetch
- Integration test `afterEach` must delete `payment_requests` before `users` (FK constraint) — when adding `payRequest` tests, also delete from `transactions` before `payment_requests`

### References

- `payRequest` atomic pattern: [Source: src/lib/transactions.ts#L42-L84] — mirror `sendMoney` exactly
- PATCH dynamic route params: [Source: Next.js App Router docs — params is a Promise in v15]
- `useBalanceStore`: [Source: src/store/balance.ts]
- `router.refresh()` for Server Component revalidation: [Source: Next.js docs — refreshes server data without full navigation]
- Balance gate explicit message: [Source: epics.md#Story 4.3 AC, UX-DR7]
- `sql\`NOW()\`` import: [Source: src/lib/transactions.ts#L1 — `sql` imported from `drizzle-orm`]
- Dynamic route: [Source: Next.js App Router conventions — `src/app/api/requests/[id]/route.ts`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

N/A

### Completion Notes List

- `payRequest` mirrors `sendMoney` exactly: `SELECT ... FOR UPDATE` in ascending id order inside a single `db.transaction`, request fetch inside the transaction (atomic with PENDING check), followed by debit/credit/insert-transactions/update-request — all committed together.
- `declineRequest` is simpler (no balance changes) — fetch request, verify guards, single `db.update` with `DECLINED` + `resolvedAt = NOW()`.
- SSE emit intentionally omitted — that's Story 4.5 scope.
- `PATCH /api/requests/[id]` uses `await params` (Next.js v15 async params) with auth-then-service pattern matching existing route handlers.
- `RequestCard` converted to `'use client'` with `useBalanceStore` for the balance gate, `useRouter().refresh()` to revalidate the Server Component inbox after action, and loading states to prevent double-submit.
- Balance gate message is explicit per UX-DR7: "Insufficient balance — you have $X.XX, this request is for $Y.YY" using `formatCents()` exported from `AmountDisplay`.
- All 63 unit tests and 31 integration tests pass. Zero new TypeScript errors. Lint clean.
- Pre-existing TS errors in `accessibility.spec.ts` and `users.test.ts` were present before this story and not related to changes here.

### File List

- `src/lib/requests.ts` (modified — added `payRequest`, `declineRequest`, `sql`+`transactions` imports)
- `src/lib/schemas.ts` (modified — added `patchRequestSchema`, `PatchRequestInput`)
- `src/app/api/requests/[id]/route.ts` (new — PATCH handler)
- `src/app/(protected)/inbox/RequestCard.tsx` (modified — `'use client'`, Pay/Decline buttons, balance gate)
- `tests/unit/lib/requests.test.ts` (modified — added `payRequest`/`declineRequest` guard tests, extended mock)
- `tests/integration/requests.test.ts` (modified — added `payRequest`/`declineRequest` integration tests, `transactions` cleanup in `afterEach`)

### Change Log

- 2026-06-25: Implemented story 4.3 — `payRequest` (atomic Drizzle tx with FOR UPDATE), `declineRequest`, `PATCH /api/requests/[id]`, `RequestCard` with Pay/Decline buttons and balance gate.
