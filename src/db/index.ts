import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as usersSchema from './schema/users'
import * as transactionsSchema from './schema/transactions'
import { logger } from '@/lib/logger'

const schema = { ...usersSchema, ...transactionsSchema }

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('[db] DATABASE_URL is not set — add it to .env.local')
}

// Global guard: prevents multiple postgres connection pools during Next.js hot-reload.
// On each hot-reload, module code re-runs; without this, a new pool is created every save,
// exhausting PostgreSQL's max_connections limit.
declare global {
  // eslint-disable-next-line no-var
  var _pgClient: ReturnType<typeof postgres> | undefined
}

const client = globalThis._pgClient ?? postgres(connectionString)
if (process.env.NODE_ENV !== 'production') {
  globalThis._pgClient = client
}

export const db = drizzle(client, { schema })

// For standalone scripts (e.g. scripts/seed.ts) to close the real connection
// on exit — globalThis._pgClient is only cached outside production, so a
// script relying on that global directly would silently no-op and leave the
// connection open. A dedicated function (rather than exporting the raw
// client) keeps this module the only place that knows how the connection is
// actually structured and torn down.
export async function closeDb(): Promise<void> {
  await client.end()
}
logger.info('db', 'Drizzle client initialised')
