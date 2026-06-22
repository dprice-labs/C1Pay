// Applies pending Drizzle migrations using the drizzle-orm programmatic migrator.
//
// We use this instead of the `drizzle-kit migrate` CLI because that CLI exits
// silently (no output, no changes) on Node 26 — the host toolchain. The
// programmatic migrator runs on the same postgres-js driver the app uses, which
// works fine on Node 26 + PostgreSQL 18. drizzle's docs also recommend this
// approach for applying migrations. Run via `npm run db:migrate`.
//
// DATABASE_URL resolution:
//   - CI / containers inject it into the environment (takes precedence).
//   - Local runs read it from .env.local.
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    // No .env.local present — the explicit check below will report the problem.
  }
}

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('[migrate] DATABASE_URL is not set — add it to .env.local')
}

const migrationsFolder = resolve(dirname(fileURLToPath(import.meta.url)), 'migrations')

const sql = postgres(url, { max: 1 })
try {
  await migrate(drizzle(sql), { migrationsFolder })
  console.log('[migrate] Migrations applied.')
} catch (err) {
  console.error('[migrate] failed:', err)
  process.exitCode = 1
} finally {
  await sql.end()
}
