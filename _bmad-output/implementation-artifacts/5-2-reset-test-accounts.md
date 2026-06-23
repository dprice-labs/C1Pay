---
baseline_commit: c0c01ba
---

# Story 5.2: Reset Test Accounts

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a session facilitator,
I want to reset all test accounts to their starting state with a single command,
So that I can re-run a training session from a clean slate.

## Acceptance Criteria

1. **Given** `scripts/seed.ts`, **When** invoked with a reset command (`npm run seed -- reset`), **Then** it clears all `transactions` and `payment_requests` rows for the test accounts and restores each account's `balance_cents` to the configured starting balance (FR35)

2. **Given** the reset command, **When** executed, **Then** the clearing and balance restoration run within a single DB transaction so the reset is all-or-nothing — no account is left partially reset

3. **Given** the reset command is run multiple times in succession, **When** executed, **Then** it is idempotent — each run leaves the accounts in the identical starting state regardless of prior history (FR36)

4. **Given** the reset command, **When** it completes, **Then** it logs a clear summary (accounts reset, history rows cleared) via `src/lib/logger.ts`

5. **Given** an integration test for the reset command, **When** run after seeding accounts and creating transactions and requests, **Then** it verifies all history is cleared, balances are restored to the starting value, and a second reset produces the identical state

## Tasks / Subtasks

- [x] Task 1: Implement `resetTestAccounts()` in `scripts/seed.ts` (AC: #1, #2, #3, #4)
  - [x] Add new imports to `scripts/seed.ts`: `db` from `@/db/index`; `users` from `@/db/schema/users`; `transactions` from `@/db/schema/transactions`; `paymentRequests` from `@/db/schema/requests`; `or`, `inArray`, `like` from `drizzle-orm`
  - [x] Implement `resetTestAccounts()`: call `assertValidConfig()`; SELECT ids of all `testuser%` users; if none exist log a 0-count summary and return; otherwise run `db.transaction()` that deletes transactions, deletes payment_requests, and updates balances (all in one atomic operation); wrap the body in `try/finally` so the summary always logs even on error
  - [x] Update `main()` dispatch: replace the single `if (command !== 'create')` branch with an if/else-if dispatching `'create'` → `createTestAccounts()` and `'reset'` → `resetTestAccounts()`; update the error message to list both commands

- [x] Task 2: Extend integration test `tests/integration/seed.test.ts` (AC: #5)
  - [x] Import `resetTestAccounts` from `../../scripts/seed` and add schema/operator imports needed for test data setup and FK-safe cleanup
  - [x] Add inner `afterEach` inside the new describe block that deletes transactions and payment_requests referencing testuser IDs before the outer `afterEach` deletes the users (prevents FK constraint violation if a test fails mid-way)
  - [x] Write test: create accounts, insert a transaction + a payment_request between two test users, call reset, assert 0 transactions, 0 requests, and all balances === `SEED_BALANCE_CENTS`
  - [x] Write test: run reset twice, assert identical clean state after each run (idempotency)

## Dev Notes

### What Already Exists — Do Not Recreate

| File | State | Relevant to this story |
|------|-------|------------------------|
| `scripts/seed.ts` | EXISTS — **MUST MODIFY** | Add `resetTestAccounts()` and update `main()` dispatch. `assertValidConfig()`, `parseEnvInt()`, `SEED_*` constants, `createTestAccounts()`, `isMainModule()`, and the `closeDb()` finally call are all complete — do not touch them. Read the full file before writing any changes. |
| `src/db/index.ts` | EXISTS — no change | Exports both `db` (Drizzle client) and `closeDb()`. `seed.ts` already imports `closeDb`; this story adds `db` to that same import. |
| `src/db/schema/users.ts` | EXISTS — no change | Exports `users` table (`id`, `username`, `passwordHash`, `balanceCents`, `createdAt`). |
| `src/db/schema/transactions.ts` | EXISTS — no change | Exports `transactions` table (columns: `senderId`, `recipientId`, `amountCents`, `note`, `createdAt`). |
| `src/db/schema/requests.ts` | EXISTS — no change | Exports `paymentRequests` table (columns: `requesterId`, `recipientId`, `amountCents`, `note`, `status`, `createdAt`, `resolvedAt`). This table is NOT registered in `src/db/index.ts`'s schema object — that only affects the `.query.*` API; `db.delete(paymentRequests)` works fine without registration. |
| `tests/integration/seed.test.ts` | EXISTS — **MUST MODIFY** | Extend with a new `describe('resetTestAccounts', ...)` block. Do not remove or modify the existing `createTestAccounts` tests. |

### `resetTestAccounts()` — Reference Implementation

```typescript
export async function resetTestAccounts(): Promise<void> {
  assertValidConfig()

  const testUserRows = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.username, `${SEED_USERNAME_PREFIX}%`))

  const testUserIds = testUserRows.map((r) => r.id)

  let accountsReset = 0
  let transactionsCleared = 0
  let requestsCleared = 0

  try {
    if (testUserIds.length > 0) {
      await db.transaction(async (tx) => {
        const txDeleted = await tx
          .delete(transactions)
          .where(or(inArray(transactions.senderId, testUserIds), inArray(transactions.recipientId, testUserIds)))
          .returning({ id: transactions.id })
        transactionsCleared = txDeleted.length

        const reqDeleted = await tx
          .delete(paymentRequests)
          .where(
            or(
              inArray(paymentRequests.requesterId, testUserIds),
              inArray(paymentRequests.recipientId, testUserIds),
            ),
          )
          .returning({ id: paymentRequests.id })
        requestsCleared = reqDeleted.length

        const updated = await tx
          .update(users)
          .set({ balanceCents: SEED_BALANCE_CENTS })
          .where(inArray(users.id, testUserIds))
          .returning({ id: users.id })
        accountsReset = updated.length
      })
    }
  } finally {
    log.info(
      `reset: ${accountsReset} account(s) reset to ${SEED_BALANCE_CENTS} cents, ${transactionsCleared} transaction(s) cleared, ${requestsCleared} request(s) cleared`,
    )
  }
}
```

**Why `like(users.username, `${SEED_USERNAME_PREFIX}%`)` instead of `inArray` with exact names:** The LIKE pattern matches ALL `testuser*` accounts regardless of the current `SEED_ACCOUNT_COUNT`. A facilitator may have previously run `create` with a different count; using exact names from the current config would miss accounts outside that range. LIKE is the correct scope for "all test accounts."

**Why short-circuit on empty `testUserIds`:** `inArray(col, [])` generates `col IN ()` which is invalid SQL in PostgreSQL. Guard explicitly before entering the transaction.

**Why `try/finally` around the transaction block:** Same pattern as `createTestAccounts()` — ensures the summary log always fires even if the DB transaction throws partway through, giving the operator a count of what completed before the error.

### `main()` Dispatch — Exact Change

Current state in `scripts/seed.ts` (must change):
```typescript
async function main(): Promise<void> {
  const command = process.argv[2]
  if (command !== 'create') {
    log.error(`Unknown or missing command "${command}". Usage: npm run seed -- create`)
    process.exitCode = 1
    return
  }
  await createTestAccounts()
}
```

Change to:
```typescript
async function main(): Promise<void> {
  const command = process.argv[2]
  if (command === 'create') {
    await createTestAccounts()
  } else if (command === 'reset') {
    await resetTestAccounts()
  } else {
    log.error(`Unknown or missing command "${command}". Usage: npm run seed -- <create|reset>`)
    process.exitCode = 1
  }
}
```

### New Imports for `scripts/seed.ts`

Add these to the top of the file alongside the existing imports:

```typescript
import { or, inArray, like } from 'drizzle-orm'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { transactions } from '@/db/schema/transactions'
import { paymentRequests } from '@/db/schema/requests'
```

`closeDb` is already imported from `@/db/index` — merge `db` into that same import statement: `import { db, closeDb } from '@/db/index'`.

### Integration Test — Exact Addition

The file `tests/integration/seed.test.ts` currently imports `createTestAccounts`, `SEED_ACCOUNT_COUNT`, `SEED_BALANCE_CENTS`, `SEED_USERNAME_PREFIX` from `../../scripts/seed`. Extend the imports and add the new describe block after the existing one:

```typescript
// Add to imports at top of file:
import { eq } from 'drizzle-orm'  // if not already present
import { or, inArray } from 'drizzle-orm'
import { resetTestAccounts } from '../../scripts/seed'
import { transactions } from '@/db/schema/transactions'
import { paymentRequests } from '@/db/schema/requests'

// Append after the existing describe('createTestAccounts', ...) block:
describe('resetTestAccounts', () => {
  // FK-safe inner cleanup: delete child rows before the outer afterEach deletes users.
  // Without this, if a test fails before calling reset, the outer afterEach's
  // db.delete(users) will violate the FK constraint on transactions/payment_requests
  // and silently fail, leaving dirty state for the next test.
  afterEach(async () => {
    try {
      const testUserRows = await db
        .select({ id: users.id })
        .from(users)
        .where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
      const ids = testUserRows.map((r) => r.id)
      if (ids.length > 0) {
        await db
          .delete(transactions)
          .where(or(inArray(transactions.senderId, ids), inArray(transactions.recipientId, ids)))
        await db
          .delete(paymentRequests)
          .where(
            or(inArray(paymentRequests.requesterId, ids), inArray(paymentRequests.recipientId, ids)),
          )
      }
    } catch {
      // best-effort
    }
  })

  it('clears transactions and payment_requests and restores balances', async () => {
    await createTestAccounts()

    const testUserRows = await db
      .select({ id: users.id })
      .from(users)
      .where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
    const ids = testUserRows.map((r) => r.id)
    const [user1, user2] = ids

    // Simulate training-session activity: a send (transaction) and a request
    await db.insert(transactions).values({ senderId: user1!, recipientId: user2!, amountCents: 1000 })
    await db.insert(paymentRequests).values({ requesterId: user2!, recipientId: user1!, amountCents: 500 })

    await resetTestAccounts()

    const remainingTx = await db
      .select()
      .from(transactions)
      .where(or(inArray(transactions.senderId, ids), inArray(transactions.recipientId, ids)))
    expect(remainingTx).toHaveLength(0)

    const remainingReq = await db
      .select()
      .from(paymentRequests)
      .where(or(inArray(paymentRequests.requesterId, ids), inArray(paymentRequests.recipientId, ids)))
    expect(remainingReq).toHaveLength(0)

    const resetUsers = await db
      .select()
      .from(users)
      .where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
    expect(resetUsers.every((u) => u.balanceCents === SEED_BALANCE_CENTS)).toBe(true)
  })

  it('is idempotent — a second reset produces the identical state', async () => {
    await createTestAccounts()
    await resetTestAccounts()
    await resetTestAccounts()

    const resetUsers = await db
      .select()
      .from(users)
      .where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
    expect(resetUsers.every((u) => u.balanceCents === SEED_BALANCE_CENTS)).toBe(true)
  })
})
```

The reset tests don't involve bcrypt hashing, so the 5s default Vitest timeout is sufficient. If the `createTestAccounts()` call within the first test times out (seeding 10 accounts), add a `{ timeout: 20000 }` option matching the pattern in the existing tests.

### Testing Requirements

- **Unit tests:** Not required. `resetTestAccounts()` orchestrates DB calls with no pure logic to unit-test in isolation. The integration test proves the behavior end-to-end.
- **Integration test:** Extend `tests/integration/seed.test.ts` as shown above. The inner `afterEach` for FK-safe cleanup is important — don't skip it.

### Architecture Compliance

- **NFR9 (no duplication):** `resetTestAccounts()` performs admin-only Drizzle operations (delete + update in a transaction). There is no equivalent in `src/lib/` because the app has no user-facing "wipe all your history" feature. Using `db.transaction()` directly in the script is correct here — it's not duplicating any existing service function.
- **Logger:** `log` is already `createLogger('seed')` at the top of `scripts/seed.ts`. Reuse it directly.
- **`closeDb()` is not your problem:** The `finally { await closeDb() }` in the `isMainModule()` block already tears down the connection for any command the script runs. No additional teardown needed.
- **`paymentRequests` not in db schema object:** `src/db/index.ts` only imports `usersSchema` and `transactionsSchema`. Do NOT change `db/index.ts` — just import `paymentRequests` directly from `@/db/schema/requests` and use it with `db.delete(paymentRequests)`. Works fine.
- **No migrations, no UI, no routes, no Zustand:** This story is entirely CLI + test layer.

### Project Structure Changes

Modified files only — no new files:
- `scripts/seed.ts` — adds `resetTestAccounts()` export and updates `main()` dispatch
- `tests/integration/seed.test.ts` — adds `describe('resetTestAccounts', ...)` block

### Cross-Story Context

- **Story 5.1's dev notes** explicitly anticipated this dispatch refactor: "Keep the `main()` dispatch in this story to a plain `if (command !== 'create')` check — it will become a switch/two-branch dispatch in 5.2; don't over-build a command-routing abstraction now." → `if/else if` with two branches is sufficient; no `switch` needed.
- **Epic 4 (Request flow)** is partially still in backlog, but `payment_requests` table and `createRequest()` service are fully implemented (story 4.1 is done). The integration test inserts a `payment_request` row directly via `db.insert()` — no need for the request UI or service function.
- **After this story:** A facilitator runs `npm run seed -- create` once to prepare a training session, then `npm run seed -- reset` to wipe history and restore balances between sessions.

### References

- Epics: Story 5.2 ACs and Epic 5 goal [Source: `_bmad-output/planning-artifacts/epics.md#Story 5.2: Reset Test Accounts`]
- Previous story: Story 5.1 completion notes and dev notes — especially the cross-story hint about `main()` dispatch [Source: `_bmad-output/implementation-artifacts/5-1-batch-create-test-accounts.md`]
- Current `scripts/seed.ts` (authoritative) — the actual file, not the story 5.1 reference implementation (the file was updated twice post-review)
- DB schemas: `src/db/schema/transactions.ts`, `src/db/schema/requests.ts`, `src/db/schema/users.ts`
- Architecture: service layer design [Source: `_bmad-output/planning-artifacts/architecture.md`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Local test DB was missing the `transactions` and `payment_requests` migrations (same environment drift as Story 5.1). Applied `node --env-file-if-exists=.env.local src/db/migrate.mjs` before running the new integration tests. Pre-existing: all `transactions.test.ts` and `requests.test.ts` failures in the full integration suite trace back to this — they are not regressions from this story.
- `paymentRequests` table not registered in `src/db/index.ts` schema object — confirmed `db.delete(paymentRequests)` works correctly with the table object imported directly from `@/db/schema/requests` (no schema registration needed for DML queries).

### Completion Notes List

- Added 5 new imports to `scripts/seed.ts`: `or`, `inArray`, `like` from `drizzle-orm`; `db` from `@/db/index` (merged with existing `closeDb`); `users`, `transactions`, `paymentRequests` from their schema paths.
- Implemented `resetTestAccounts()`: SELECTs all `testuser%` user IDs with a LIKE query (catches all seeded accounts regardless of current `SEED_ACCOUNT_COUNT`); short-circuits with a 0-count log if none exist (avoids empty `inArray` generating invalid SQL); runs a single `db.transaction()` that deletes transactions, deletes payment_requests, and updates balances atomically; wraps in `try/finally` so the summary always logs.
- Updated `main()` dispatch from a single `if (command !== 'create')` guard to an `if/else if` dispatching both `'create'` and `'reset'`; updated error message to list both commands.
- Extended `tests/integration/seed.test.ts` with `describe('resetTestAccounts', ...)` containing an inner FK-safe `afterEach`, a functional test (creates accounts + inserts a transaction + a request, calls reset, asserts all cleared and balances restored), and an idempotency test (two consecutive resets produce identical clean state).
- CLI smoke-tested end-to-end: `npm run seed -- create` (10 accounts), `npm run seed -- reset` (10 reset, 0 history — as expected since the live DB had no transactions), and `npm run seed -- badcmd` (exits 1 with correct usage message).
- Regression: 52 unit tests pass (unchanged); 4 seed integration tests pass (2 existing + 2 new).

### File List

- `scripts/seed.ts` (modified)
- `tests/integration/seed.test.ts` (modified)

## Change Log

- 2026-06-23: Implemented Story 5.2 — added `resetTestAccounts()` to `scripts/seed.ts` with atomic DB transaction clearing transactions and payment_requests and restoring balances; updated `main()` dispatch to handle both `create` and `reset` commands; extended integration tests with FK-safe cleanup and 2 new passing tests.
