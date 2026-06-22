import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createUser, findByUsername } from '@/lib/users'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import { pgClient } from '@/db/index'

const log = createLogger('seed')

// Number(x) || fallback would silently discard an explicit "0" (0 is falsy in
// JS) — parse manually so an operator-set 0 is honored rather than ignored.
function parseEnvInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isNaN(parsed) ? fallback : parsed
}

export const SEED_ACCOUNT_COUNT = parseEnvInt(process.env.SEED_ACCOUNT_COUNT, 10)
export const SEED_BALANCE_CENTS = parseEnvInt(process.env.SEED_BALANCE_CENTS, 100000)
export const SEED_USERNAME_PREFIX = 'testuser'
export const SEED_PASSWORD = 'password123'

export async function createTestAccounts(): Promise<void> {
  let created = 0
  let skipped = 0

  try {
    for (let i = 1; i <= SEED_ACCOUNT_COUNT; i++) {
      const username = `${SEED_USERNAME_PREFIX}${i}`

      // Cheap existence check first: createUser() always pays bcrypt's ~100-300ms
      // hash cost before its own USERNAME_TAKEN guard fires, so on a re-run where
      // every account already exists, skipping here avoids hashing N times for nothing.
      const existing = await findByUsername(username)
      if (existing) {
        skipped++
        continue
      }

      try {
        await createUser(username, SEED_PASSWORD, SEED_BALANCE_CENTS)
        created++
      } catch (error) {
        // Safety net for the rare race where the account was created between
        // the existence check above and this insert.
        if (error instanceof AppError && error.code === 'USERNAME_TAKEN') {
          skipped++
          continue
        }
        throw error
      }
    }
  } finally {
    // Runs even if the loop above threw, so a partial batch still reports how
    // far it got instead of leaving the operator with only an uncaught error.
    log.info(
      `create: ${created} account(s) created, ${skipped} skipped (already existed), starting balance ${SEED_BALANCE_CENTS} cents`,
    )
  }
}

async function main(): Promise<void> {
  const command = process.argv[2]
  if (command !== 'create') {
    log.error(`Unknown or missing command "${command}". Usage: npm run seed -- create`)
    process.exitCode = 1
    return
  }
  await createTestAccounts()
}

// Only run when executed directly (`tsx scripts/seed.ts`), not when imported by tests.
// realpathSync resolves symlinks on both sides — a plain `process.argv[1] ===
// fileURLToPath(import.meta.url)` string comparison can mismatch when either
// path is reached through a symlink (e.g. a symlinked checkout dir), which
// would silently skip main() and exit 0 having done nothing.
function isMainModule(): boolean {
  if (!process.argv[1]) return false
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

if (isMainModule()) {
  main()
    .catch((error) => {
      log.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    })
    .finally(async () => {
      // Close the real connection directly — globalThis._pgClient is only
      // cached outside production (see src/db/index.ts), so relying on it
      // here would silently no-op and leave the connection open in production.
      await pgClient.end()
    })
}
