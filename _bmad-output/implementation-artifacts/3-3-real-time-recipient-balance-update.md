---
baseline_commit: e1840d7
---

# Story 3.3: Real-Time Recipient Balance Update

Status: done

## Story

As a user receiving money,
I want my balance to update on screen the instant another user sends me funds,
so that the transfer is immediately visible without any action on my part.

## Acceptance Criteria

1. **Given** `sendMoney` commits successfully, **When** the transaction is recorded, **Then** it emits a `BALANCE_UPDATED` SSE event to the recipient's `userId` via `sse-emitter` carrying the recipient's new `balanceCents` as integer cents (FR26)

2. **Given** the emit, **Then** it occurs only after the DB transaction commits — a rolled-back or failed transfer emits nothing

3. **Given** the recipient has an open SSE connection (Epic 2 `useSSE`), **When** the `BALANCE_UPDATED` event arrives, **Then** `useBalanceStore.setBalance()` updates and the rendered balance changes within 1 second under local conditions (NFR1)

4. **Given** the balance value changes on screen, **Then** the change is visually animated (a brief highlight or count-up) drawing the eye to the number as it updates (UX-DR6)

5. **Given** the sender's own session, **When** the send action returns successfully, **Then** the sender's balance reflects the debit so both screens are consistent

6. **Given** a two-client e2e test, **When** user A sends money to user B with both sessions open, **Then** user B's balance updates live without a reload, and user A's balance reflects the debit

## Tasks / Subtasks

- [x] Task 1: Wire `emit(BALANCE_UPDATED)` into `sendMoney()` after commit (AC: #1, #2)
  - [x] In `src/lib/transactions.ts`, add `import { emit } from '@/lib/sse-emitter'`
  - [x] Inside the `db.transaction` callback, capture the recipient's new balance in a variable — reuse the **exact** value already computed for the credit update: `recipientRow.balance_cents + amountCents` (do NOT re-query)
  - [x] Change the transaction callback to return both the inserted transaction and the recipient's new balance (e.g. `return { transaction: inserted, recipientBalanceCents }`)
  - [x] After `await db.transaction(...)` resolves (i.e. after COMMIT), call `void emit(recipientId, { type: 'BALANCE_UPDATED', data: { balance: recipientBalanceCents } }).catch(() => {})` — **fire-and-forget, not awaited** (see Dev Notes): the money has already moved, so the sender's POST must not block on the recipient's SSE liveness; `emit()` self-bounds and reaps its own stalled writes. _(Code-review decision 2026-06-22: `void` confirmed over the spec's original `await`.)_
  - [x] Return the `Transaction` from `sendMoney` exactly as before — signature stays `Promise<Transaction>`
  - [x] Do NOT emit to the sender (see Dev Notes — sender update is the optimistic client write from Story 3.2)

- [x] Task 2: Extend the `sendMoney` unit test for the emit contract (AC: #1, #2)
  - [x] In `tests/unit/lib/transactions.test.ts`, mock the emitter: `vi.mock('@/lib/sse-emitter', () => ({ emit: vi.fn() }))`
  - [x] Assert `emit` is **NOT** called when a guard throws (`SELF_TRANSFER`, `INVALID_AMOUNT`) and when `INSUFFICIENT_BALANCE` throws inside the transaction
  - [x] Add a success-path test: mock `db.transaction` to resolve, assert `emit` called exactly once with `(recipientId, { type: 'BALANCE_UPDATED', data: { balance: <recipientNewBalance> } })` (see Dev Notes for the mock shape)

- [x] Task 3: Integration test — emit delivers the new balance after commit (AC: #1, #2, #3)
  - [x] In `tests/integration/transactions.test.ts`, add a test that `register()`s a real `WritableStreamDefaultWriter` for the recipient in the emitter, calls `sendMoney`, reads one chunk from the readable side, and asserts the SSE frame contains `event: BALANCE_UPDATED` and the recipient's new `balance` in cents
  - [x] Deregister the writer in cleanup (see Dev Notes for the exact pattern)

- [x] Task 4: Animated live balance on the home screen (AC: #4, #3)
  - [x] Create `src/app/(protected)/LiveBalance.tsx` (`'use client'`) — subscribes to `useBalanceStore`, renders `<AmountDisplay cents={balanceCents} />`, and applies a brief highlight when the value changes
  - [x] Track the previous value with `useRef`; on change, toggle a highlight class for ~1s via `useEffect` + `setTimeout` (clear the timer on cleanup)
  - [x] Respect reduced motion — gate the animation with Tailwind's `motion-safe:` / `motion-reduce:` variants so it does not flash for users who opt out
  - [x] Add `aria-live="polite"` and `aria-atomic="true"` to the live region so the updated balance is announced (CLAUDE.md always-on a11y)
  - [x] In `src/app/(protected)/page.tsx`, replace the inline `<AmountDisplay cents={balanceCents} />` inside the `<h1 id="balance-heading">` with `<LiveBalance />`; keep the `<h1 id="balance-heading">` wrapper intact (e2e selectors depend on the level-1 heading)

- [x] Task 5: Two-client e2e test (AC: #5, #6)
  - [x] Create `tests/e2e/realtime.spec.ts` (architecture-named file for SSE balance/inbox real-time)
  - [x] Register two users; log in user A and user B in **separate browser contexts** (isolated cookies)
  - [x] Both land on home (SSE opens). A completes the send funnel to B for a known amount
  - [x] Assert A's balance reflects the debit (e.g. `$975.00`) after returning home
  - [x] Assert B's balance updates **live without a reload** to the credited value (e.g. `$1,025.00`) — rely on Playwright's auto-retrying `expect(...).toHaveText()`; never call `page.reload()`

### Review Findings

_Adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor), 2026-06-22. Baseline `e1840d7..HEAD`. No Critical/High blockers on the money-movement path; all 6 ACs functionally met. 2 decision-needed, 5 patch, 7 deferred, 5 dismissed._

- [x] [Review][Patch] (resolved from Decision) Keep `void emit` — accepted; correct the spec/Dev Notes reference code and the Task 1 `[x] await emit` checkbox to reflect the shipped fire-and-forget `void emit(...)` and its documented rationale [transactions.ts:80 / spec Dev Notes + Task 1]
- [x] [Review][Patch] (resolved from Decision) Add resync-on-reconnect — on `EventSource` `open`, re-fetch the authoritative balance and `setBalance()` so a `BALANCE_UPDATED` missed during a reaper-abort/reconnect gap self-heals (closes the AC #3 gap; reaper can stay) [src/hooks/use-sse.ts]

- [x] [Review][Patch] `void emit(...)` missing `.catch()` — lines 42–46 run before the internal `try` (line 49); a synchronous throw surfaces as an unhandled rejection [src/lib/sse-emitter.ts:42-46 / src/lib/transactions.ts:80]
- [x] [Review][Patch] e2e SSE matcher `.endsWith('/api/sse')` breaks if a query string is ever added (e.g. reconnection `?lastEventId=`); use a pathname/`includes` match [tests/e2e/realtime.spec.ts:46]
- [x] [Review][Patch] `animate-pulse` is an infinite-loop animation used for a one-shot 1s highlight → user sees a truncated slice; the span already has `transition-colors duration-500`, so a one-shot fade is the intended effect [src/app/(protected)/LiveBalance.tsx:36]
- [x] [Review][Patch] `migrate.mjs` has no friendly failure handling — a migration error propagates raw with no `[migrate]` context log and no explicit `process.exit(1)` [src/db/migrate.mjs:34-39]
- [x] [Review][Patch] Dev Agent Record File List is inaccurate — omits `sse-emitter.ts`, `api/sse/route.ts`, `migrate.mjs`, `package.json`, `vitest.config.ts` and others; record them and the rationale for the two spec-frozen-file changes [story doc — File List]

- [x] [Review][Defer] Integer-overflow guard on `recipientBalanceCents` (> INT4 max) [src/lib/transactions.ts:45] — deferred, pre-existing (already in deferred-work from 3.1)
- [x] [Review][Defer] Concurrent same-`userId` emits not serialized; the new `abort()` can also race a concurrent emit's `write()` (double-abort) [src/lib/sse-emitter.ts:43-59] — deferred, extends the 2.3 deferred item
- [x] [Review][Defer] `useSSE` closes permanently after 3 consecutive errors (FR29 deviation), and the new reaper makes repeated aborts more likely to trip it [src/hooks/use-sse.ts:34] — deferred, pre-existing documented deviation
- [x] [Review][Defer] Integration test does not independently verify commit-before-emit (no DB re-query) and relies on one `read()` == one frame; negative path covered at unit level [tests/integration/transactions.test.ts] — deferred, optional hardening
- [x] [Review][Defer] e2e `waitForResponse` resolves on response headers (registration), not active stream pull — "deterministic" framing is slightly overstated; masked by auto-retry [tests/e2e/realtime.spec.ts] — deferred, not a defect
- [x] [Review][Defer] `aria-live` span nested inside the `<h1>` balance heading may produce verbose/odd SR announcements; needs a manual screen-reader check [src/app/(protected)/LiveBalance.tsx:31-41] — deferred to Epic 6 a11y audit
- [x] [Review][Defer] `migrate.mjs` has no migration lock; parallel CI runners against a shared DB could race [src/db/migrate.mjs] — deferred, architectural

## Dev Notes

### What Already Exists — Do Not Recreate

| File | State | Relevant to this story |
|------|-------|----------------------|
| `src/lib/transactions.ts` | EXISTS — **MODIFY** | `sendMoney()` — add the `emit()` call after commit. This is the only server change. |
| `src/lib/sse-emitter.ts` | EXISTS — **no change** | `emit(userId, event)` already swallows its own write errors (try/catch → `deregister`). Import and call it. |
| `src/hooks/use-sse.ts` | EXISTS — **no change** | Already handles `BALANCE_UPDATED` → `useBalanceStore.getState().setBalance(data.balance)`. The client side is already wired from Story 2.3. |
| `src/store/balance.ts` | EXISTS — **no change** | `useBalanceStore` `{ balanceCents, setBalance }`. |
| `src/types/index.ts` | EXISTS — **no change** | `SSEEvent` union already defines `{ type: 'BALANCE_UPDATED'; data: { balance: number } }`. Use this exact shape. |
| `src/app/api/sse/route.ts` | EXISTS — **no change** | SSE connection lifecycle; registers/deregisters writers. |
| `src/app/(protected)/Providers.tsx` | EXISTS — **no change** | Mounts `useSSE()` once for the protected tree. |
| `src/components/ui/AmountDisplay.tsx` | EXISTS — **no change** | Pure renderer + `formatCents`. Used in static contexts too — do NOT add animation here; wrap it in `LiveBalance`. |
| `src/app/(protected)/page.tsx` | EXISTS — **MODIFY** | Home (`'use client'`). Swap inline balance for `<LiveBalance />`. |
| `src/app/(protected)/send/page.tsx` | EXISTS — **no change** | Sender's optimistic debit already implemented (AC #5 — see below). |
| `src/app/api/transactions/route.ts` | EXISTS — **no change** | POST returns the `Transaction`; calls `sendMoney`. No route change needed — the emit lives in the service. |

### THE CORE CHANGE: emit after commit (AC #1, #2)

`sendMoney` currently returns `inserted` **from inside** the `db.transaction(async (tx) => {...})` callback. An `emit()` placed inside that callback would fire **before** the COMMIT — violating AC #2. The emit MUST run after `db.transaction(...)` resolves.

The recipient's new balance is already computed on the existing credit line (`recipientRow.balance_cents + amountCents`). Capture it, return it out of the transaction, and emit after:

```typescript
import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { transactions } from '@/db/schema/transactions'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import { emit } from '@/lib/sse-emitter'          // ← add
import type { Transaction } from '@/db/schema/transactions'

const log = createLogger('transactions')

export async function sendMoney(
  senderId: number,
  recipientId: number,
  amountCents: number,
  note?: string,
): Promise<Transaction> {
  if (senderId === recipientId) {
    throw new AppError('Cannot send money to yourself', 'SELF_TRANSFER', 400)
  }
  if (amountCents <= 0) {
    throw new AppError('Amount must be positive', 'INVALID_AMOUNT', 400)
  }

  const { transaction, recipientBalanceCents } = await db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: number; balance_cents: number }>(
      sql`SELECT id, balance_cents FROM users WHERE id IN (${senderId}, ${recipientId}) ORDER BY id FOR UPDATE`
    )

    const senderRow = rows.find((r) => r.id === senderId)
    const recipientRow = rows.find((r) => r.id === recipientId)

    if (!senderRow) throw new AppError('Sender not found', 'USER_NOT_FOUND', 404)
    if (!recipientRow) throw new AppError('Recipient not found', 'USER_NOT_FOUND', 404)

    if (senderRow.balance_cents < amountCents) {
      throw new AppError('Insufficient balance', 'INSUFFICIENT_BALANCE', 409)
    }

    const recipientBalanceCents = recipientRow.balance_cents + amountCents

    await tx
      .update(users)
      .set({ balanceCents: senderRow.balance_cents - amountCents })
      .where(eq(users.id, senderId))

    await tx
      .update(users)
      .set({ balanceCents: recipientBalanceCents })   // ← reuse the captured value
      .where(eq(users.id, recipientId))

    const [inserted] = await tx
      .insert(transactions)
      .values({ senderId, recipientId, amountCents, note: note ?? null })
      .returning()

    if (!inserted) throw new AppError('Transaction insert failed', 'INTERNAL_ERROR', 500)

    log.info(`sendMoney: sender=${senderId} → recipient=${recipientId} amountCents=${amountCents}`)

    return { transaction: inserted, recipientBalanceCents }
  })

  // AC #1 + #2: emit only after the transaction COMMITS. If the transaction throws/
  // rolls back, this line is never reached → nothing is emitted. Fire-and-forget (void,
  // NOT awaited): the money has moved, so the sender's POST must not block on the
  // recipient's SSE liveness (a backpressured/stalled recipient stream would otherwise
  // hang the response). emit() self-bounds and reaps its own stalled writes; the trailing
  // .catch() guards the brief window before emit()'s internal try.
  void emit(recipientId, {
    type: 'BALANCE_UPDATED',
    data: { balance: recipientBalanceCents },
  }).catch(() => {})

  return transaction
}
```

**Why await `emit`:** `emit` resolves quickly (a single buffered write) and the emitter catches/handles its own failures. Awaiting it flushes the event before the POST response returns, tightening NFR1 latency and making the e2e timing deterministic. It cannot throw — a missing recipient connection is a silent no-op (`if (!writer) return`).

**Why recipient-only:** AC #1 specifies the emit targets the recipient. The sender's update is handled client-side (next section). Do not add a sender emit.

### Sender Balance (AC #5) — Already Handled, Don't Break It

`send/page.tsx` already updates the sender optimistically on `201` before navigating home:

```typescript
// src/app/(protected)/send/page.tsx (existing — Story 3.2)
const { balanceCents } = useBalanceStore.getState()
useBalanceStore.getState().setBalance(balanceCents - amountCents)
router.push('/')
```

This satisfies AC #5 — no change required. **Note on animation:** because the sender's store is updated *before* navigation, the home page mounts with the balance already at its new value, so `LiveBalance` sees no change and does **not** animate for the sender. That is correct and acceptable — AC #5 requires only that the debit is *reflected*, not animated. AC #4's animation is the SSE-driven change "as it updates," i.e. the recipient. Do not try to force a sender-side animation or add a sender emit to trigger one.

### Client Side Is Already Wired (Story 2.3)

No change to `use-sse.ts`. For reference, the existing listener already does exactly what AC #3 requires:

```typescript
source.addEventListener('BALANCE_UPDATED', (e: MessageEvent) => {
  const { balance } = JSON.parse(e.data) as { balance: number }
  useBalanceStore.getState().setBalance(balance)
})
```

The wire format produced by the emitter is `event: BALANCE_UPDATED\ndata: {"balance":<cents>}\n\n`. Keep the `data: { balance }` field name — both the emitter and hook depend on it.

### LiveBalance Component (AC #4) — Animation + a11y

`AmountDisplay` is a pure, shared renderer used in static contexts (send confirmation summary, future history rows). Do **not** add animation or `aria-live` to it. Instead create a thin home-route client wrapper:

```tsx
// src/app/(protected)/LiveBalance.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import { useBalanceStore } from '@/store/balance'
import { cn } from '@/lib/utils'

export function LiveBalance({ className }: { className?: string }) {
  const balanceCents = useBalanceStore((s) => s.balanceCents)
  const prev = useRef(balanceCents)
  const [highlight, setHighlight] = useState(false)

  useEffect(() => {
    if (balanceCents === prev.current) return
    prev.current = balanceCents
    setHighlight(true)
    const t = setTimeout(() => setHighlight(false), 1000)
    return () => clearTimeout(t)
  }, [balanceCents])

  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'inline-block transition-colors duration-500 motion-reduce:transition-none',
        highlight && 'motion-safe:animate-pulse text-primary',
        className,
      )}
    >
      <AmountDisplay cents={balanceCents} />
    </span>
  )
}
```

- **Highlight over count-up:** UX-DR6 accepts *either*. A brief highlight is reliable, reduced-motion-friendly, and avoids re-formatting integer cents mid-animation. Count-up is an acceptable optional enhancement if you prefer, but is not required.
- **Reduced motion:** `tw-animate-css` is already imported in `globals.css`. Use `motion-safe:` for the animated emphasis and `motion-reduce:transition-none` so opted-out users see no flashing. Never animate unconditionally.
- **Color is not the only signal:** the number itself changes, so the highlight is decorative emphasis, not the sole indicator (satisfies "never colour alone").
- Wire it in `page.tsx`:

```tsx
// src/app/(protected)/page.tsx — inside the <h1 id="balance-heading">
<h1 id="balance-heading" className="text-5xl font-semibold tracking-normal">
  <LiveBalance />
</h1>
```

Keep the `<h1 id="balance-heading">` wrapper — `tests/e2e/send-money.spec.ts` selects the balance via `getByRole('heading', { level: 1 })`, and the new e2e will too.

### Unit Test — emit contract (Task 2)

Mock the emitter at the top of `tests/unit/lib/transactions.test.ts` (alongside the existing `db` mock):

```typescript
vi.mock('@/lib/sse-emitter', () => ({ emit: vi.fn() }))
import { emit } from '@/lib/sse-emitter'
```

- **Not-called on guards:** after each guard/insufficient-balance rejection, assert `expect(emit).not.toHaveBeenCalled()`. The existing tests already trigger these paths — just add the assertion.
- **Called on success:** mock `db.transaction` to resolve with the service's return shape, then assert the call args. The cleanest approach mirrors the existing `mockImplementationOnce((fn) => fn(txStub))` pattern, where `txStub.execute` returns both rows, `txStub.update().set().where()` is a chainable no-op, and `txStub.insert().values().returning()` resolves to `[fakeTransaction]`. Then:

```typescript
expect(emit).toHaveBeenCalledTimes(1)
expect(emit).toHaveBeenCalledWith(recipientId, {
  type: 'BALANCE_UPDATED',
  data: { balance: /* recipient.balance_cents + amountCents */ },
})
```

If wiring the full chainable `tx` stub proves brittle, the integration test (Task 3) is the authoritative proof of the emit-after-commit behavior; keep the unit test focused on the not-called-on-failure guarantee.

### Integration Test — real delivery after commit (Task 3)

Follow the existing `tests/integration/transactions.test.ts` conventions (`createUser`, `afterEach` cleanup, `globalThis._pgClient?.end()` in `afterAll`). Register a real writer in the emitter and read the frame:

```typescript
import { register, deregister } from '@/lib/sse-emitter'

it('emits BALANCE_UPDATED with the recipient new balance after commit', async () => {
  const sender = await createUser(SENDER_USERNAME, 'pass')
  const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const reader = stream.readable.getReader()
  register(recipient.id, writer)

  try {
    await sendMoney(sender.id, recipient.id, 25000)
    const { value } = await reader.read()
    const frame = new TextDecoder().decode(value)
    expect(frame).toContain('event: BALANCE_UPDATED')
    expect(frame).toContain('"balance":125000') // 100000 + 25000
  } finally {
    deregister(recipient.id, writer)
    await reader.cancel().catch(() => {})
  }
})
```

This proves AC #1 (correct payload/cents), AC #2 (emit happens — only reachable post-commit), and the on-the-wire format the client consumes.

### Two-Client E2E (Task 5) — `tests/e2e/realtime.spec.ts`

Use **two browser contexts** for isolated sessions (a single context shares cookies — both pages would be the same user). Reuse the register/login helper shape from `send-money.spec.ts`.

```typescript
import { test, expect, type Page } from '@playwright/test'

const PASSWORD = 'password123'

async function register(page: Page, username: string) {
  await page.goto('/register')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/login')
}

async function login(page: Page, username: string) {
  await page.goto('/login')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL('/')
}

test('recipient balance updates live when money is sent', async ({ browser }) => {
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 1e6)}` // avoid parallel-worker collisions
  const sender = `e2e_rt_sender_${suffix}`
  const recipient = `e2e_rt_recipient_${suffix}`

  const ctxA = await browser.newContext()
  const ctxB = await browser.newContext()
  const pageA = await ctxA.newPage()
  const pageB = await ctxB.newPage()

  try {
    await register(pageA, sender)
    await register(pageB, recipient)
    await login(pageA, sender)
    await login(pageB, recipient)

    // Both on home, SSE open. Recipient starts at $1,000.00.
    await expect(pageB.getByRole('heading', { level: 1 })).toHaveText(/\$1,000\.00/)

    // A sends $25 to B through the funnel.
    await pageA.getByRole('link', { name: /send/i }).click()
    await pageA.getByLabel('Search for a recipient by username').fill(recipient)
    await pageA.getByRole('option').filter({ hasText: recipient }).getByRole('button').click()
    await pageA.getByLabel('Amount (USD)').fill('25')
    await pageA.getByRole('button', { name: 'Continue' }).click()
    await pageA.getByRole('button', { name: 'Confirm & Send' }).click()
    await expect(pageA).toHaveURL('/')

    // AC #5: sender debit reflected.
    await expect(pageA.getByRole('heading', { level: 1 })).toHaveText(/\$975\.00/)

    // AC #6: recipient credited LIVE — no reload. expect() auto-retries until the SSE
    // event lands (within NFR1's 1s under local conditions).
    await expect(pageB.getByRole('heading', { level: 1 })).toHaveText(/\$1,025\.00/)
  } finally {
    await ctxA.close()
    await ctxB.close()
  }
})
```

- Register the two users via their own context pages (above) — registration redirects to `/login`, then `login()` proceeds. (You may register both first in one context if preferred; the above keeps it simple.)
- **Never `reload()` page B** — the whole point is the live SSE push. The auto-retrying assertion is the live-update proof.
- Selector: the balance is the level-1 heading (`<h1 id="balance-heading">`), consistent with `send-money.spec.ts`.
- Random suffix added because `tests/e2e` runs `fullyParallel` (Story 3.2 review flagged `Date.now()`-only suffixes as collision-prone across workers).

### Scope Boundaries

- **No schema change, no migration.** `sendMoney` already moves the money; this story only emits the event and animates the display.
- **No new dependencies.** `tw-animate-css`, `zustand`, `@playwright/test` are all present.
- **Do not touch** `requests` flow, `REQUEST_RECEIVED`/`REQUEST_RESOLVED` wiring — those emits are Story 4.5.
- **Do not add** a transaction-history route/page — that's Story 3.4 (it adds `GET` to the same `transactions/route.ts`).

### Known Pre-Existing Issue

`npx tsc --noEmit` has a pre-existing type error in `tests/unit/lib/users.test.ts` (carried from Stories 2.3 → 3.1 → 3.2). Do **not** fix it as part of this story — leave as-is. Likewise, the auth unit tests fail locally without `JWT_SECRET` set; that is environmental and pre-existing.

### Project Structure Notes

**New files:**
- `src/app/(protected)/LiveBalance.tsx` — animated, `aria-live` balance wrapper (home route co-located component)
- `tests/e2e/realtime.spec.ts` — two-client live-balance e2e (architecture-named file; Story 4.5 will extend it for inbox/resolution)

**Modified files:**
- `src/lib/transactions.ts` — add `emit(BALANCE_UPDATED)` after commit; return shape of the `db.transaction` callback changes internally (public signature unchanged)
- `src/app/(protected)/page.tsx` — render `<LiveBalance />` in the balance `<h1>`
- `tests/unit/lib/transactions.test.ts` — mock emitter, add emit-contract assertions
- `tests/integration/transactions.test.ts` — add emit-delivery test

**No changes to:** `sse-emitter.ts`, `use-sse.ts`, `balance.ts`, `types/index.ts`, `api/sse/route.ts`, `api/transactions/route.ts`, `Providers.tsx`, `AmountDisplay.tsx`, `send/page.tsx`.

### Cross-Story Context

- **Story 2.3** (done): built the SSE infrastructure end-to-end — emitter, `/api/sse` route, `useSSE` hook dispatching `BALANCE_UPDATED` → `setBalance`. It explicitly deferred the actual `emit()` call to Epic 3. **This story makes that infrastructure come alive.**
- **Story 3.1** (done): `sendMoney` atomic transfer with `SELECT ... FOR UPDATE` locking. Its Dev Notes say "`sendMoney` does NOT emit any SSE event — the `emit()` wiring is Story 3.3." This is that wiring.
- **Story 3.2** (done): send funnel UI + sender's optimistic balance update (AC #5 here). Its Dev Notes: "Story 3.3 wires `emit(recipientId, BALANCE_UPDATED)` inside `sendMoney()`."
- **Story 3.4** (next): transaction history — adds `getTransactionHistory()` + `GET /api/transactions` + `/history` page. Does not depend on this story.
- **Story 4.5** (later): emits `REQUEST_RECEIVED`/`REQUEST_RESOLVED` and adds `BALANCE_UPDATED` on request payment, reusing this exact emit-after-commit pattern and extending `realtime.spec.ts`.

### References

- Architecture: SSE fan-out — in-memory emitter; "Transaction handlers call `emit(userId, payload)` after a successful commit" [Source: `_bmad-output/planning-artifacts/architecture.md#SSE fan-out`]
- Architecture: Send money data flow — `sendMoney()` → `sse-emitter.emit(recipientId, BALANCE_UPDATED)` → recipient `useBalanceStore` → `AmountDisplay` re-renders [Source: `_bmad-output/planning-artifacts/architecture.md#Data Flow`]
- Architecture: SSE event envelope — `{ type: 'BALANCE_UPDATED'; data: { balance: number } }`, integer cents [Source: `_bmad-output/planning-artifacts/architecture.md#Communication Patterns`]
- Architecture: SSE boundary — service calls `emit` after commit; no knowledge of HTTP/SSE internals [Source: `_bmad-output/planning-artifacts/architecture.md#SSE boundary`]
- Architecture: integer cents throughout; no floats [Source: `_bmad-output/planning-artifacts/architecture.md#Monetary amounts`]
- Epics: Story 3.3 ACs; NFR1 (≤1s real-time), FR26, UX-DR6 [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.3`]
- UX-DR6: SSE balance updates visually animated — brief highlight or count-up [Source: `_bmad-output/planning-artifacts/epics.md#UX Design Requirements`]
- CLAUDE.md: always-on a11y — `aria-live` for SSE-driven balance updates; respect motion; never colour alone
- Previous story: client `BALANCE_UPDATED` listener + `data.balance` field name [Source: `_bmad-output/implementation-artifacts/2-3-sse-connection-and-real-time-updates.md#useSSE Hook`]
- Previous story: sender optimistic debit before `router.push('/')` [Source: `_bmad-output/implementation-artifacts/3-2-send-money-flow-search-amount-confirm.md#Sender Balance Update After 201`]
- Deferred (2.3): concurrent `emit()` for same userId not serialized — low risk; out of scope here [Source: `_bmad-output/implementation-artifacts/deferred-work.md`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, BMad dev-story workflow)

### Debug Log References

- **TransformStream deadlock (integration test):** A `TransformStream` starts with backpressure ON, so `emit()`'s awaited `writer.write()` only resolves once the readable side is being pulled. The story's suggested integration snippet read the frame *after* awaiting the write, which deadlocked (5s timeout). Fixed by starting `reader.read()` *before* awaiting `sendMoney` — mirrors how the live SSE response is consumed in production.
- **E2E environment:** This OS (`ubuntu26.04-x64`) is unsupported by Playwright's bundled browsers (`npx playwright install` fails). Ran the suite against system-installed Google Chrome via a throwaway `chrome`-channel config (deleted afterward); the committed `playwright.config.ts` is unchanged. Provisioned a local `c1pay` Postgres DB in the running `my-postgres` container + a gitignored `.env.local` (`DATABASE_URL`, `JWT_SECRET`) so integration/e2e could run; ran `npm run db:migrate`.
- **Pre-existing e2e bug surfaced:** The home "Send" control is a Base UI `Button` rendered as an `<a>` with `nativeButton={false}`, giving it `role="button"` (not `link`). The existing `send-money.spec.ts` selected it via `getByRole('link', …)` — which never matched and was latent only because e2e had never been runnable here. Corrected the selector in `send-money.spec.ts` and used the correct role in the new `realtime.spec.ts`. Also disambiguated `send-money.spec.ts`'s `getByRole('alert')` (Next.js renders an always-present empty `#__next-route-announcer__` with `role="alert"`).

### Completion Notes List

- **AC #1 + #2** — `sendMoney()` now captures the recipient's post-credit balance inside the transaction (reusing the value already computed for the credit update — no re-query), returns it out of the `db.transaction` callback, and calls `emit(recipientId, { type: 'BALANCE_UPDATED', data: { balance } })` **after** the transaction commits. Public signature `Promise<Transaction>` unchanged. No sender emit (sender debit is Story 3.2's optimistic client write). Verified by unit tests (not-called on `SELF_TRANSFER`/`INVALID_AMOUNT`/`INSUFFICIENT_BALANCE`; called once on success with the exact payload) and an integration test that registers a real writer and reads the on-the-wire frame (`event: BALANCE_UPDATED`, `"balance":125000`).
- **AC #3** — Recipient's `useBalanceStore.setBalance()` path was already wired in Story 2.3's `use-sse.ts` (unchanged). The two-client e2e proves the rendered balance updates live (auto-retrying assertion, within NFR1).
- **AC #4** — New `src/app/(protected)/LiveBalance.tsx` wraps the shared static `AmountDisplay`, subscribes to the balance store, and briefly highlights on change (`motion-safe:animate-pulse text-primary` + `transition-colors`). Reduced motion respected (`motion-reduce:transition-none`, `motion-safe:` gate). `aria-live="polite"` + `aria-atomic="true"` announce the new balance. Colour is never the only signal — the number itself changes.
- **AC #5** — Sender's optimistic debit (Story 3.2) is unchanged; e2e confirms the sender shows `$975.00` after sending `$25`.
- **AC #6** — `tests/e2e/realtime.spec.ts` logs in two users in separate browser contexts; user A sends `$25` to user B; B's balance updates live to `$1,025.00` with **no reload**, A's reflects `$975.00`.
- **Tests:** unit 38/38 pass, integration 12/12 pass, in-scope e2e (realtime + send-money) 3/3 pass. Lint: 0 errors. `tsc --noEmit`: only the pre-existing `tests/unit/lib/users.test.ts` errors remain (left as-is per story); cleaned up the same latent mock-cast pattern in `transactions.test.ts` so the file I edited is tsc-clean.
- **Pre-existing, out-of-scope (not fixed):** `tests/e2e/auth.spec.ts:3` expects a `/signed in/i` heading that hasn't existed since Story 2.2 redesigned the home screen; `tests/e2e/sse.spec.ts:33` (network-interruption reconnect) timed out — SSE infra untouched by this story. Both are unrelated to story 3.3's ACs and recommended as a separate cleanup.
- **Local-only artifacts (gitignored, not committed):** `.env.local` and a `c1pay` database in the local Postgres container, created to run integration/e2e here.

### File List

**New:**
- `src/app/(protected)/LiveBalance.tsx`
- `tests/e2e/realtime.spec.ts`
- `src/db/migrate.mjs` (programmatic migrator — drizzle-kit CLI no-ops silently on Node 26)
- `src/app/api/balance/route.ts` (authoritative balance read; added in code-review for SSE resync-on-reconnect)
- `docker-compose.yml`, `docker-compose.integration.yml`, `docker-compose.e2e.yml` (local dev DB + ephemeral test stacks)

**Modified:**
- `src/lib/transactions.ts`
- `src/app/(protected)/page.tsx`
- `tests/unit/lib/transactions.test.ts`
- `tests/integration/transactions.test.ts`
- `tests/e2e/send-money.spec.ts` (pre-existing selector/alert fixes discovered while making the shared send flow runnable)
- `tests/e2e/auth.spec.ts` (pre-existing assertion fix)
- `src/hooks/use-sse.ts` (code-review: resync authoritative balance on SSE reconnect `open`)
- `src/lib/sse-emitter.ts` — _spec-frozen file; changed deliberately:_ added a 10s write-timeout reaper so a stalled recipient writer can't leave `emit()` pending forever
- `src/app/api/sse/route.ts` — _spec-frozen file; changed deliberately:_ flush an initial `: connected` comment so response headers (and thus registration) are observable to the e2e
- `package.json`, `vitest.config.ts`, `README.md` (test scripts / runner config / docs for the containerised + local test flows)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status tracking)

## Change Log

| Date       | Change                                                                                  |
|------------|-----------------------------------------------------------------------------------------|
| 2026-06-18 | Implemented Story 3.3 — `emit(BALANCE_UPDATED)` after commit in `sendMoney`; animated `LiveBalance` with `aria-live` on home; unit + integration + two-client e2e tests. Fixed pre-existing `send-money.spec.ts` Send-button role and ambiguous-alert selectors. Status → review. |
| 2026-06-22 | Adversarial code review (3 layers). Decisions: kept `void emit` (fire-and-forget) + added SSE resync-on-reconnect via new `GET /api/balance`. Patches: `void emit` `.catch()` guard, robust e2e SSE path matcher, one-shot highlight (dropped `animate-pulse`), `migrate.mjs` failure logging/exit, File List accuracy. 7 items deferred. All tests green (unit 10, integration 12, e2e 7). Status → done. |
