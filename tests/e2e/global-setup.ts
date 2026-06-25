import { execSync } from 'node:child_process'

// Runs pending Drizzle migrations before any e2e test starts.
// Without this guard a local DB that is missing new migrations causes every
// authenticated spec to hit a 500 on register(), which cascades into a wall
// of timeouts that are hard to diagnose. The migration script is idempotent —
// it is safe to re-run against an already-current schema.
export default async function globalSetup() {
  execSync('npm run db:migrate', { stdio: 'inherit' })
}
