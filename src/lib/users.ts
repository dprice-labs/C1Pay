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
    const rows = await db
      .insert(users)
      .values({ username, passwordHash, balanceCents: 100000 })
      .returning()
    const user = rows[0]
    if (!user) {
      throw new AppError('User creation failed', 'INTERNAL_ERROR', 500)
    }
    log.info('User created')
    return user
  } catch (error) {
    if (error instanceof AppError) throw error
    // Drizzle wraps Postgres errors; check both top-level and cause for error code 23505
    const pgCode =
      (error as { code?: string }).code ??
      ((error as { cause?: { code?: string } }).cause?.code)
    if (pgCode === '23505') {
      throw new AppError('Username already taken', 'USERNAME_TAKEN', 409)
    }
    log.error(`Unexpected error in createUser: ${error instanceof Error ? error.message : String(error)}`)
    throw error
  }
}
