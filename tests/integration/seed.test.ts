import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { or, inArray, like, eq } from 'drizzle-orm'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { transactions } from '@/db/schema/transactions'
import { paymentRequests } from '@/db/schema/requests'
import {
  createTestAccounts,
  resetTestAccounts,
  SEED_ACCOUNT_COUNT,
  SEED_BALANCE_CENTS,
  SEED_USERNAME_PREFIX,
} from '../../scripts/seed'

afterAll(async () => {
  await globalThis._pgClient?.end()
  globalThis._pgClient = undefined
})

afterEach(async () => {
  try {
    await db.delete(users).where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
  } catch {
    // cleanup best-effort
  }
})

describe('createTestAccounts', () => {
  // bcrypt at work factor 12 is deliberately slow; SEED_ACCOUNT_COUNT sequential
  // hashes (and the idempotent re-run below hashes again before hitting the
  // USERNAME_TAKEN guard) can exceed Vitest's 5s default test timeout.
  it('creates the configured number of accounts with the configured balance', async () => {
    await createTestAccounts()

    const rows = await db.select().from(users).where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
    expect(rows).toHaveLength(SEED_ACCOUNT_COUNT)
    expect(rows.every((r) => r.balanceCents === SEED_BALANCE_CENTS)).toBe(true)
  }, 20000)

  it('is idempotent — a second run creates no duplicates', async () => {
    await createTestAccounts()
    await createTestAccounts()

    const rows = await db.select().from(users).where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
    expect(rows).toHaveLength(SEED_ACCOUNT_COUNT)
  }, 20000)
})

describe('resetTestAccounts', () => {
  // FK-safe inner cleanup: delete child rows before the outer afterEach deletes
  // users. Without this, if a test fails before calling reset, the outer
  // afterEach's db.delete(users) violates the FK constraint on
  // transactions/payment_requests and silently fails, leaving dirty state.
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
    expect(ids.length).toBeGreaterThanOrEqual(2) // requires at least a sender and a recipient
    const [user1, user2] = ids

    // Simulate training-session activity: a send and a payment request
    await db.insert(transactions).values({ senderId: user1!, recipientId: user2!, amountCents: 1000 })
    await db.insert(paymentRequests).values({ requesterId: user2!, recipientId: user1!, amountCents: 500 })

    // Drift one balance to confirm the reset restores it
    await db.update(users).set({ balanceCents: 50000 }).where(eq(users.id, user1!))

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
  }, 20000)

  it('is idempotent — a second reset produces the identical state', async () => {
    await createTestAccounts()
    await resetTestAccounts()
    await resetTestAccounts()

    const resetUsers = await db
      .select()
      .from(users)
      .where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
    expect(resetUsers.every((u) => u.balanceCents === SEED_BALANCE_CENTS)).toBe(true)
  }, 20000)
})
