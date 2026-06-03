import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { createUser } from '@/lib/users'

const TEST_USERNAME = '__integration_test_auth__'

afterAll(async () => {
  await globalThis._pgClient?.end()
})

afterEach(async () => {
  try {
    await db.delete(users).where(eq(users.username, TEST_USERNAME))
  } catch {
    // cleanup best-effort
  }
})

describe('createUser', () => {
  it('persists a user with hashed password and balance_cents = 100000', async () => {
    await createUser(TEST_USERNAME, 'testpassword')

    const [row] = await db.select().from(users).where(eq(users.username, TEST_USERNAME))

    expect(row).toBeDefined()
    expect(row.balanceCents).toBe(100000)
    expect(row.passwordHash).not.toBe('testpassword')
    expect(await bcrypt.compare('testpassword', row.passwordHash)).toBe(true)
  })

  it('throws USERNAME_TAKEN when username already exists', async () => {
    await createUser(TEST_USERNAME, 'firstpassword')
    await expect(createUser(TEST_USERNAME, 'secondpassword')).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    })
  })
})
