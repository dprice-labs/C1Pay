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
logger.info('db', 'Drizzle client initialised')
