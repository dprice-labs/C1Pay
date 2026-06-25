import postgres from 'postgres'

// Deletes all e2e_ accounts accumulated across test runs. Every e2e spec
// registers fresh accounts with no per-test cleanup (suite-wide convention),
// so without this the test DB grows unboundedly. A prefix-based DELETE is
// safe as long as the e2e_ namespace is exclusive to test accounts.
export default async function globalTeardown() {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile('.env.local')
    } catch {
      // No .env.local — likely CI where DATABASE_URL is injected.
    }
  }

  const url = process.env.DATABASE_URL
  if (!url) return

  const sql = postgres(url, { max: 1 })
  try {
    await sql`DELETE FROM users WHERE username LIKE 'e2e_%'`
  } finally {
    await sql.end()
  }
}
