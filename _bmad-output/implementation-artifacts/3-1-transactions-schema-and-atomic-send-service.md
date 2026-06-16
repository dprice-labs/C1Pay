---
baseline_commit: a23e3a4
---

# Story 3.1: Transactions Schema & Atomic Send Service

Status: done

## Story

As a developer,
I want a transactions table and an atomic `sendMoney` service with balance-gate validation,
so that money can move between users with guaranteed integrity before any UI is built on top.

## Acceptance Criteria

1. **Given** `src/db/schema/transactions.ts` exists, **Then** it defines a `transactions` table with: `id` (serial PK), `sender_id` (integer FK → `users.id`, not null), `recipient_id` (integer FK → `users.id`, not null), `amount_cents` (integer, not null), `note` (text, nullable), `created_at` (timestamp with timezone, default now()); plus indexes `idx_transactions_sender_id` and `idx_transactions_recipient_id`

2. **Given** the schema is added, **When** `drizzle-kit generate` then `drizzle-kit migrate` is run, **Then** a versioned migration file is produced and the `transactions` table is created in PostgreSQL

3. **Given** `src/lib/transactions.ts` exists, **Then** it exports `async function sendMoney(senderId: number, recipientId: number, amountCents: number, note?: string): Promise<Transaction>`

4. **Given** `sendMoney` runs with valid inputs, **When** executed, **Then** it opens a single Drizzle transaction that locks both the sender and recipient rows with `SELECT ... FOR UPDATE` (raw SQL), debits the sender's `balance_cents`, credits the recipient's `balance_cents`, and inserts one `transactions` row — all committed atomically (FR9, FR13)

5. **Given** a completed send, **Then** funds transfer immediately with no pending state and the single transaction row records the transfer for both parties — `sender_id`/`recipient_id` encode direction; per-viewer sent/received is derived at read time, not duplicated (FR12, FR14, NFR9)

6. **Given** `sendMoney` where `amountCents` exceeds the sender's available balance, **When** executed, **Then** it throws an `AppError` with code `INSUFFICIENT_BALANCE` and no balance change or transaction row is persisted (FR8)

7. **Given** `sendMoney` where `amountCents <= 0`, **Then** it throws an `AppError` with code `INVALID_AMOUNT`

8. **Given** `sendMoney` where `senderId === recipientId`, **Then** it throws an `AppError` with code `SELF_TRANSFER`

9. **Given** a unit test for `sendMoney` validation, **When** run, **Then** it verifies `INSUFFICIENT_BALANCE`, `INVALID_AMOUNT`, and `SELF_TRANSFER` are thrown without a real database

10. **Given** an integration test for concurrent sends, **When** two sends from the same sender execute against a real database, **Then** row-level locking serialises them and the sender's balance never goes negative (FR9)

_Note: `sendMoney` does NOT emit any SSE event in this story — the `emit()` wiring is Story 3.3._

## Tasks / Subtasks

- [x] Task 1: Create `src/db/schema/transactions.ts` (AC: #1)
  - [x] Define `transactions` table with all specified columns and FK references
  - [x] Add indexes `idx_transactions_sender_id` and `idx_transactions_recipient_id`
  - [x] Export `Transaction` and `NewTransaction` Drizzle-inferred types

- [x] Task 2: Update `src/db/index.ts` to include transactions schema (AC: #2, #4)
  - [x] Import transactions schema and merge with existing users schema object

- [x] Task 3: Generate and apply migration (AC: #2)
  - [x] Run `npx drizzle-kit generate` → verify new SQL migration file is created
  - [x] Run `npx drizzle-kit migrate` → verify `transactions` table exists in DB

- [x] Task 4: Create `src/lib/transactions.ts` with `sendMoney` (AC: #3, #4, #5, #6, #7, #8)
  - [x] Implement validation guards: `SELF_TRANSFER`, `INVALID_AMOUNT`
  - [x] Implement Drizzle transaction with `SELECT ... FOR UPDATE` raw SQL locking both rows (ORDER BY id to prevent deadlocks)
  - [x] Read locked sender balance, check against `amountCents` → throw `INSUFFICIENT_BALANCE` if exceeded
  - [x] Debit sender, credit recipient via `db.update`, insert `transactions` row
  - [x] Return the inserted `Transaction` row
  - [x] Use `createLogger('transactions')` — no raw `console.log`

- [x] Task 5: Update `src/types/index.ts` — replace stub `Transaction` interface (AC: #3)
  - [x] Replace the stub `Transaction` interface with a re-export of the Drizzle-inferred type from `@/db/schema/transactions`

- [x] Task 6: Write unit tests `tests/unit/lib/transactions.test.ts` (AC: #9)
  - [x] Mock the db module; test `SELF_TRANSFER`, `INVALID_AMOUNT`, and `INSUFFICIENT_BALANCE` guards without a DB
  - [x] Verify that no DB calls happen before the validation throws

- [x] Task 7: Write integration test `tests/integration/transactions.test.ts` (AC: #10)
  - [x] Happy path: two-user send reduces sender balance, increases recipient balance, inserts one transactions row
  - [x] Concurrent sends: two `sendMoney` calls racing from same sender — verify balance never goes negative (row-level locking test)
  - [x] `INSUFFICIENT_BALANCE` guard on real DB
  - [x] Cleanup test rows after each test

## Dev Notes

### What Already Exists — Do Not Recreate

| File | State | Relevant to this story |
|------|-------|----------------------|
| `src/db/schema/users.ts` | EXISTS — no change | `users` table definition; exports `User`, `NewUser` types. FK references come from here. |
| `src/db/index.ts` | EXISTS — **MUST MODIFY** | Currently only imports `users` schema. Must add `transactions` schema so Drizzle's typed client includes it. |
| `src/lib/errors.ts` | EXISTS | `AppError(message, code, status)` + `errorResponse()` — reuse exactly as in `users.ts` |
| `src/lib/logger.ts` | EXISTS | `createLogger('transactions')` — no raw `console.log` |
| `src/types/index.ts` | EXISTS — **MUST MODIFY** | Has stub `Transaction` interface. Replace it with the Drizzle-inferred type. |
| `src/lib/sse-emitter.ts` | EXISTS — no touch | SSE emit infrastructure — do NOT call `emit()` from `sendMoney` in this story |

### Critical: `src/db/index.ts` Schema Update

Currently `src/db/index.ts` imports only the users schema:
```typescript
import * as schema from './schema/users'
```
This must be updated to include transactions so Drizzle's relational client is aware of both tables:
```typescript
import * as usersSchema from './schema/users'
import * as transactionsSchema from './schema/transactions'

export const db = drizzle(client, { schema: { ...usersSchema, ...transactionsSchema } })
```
Without this, `db.update(transactions)` and `db.insert(transactions)` will still work (they use direct table references), but relational query helper types won't include transactions.

### `src/db/schema/transactions.ts` — Exact Shape

```typescript
import { integer, pgTable, serial, text, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users'

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').notNull().references(() => users.id),
  recipientId: integer('recipient_id').notNull().references(() => users.id),
  amountCents: integer('amount_cents').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_transactions_sender_id').on(table.senderId),
  index('idx_transactions_recipient_id').on(table.recipientId),
])

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
```

Use `index` (not `uniqueIndex`) — these are performance indexes, not uniqueness constraints.

### `src/types/index.ts` — Replace Stub `Transaction`

The stub `Transaction` interface (added in Story 2.3 as a placeholder) must be replaced with the real Drizzle-inferred type:
```typescript
// Replace this stub:
// export interface Transaction { ... }

// With:
export type { Transaction } from '@/db/schema/transactions'
```
The `SSEEvent` type in the same file references `BALANCE_UPDATED` with `balance: number` — no Transaction type is needed in SSEEvent, so this replacement is safe.

### `src/lib/transactions.ts` — Critical Implementation Details

#### Row-Level Locking Pattern (Architecture Requirement)

Drizzle's query builder does NOT expose `SELECT ... FOR UPDATE`. Raw SQL is mandatory at this boundary — this is a named architectural constraint (see architecture.md#Row-level locking).

```typescript
import { sql } from 'drizzle-orm'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { transactions } from '@/db/schema/transactions'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import type { Transaction } from '@/db/schema/transactions'

const log = createLogger('transactions')

export async function sendMoney(
  senderId: number,
  recipientId: number,
  amountCents: number,
  note?: string,
): Promise<Transaction> {
  if (senderId === recipientId) throw new AppError('Cannot send money to yourself', 'SELF_TRANSFER', 400)
  if (amountCents <= 0) throw new AppError('Amount must be positive', 'INVALID_AMOUNT', 400)

  return db.transaction(async (tx) => {
    // Lock both rows in id order to prevent deadlock when two concurrent sends involve the same pair
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

    await tx.update(users).set({ balanceCents: senderRow.balance_cents - amountCents }).where(eq(users.id, senderId))
    await tx.update(users).set({ balanceCents: recipientRow.balance_cents + amountCents }).where(eq(users.id, recipientId))

    const [inserted] = await tx.insert(transactions).values({
      senderId,
      recipientId,
      amountCents,
      note: note ?? null,
    }).returning()

    log.info(`sendMoney: sender=${senderId} → recipient=${recipientId} amount=${amountCents}`)
    return inserted!
  })
}
```

**Why ORDER BY id in the FOR UPDATE:** Locking rows A then B in one transaction, and B then A in another, causes a deadlock. Always locking in ascending `id` order eliminates this. The `ORDER BY id` clause in the raw SQL enforces this deterministic order regardless of which user is sender vs. recipient.

**Why `INSUFFICIENT_BALANCE` is checked inside the transaction:** The balance read inside the locked transaction is the authoritative value under concurrent load. A balance check before `db.transaction()` would be a TOCTOU (time-of-check/time-of-use) race — another concurrent send could drain the balance between the pre-check and the update.

**Why no SSE emit here:** Story 3.3 wires `emit()` into `sendMoney`. Do not add it in this story.

### `eq` Import

`eq` comes from `drizzle-orm`, not from `@/db`. Add to imports:
```typescript
import { eq, sql } from 'drizzle-orm'
```

### Unit Test Strategy — Mocking the DB

For unit tests, mock `@/db/index` so no database is needed:

```typescript
// tests/unit/lib/transactions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from '@/lib/errors'

// Mock BEFORE importing the module under test
vi.mock('@/db/index', () => ({
  db: {
    transaction: vi.fn(),
  },
}))

import { sendMoney } from '@/lib/transactions'

describe('sendMoney validation', () => {
  it('throws SELF_TRANSFER when senderId === recipientId', async () => {
    await expect(sendMoney(1, 1, 1000)).rejects.toMatchObject({ code: 'SELF_TRANSFER' })
  })

  it('throws INVALID_AMOUNT when amountCents <= 0', async () => {
    await expect(sendMoney(1, 2, 0)).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })
    await expect(sendMoney(1, 2, -100)).rejects.toMatchObject({ code: 'INVALID_AMOUNT' })
  })

  it('does not call db.transaction for validation failures', async () => {
    const { db } = await import('@/db/index')
    await sendMoney(1, 1, 1000).catch(() => {})
    expect(db.transaction).not.toHaveBeenCalled()
  })
})
```

The `INSUFFICIENT_BALANCE` guard lives inside the DB transaction, so its unit test requires mocking the transaction internals or is better tested at integration level.

### Integration Test Strategy

Follow the pattern from `tests/integration/auth.test.ts`:
- Use real DB
- Clean up after each test with `afterEach`
- Call `globalThis._pgClient?.end()` in `afterAll`

```typescript
// tests/integration/transactions.test.ts
import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { transactions } from '@/db/schema/transactions'
import { eq, or } from 'drizzle-orm'
import { createUser } from '@/lib/users'
import { sendMoney } from '@/lib/transactions'

const SENDER_USERNAME = '__tx_test_sender__'
const RECIPIENT_USERNAME = '__tx_test_recipient__'

afterAll(async () => {
  await globalThis._pgClient?.end()
  globalThis._pgClient = undefined
})

afterEach(async () => {
  // Clean up transactions and users
  const testUsers = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.username, SENDER_USERNAME), eq(users.username, RECIPIENT_USERNAME)))
  for (const u of testUsers) {
    await db.delete(transactions).where(or(eq(transactions.senderId, u.id), eq(transactions.recipientId, u.id)))
  }
  await db.delete(users).where(or(eq(users.username, SENDER_USERNAME), eq(users.username, RECIPIENT_USERNAME)))
})
```

**Concurrent sends test pattern:**
```typescript
it('serialises concurrent sends — balance never goes negative', async () => {
  const sender = await createUser(SENDER_USERNAME, 'pass')
  const recipient = await createUser(RECIPIENT_USERNAME, 'pass')
  // Sender starts with 100000 cents ($1000); send two $600 requests concurrently
  const results = await Promise.allSettled([
    sendMoney(sender.id, recipient.id, 60000),
    sendMoney(sender.id, recipient.id, 60000),
  ])
  const succeeded = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length
  expect(succeeded).toBe(1)
  expect(failed).toBe(1)

  const [senderRow] = await db.select().from(users).where(eq(users.id, sender.id))
  expect(senderRow!.balanceCents).toBeGreaterThanOrEqual(0)
  expect(senderRow!.balanceCents).toBe(40000) // 100000 - 60000
})
```

### Known Pre-Existing Issue

`npx tsc --noEmit` fails with a pre-existing type error in `tests/unit/lib/users.test.ts`. Do not fix it as part of this story — leave as-is (established in Story 2.3 Dev Notes).

### Project Structure Notes

New files:
- `src/db/schema/transactions.ts` — domain schema file; drizzle-kit picks it up automatically via `schema: './src/db/schema'` in `drizzle.config.ts`
- `src/lib/transactions.ts` — service layer; no HTTP types; callable from route handlers and batch scripts
- `tests/unit/lib/transactions.test.ts`
- `tests/integration/transactions.test.ts`

Modified files:
- `src/db/index.ts` — add transactions schema to the drizzle client
- `src/types/index.ts` — replace stub `Transaction` with re-export from `@/db/schema/transactions`

No UI files, no route handlers, no Zustand stores — pure service + schema layer only.

### Cross-Story Context

- **Story 3.2** adds `GET /api/users/search` and `POST /api/transactions` route handler that calls `sendMoney` from this story
- **Story 3.3** adds `emit()` call inside `sendMoney` — the service function in `src/lib/transactions.ts` will be modified then
- **Story 4.3** (`payRequest`) reuses the atomic debit/credit pattern from this story — `payRequest` calls into a similar `SELECT ... FOR UPDATE` block
- `Transaction` type stub in `src/types/index.ts` was placed there by Story 2.3 — replace it cleanly

### References

- Architecture: Row-level locking decision — `SELECT ... FOR UPDATE` required via raw SQL [Source: `_bmad-output/planning-artifacts/architecture.md#Row-level locking`]
- Architecture: SSE fan-out — emit only after DB commit; do not emit in Story 3.1 [Source: `_bmad-output/planning-artifacts/architecture.md#SSE fan-out`]
- Architecture: Domain schema files under `src/db/schema/` [Source: `_bmad-output/planning-artifacts/architecture.md#Schema organisation`]
- Architecture: Singleton DB client — only `src/db/index.ts` instantiates drizzle [Source: `_bmad-output/planning-artifacts/architecture.md#Database connection`]
- Architecture: No duplication — `sendMoney` in service layer callable from route handlers and scripts (NFR9) [Source: `_bmad-output/planning-artifacts/architecture.md#Module independence`]
- Epics: Story 3.1 ACs [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.1`]
- Previous story: pre-existing `tsc` error in `tests/unit/lib/users.test.ts` — do not fix [Source: `_bmad-output/implementation-artifacts/2-3-sse-connection-and-real-time-updates.md#Known Pre-Existing Issue`]
- Previous story: `Transaction` stub in `src/types/index.ts` placed by Story 2.3 [Source: `_bmad-output/implementation-artifacts/2-3-sse-connection-and-real-time-updates.md#src/types/index.ts`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `tx.execute<{ id: number; balance_cents: number }>(sql\`...\`)` returns the raw rows array — `rows.find()` used to identify sender and recipient from the locked result set.

### Completion Notes List

- Created `src/db/schema/transactions.ts` with `transactions` table: serial PK, two FK integer columns, `amount_cents`, nullable `note`, `created_at` with timezone; non-unique indexes on `sender_id` and `recipient_id`; exports `Transaction` and `NewTransaction` Drizzle-inferred types.
- Updated `src/db/index.ts` to merge `usersSchema` and `transactionsSchema` into the Drizzle client's schema object so the relational client is aware of both tables.
- Generated migration `0001_marvelous_silver_samurai.sql` via `drizzle-kit generate` and applied it via `drizzle-kit migrate` — `transactions` table confirmed in PostgreSQL.
- Created `src/lib/transactions.ts` with `sendMoney(senderId, recipientId, amountCents, note?)`: validation-first guards (`SELF_TRANSFER`, `INVALID_AMOUNT`) before entering the DB transaction; `SELECT ... FOR UPDATE` raw SQL via `sql` tagged template with `ORDER BY id` for deadlock safety; TOCTOU-safe `INSUFFICIENT_BALANCE` check inside the locked transaction; atomic debit/credit via `tx.update` + single `transactions` row insert via `tx.insert().returning()`; no SSE emit (deferred to Story 3.3); uses `createLogger('transactions')`.
- Updated `src/types/index.ts`: replaced the stub `Transaction` interface with `export type { Transaction } from '@/db/schema/transactions'` — `PaymentRequest` and `User` stubs preserved for Epic 4.
- Unit tests (`tests/unit/lib/transactions.test.ts`): mocked `@/db/index` with `vi.mock`; verified `SELF_TRANSFER` and `INVALID_AMOUNT` throw without reaching `db.transaction`; 5 tests pass.
- Integration tests (`tests/integration/transactions.test.ts`): happy path (balance debit/credit + single row insert), note-less send, `INSUFFICIENT_BALANCE` leaves both balances unchanged and zero rows inserted, concurrent sends test (`Promise.allSettled` with two $600 sends from a $1000 balance) — exactly 1 succeeds, 1 fails, final sender balance is $400; cleanup via `afterEach`; 4 tests pass.
- Full regression: 33 unit tests + 11 integration tests all pass.

### File List

- `src/db/schema/transactions.ts` (new)
- `src/db/migrations/0001_marvelous_silver_samurai.sql` (new)
- `src/lib/transactions.ts` (new)
- `tests/unit/lib/transactions.test.ts` (new)
- `tests/integration/transactions.test.ts` (new)
- `src/db/index.ts` (modified)
- `src/types/index.ts` (modified)

## Review Findings

- [x] [Review][Decision] Unit test missing `INSUFFICIENT_BALANCE` coverage — AC9 explicitly requires unit tests for all three error codes (`INSUFFICIENT_BALANCE`, `INVALID_AMOUNT`, `SELF_TRANSFER`) without a real database. Current unit test covers only `INVALID_AMOUNT` and `SELF_TRANSFER`; `INSUFFICIENT_BALANCE` is only tested at integration level. Options: (a) add a unit test that mocks `tx.execute` to return a balance lower than `amountCents`, or (b) accept the deviation and update AC9 wording to reflect the split.

- [x] [Review][Patch] Wrong column in `INSUFFICIENT_BALANCE` test filter — `senderId` used twice [tests/integration/transactions.test.ts:93] — Second `or` arm is `eq(transactions.senderId, recipient.id)` but should be `eq(transactions.recipientId, recipient.id)`. Test passes today (no rows exist) but the filter is logically incorrect and will miss rows in future scenarios.

- [x] [Review][Patch] `const schema` declared between import statements [src/db/index.ts:4-6] — The `const schema = { ...usersSchema, ...transactionsSchema }` line sits between two import groups. Move it below all imports to follow conventional module structure and avoid lint warnings.

- [x] [Review][Patch] `inserted!` non-null assertion — no guard if `INSERT RETURNING` yields nothing [src/lib/transactions.ts:59] — Under abnormal conditions (future triggers, schema changes) `inserted` could be `undefined`, causing a silent `undefined` return typed as `Transaction`. Add `if (!inserted) throw new AppError('Insert failed', 'INTERNAL_ERROR', 500)`.

- [x] [Review][Defer] Stale in-memory balance write instead of SQL arithmetic expression [src/lib/transactions.ts:42-50] — deferred, pre-existing. `FOR UPDATE` makes the current approach safe under PostgreSQL READ COMMITTED (lock prevents concurrent writers). A SQL expression (`SET balance_cents = balance_cents - $amount`) would be unconditionally safe but is not required now.

- [x] [Review][Defer] No guard against recipient balance exceeding PostgreSQL INT4 max [src/lib/transactions.ts:50] — deferred, pre-existing. At training-app scale ($1000 start balance) overflow is unreachable; DB would reject atomically but without a clean `AppError`. Revisit if scale changes.

- [x] [Review][Defer] `amountCents` has no upper bound check [src/lib/transactions.ts:20-22] — deferred, pre-existing. Out of story scope; the `INSUFFICIENT_BALANCE` guard implicitly constrains viable amounts.

- [x] [Review][Defer] Multi-hop deadlock possible with 3+ concurrent users [src/lib/transactions.ts:29] — deferred, pre-existing. `ORDER BY id` prevents pairwise deadlock (A→B vs B→A) but not chain deadlocks (A→B, B→C, C→A). Architectural decision acknowledged in story notes; not a concern at training-app scale.

- [x] [Review][Defer] `note` field has no length constraint [src/db/schema/transactions.ts:8] — deferred, pre-existing. No story requirement for max length; out of scope.

- [x] [Review][Defer] Concurrent test could be flaky under SERIALIZABLE isolation [tests/integration/transactions.test.ts:94-97] — deferred, pre-existing. Test assumes READ COMMITTED (PostgreSQL default); under SERIALIZABLE both sends could fail. Acceptable for training context.

- [x] [Review][Defer] `afterEach` cleanup is non-atomic [tests/integration/transactions.test.ts:17-32] — deferred, pre-existing. Consistent with existing integration test patterns in the project (e.g., `auth.test.ts`).

## Change Log

- 2026-06-16: Implemented Story 3.1 — transactions schema, Drizzle migration, atomic sendMoney service with row-level locking, unit and integration tests.
- 2026-06-16: Code review complete — 1 decision resolved (added INSUFFICIENT_BALANCE unit test), 3 patches applied (test filter bug, import ordering, inserted! guard), 7 deferred, 4 dismissed.
