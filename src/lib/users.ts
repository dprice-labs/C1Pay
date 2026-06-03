import bcrypt from 'bcryptjs'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import type { User } from '@/db/schema/users'

const log = createLogger('users')

export async function createUser(username: string, password: string): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const [user] = await db
      .insert(users)
      .values({ username, passwordHash, balanceCents: 100000 })
      .returning()
    log.info(`User created: ${username}`)
    return user
  } catch (error) {
    // Drizzle wraps Postgres errors in DrizzleQueryError; the original message is in .cause
    const msg = error instanceof Error
      ? error.message + (error.cause instanceof Error ? ' ' + error.cause.message : '')
      : ''
    if (/duplicate key|unique constraint/i.test(msg)) {
      throw new AppError('Username already taken', 'USERNAME_TAKEN', 409)
    }
    throw error
  }
}
