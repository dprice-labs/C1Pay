import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createUser, findExistingUsernames } from '@/lib/users'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import { closeDb } from '@/db/index'

const log = createLogger('seed')

// Number(x) || fallback would silently discard an explicit "0" (0 is falsy in
// JS) — parse manually so an operator-set 0 is honored. Number.isFinite (not
// just isNaN) also rejects "Infinity"/"-Infinity", which would otherwise pass
// straight through and make the create loop below run forever.
function parseEnvInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const SEED_ACCOUNT_COUNT = parseEnvInt(process.env.SEED_ACCOUNT_COUNT, 10)
export const SEED_BALANCE_CENTS = parseEnvInt(process.env.SEED_BALANCE_CENTS, 100000)
export const SEED_USERNAME_PREFIX = 'testuser'
export const SEED_PASSWORD = 'password123'

// Fail fast on bad config before any DB work — without this, an invalid
// SEED_BALANCE_CENTS only surfaces on the first loop iteration (via
// createUser's own guard), aborting the whole batch with an error that looks
// specific to "testuser1" rather than to the shared config value every
// iteration would have failed on identically.
function assertValidConfig(): void {
  if (!Number.isInteger(SEED_ACCOUNT_COUNT) || SEED_ACCOUNT_COUNT < 0) {
    throw new AppError(
      `SEED_ACCOUNT_COUNT must be a non-negative integer, got ${SEED_ACCOUNT_COUNT}`,
      'INVALID_CONFIG',
      400,
    )
  }
  if (!Number.isInteger(SEED_BALANCE_CENTS) || SEED_BALANCE_CENTS < 0) {
    throw new AppError(
      `SEED_BALANCE_CENTS must be a non-negative integer, got ${SEED_BALANCE_CENTS}`,
      'INVALID_CONFIG',
      400,
    )
  }
}

export async function createTestAccounts(): Promise<void> {
  assertValidConfig()

  let created = 0
  let skipped = 0

  try {
    const candidates = Array.from({ length: SEED_ACCOUNT_COUNT }, (_, i) => `${SEED_USERNAME_PREFIX}${i + 1}`)
    // One batched lookup instead of SEED_ACCOUNT_COUNT sequential round-trips.
    const existingUsernames = await findExistingUsernames(candidates)

    for (const username of candidates) {
      if (existingUsernames.has(username)) {
        skipped++
        continue
      }

      try {
        await createUser(username, SEED_PASSWORD, SEED_BALANCE_CENTS)
        created++
      } catch (error) {
        // Safety net for the rare race where the account was created between
        // the batched lookup above and this insert.
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
      await closeDb()
    })
}
