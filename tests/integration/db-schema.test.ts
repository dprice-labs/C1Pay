import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { eq } from 'drizzle-orm'

const TEST_USERNAME = '__integration_test_schema__'

afterAll(async () => {
  await globalThis._pgClient?.end()
})

afterEach(async () => {
  try {
    await db.delete(users).where(eq(users.username, TEST_USERNAME))
  } catch {
    // cleanup best-effort; orphan rows won't affect other tests
  }
})

describe('users schema', () => {
  it('enforces unique constraint on username', async () => {
    await db.insert(users).values({
      username: TEST_USERNAME,
      passwordHash: 'test-hash-1',
      balanceCents: 0,
    })

    await expect(
      db.insert(users).values({
        username: TEST_USERNAME,
        passwordHash: 'test-hash-2',
        balanceCents: 0,
      })
    ).rejects.toMatchObject({ cause: { message: expect.stringMatching(/duplicate key|unique constraint/i) } })
  })
})
