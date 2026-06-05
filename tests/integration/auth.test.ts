import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { createUser, findByUsername } from '@/lib/users'
import { verifyPassword } from '@/lib/auth'

const TEST_USERNAME = '__integration_test_auth__'

afterAll(async () => {
  await globalThis._pgClient?.end()
  globalThis._pgClient = undefined
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

describe('findByUsername + verifyPassword', () => {
  it('returns the user for an existing username', async () => {
    await createUser(TEST_USERNAME, 'testpassword')
    const user = await findByUsername(TEST_USERNAME)
    expect(user).toBeDefined()
    expect(user!.username).toBe(TEST_USERNAME)
  })

  it('returns undefined for a non-existent username', async () => {
    const user = await findByUsername('__does_not_exist_1234__')
    expect(user).toBeUndefined()
  })

  it('verifyPassword returns true for the correct password', async () => {
    const user = await createUser(TEST_USERNAME, 'testpassword')
    expect(await verifyPassword('testpassword', user.passwordHash)).toBe(true)
  })

  it('verifyPassword returns false for an incorrect password', async () => {
    const user = await createUser(TEST_USERNAME, 'testpassword')
    expect(await verifyPassword('wrongpassword', user.passwordHash)).toBe(false)
  })
})
