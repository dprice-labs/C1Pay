import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { like } from 'drizzle-orm'
import {
  createTestAccounts,
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
