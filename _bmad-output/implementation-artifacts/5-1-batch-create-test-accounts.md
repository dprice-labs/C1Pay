---
baseline_commit: 2bc2b17
---

# Story 5.1: Batch Create Test Accounts

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a session facilitator,
I want to create a batch of test accounts with a single command,
so that I can prepare a training session in under two minutes without any UI.

## Acceptance Criteria

1. **Given** `scripts/seed.ts` exists, **When** invoked with a create command (e.g., `npm run seed -- create`), **Then** it creates a configured number of test user accounts in a single run (FR33)

2. **Given** the create command, **When** it creates accounts, **Then** every account is assigned the same specified starting balance (the configured `balance_cents` value applied uniformly to all accounts) (FR34)

3. **Given** the create command, **Then** each account is created through the existing `createUser()` service in `src/lib/users.ts` — no user-creation or password-hashing logic is duplicated in the script (NFR9), so passwords are bcrypt-hashed at work factor 12 exactly as in registration

4. **Given** the create command is run a second time with the same configuration, **When** executed, **Then** it is idempotent — it does not create duplicate accounts or corrupt existing data (e.g., it skips accounts whose usernames already exist) and the final state matches a single run (FR36)

5. **Given** the create command, **When** it completes, **Then** it logs a clear summary (accounts created vs. skipped, starting balance applied) via `src/lib/logger.ts`

6. **Given** an integration test for the create command, **When** run twice against a real test database, **Then** it verifies the expected accounts exist with the correct starting balance and that the second run produces no duplicates

## Tasks / Subtasks

- [x] Task 1: Extend `createUser()` to accept a configurable starting balance (AC: #2, #3)
  - [x] Add an optional third parameter `balanceCents: number = 100000` to `createUser()` in `src/lib/users.ts` — default preserves existing registration behaviour exactly
  - [x] Pass `balanceCents` into the `.values({ username, passwordHash, balanceCents })` insert instead of the hardcoded `100000`
  - [x] Confirm no other call site breaks: `src/app/api/auth/register/route.ts` and all existing tests call `createUser()` with 2 args and are unaffected by the new optional param

- [x] Task 2: Create `scripts/seed.ts` with a `create` command (AC: #1, #2, #3, #4, #5)
  - [x] Define config constants with env var overrides: `SEED_ACCOUNT_COUNT` (default 10), `SEED_BALANCE_CENTS` (default 100000), `SEED_USERNAME_PREFIX` (`'testuser'`), `SEED_PASSWORD` (a fixed shared password, e.g. `'password123'`)
  - [x] Export an async `createTestAccounts()` function: loops `1..SEED_ACCOUNT_COUNT`, builds username `${SEED_USERNAME_PREFIX}${i}`, calls `createUser(username, SEED_PASSWORD, SEED_BALANCE_CENTS)` per account
  - [x] Catch `AppError` with `code === 'USERNAME_TAKEN'` per-account and count it as skipped (idempotency — re-running hits the existing unique-username constraint and naturally skips); rethrow any other error
  - [x] Log a summary via `createLogger('seed')`: accounts created, accounts skipped, starting balance applied
  - [x] Add a `main()` that reads `process.argv[2]` and dispatches `'create'` → `createTestAccounts()`; unknown/missing command logs an error and sets `process.exitCode = 1`
  - [x] Guard the CLI execution so importing the module (e.g. from a test) does not auto-run `main()`: `if (process.argv[1] === fileURLToPath(import.meta.url)) { main() }`
  - [x] After `main()` settles, close the DB connection so the CLI process exits cleanly: `await globalThis._pgClient?.end()`

- [x] Task 3: Wire the npm script and dependency (AC: #1)
  - [x] Add `tsx` (`^4.22.0`) to `devDependencies`
  - [x] Add `"seed": "tsx --env-file-if-exists=.env.local scripts/seed.ts"` to `package.json` `scripts`
  - [x] Verify `npm run seed -- create` runs end-to-end against the local dev database

- [x] Task 4: Write integration test `tests/integration/seed.test.ts` (AC: #6)
  - [x] Import `createTestAccounts` directly from `scripts/seed.ts` (no subprocess spawning — consistent with how other integration tests call service functions directly)
  - [x] First run: assert `SEED_ACCOUNT_COUNT` accounts exist with `balanceCents === SEED_BALANCE_CENTS`
  - [x] Second run: assert no duplicate rows are created and the account count is unchanged
  - [x] Clean up all `testuser*`-prefixed rows in `afterEach`/`afterAll`, following the existing `globalThis._pgClient?.end()` teardown pattern

## Dev Notes

### What Already Exists — Do Not Recreate

| File | State | Relevant to this story |
|------|-------|------------------------|
| `src/lib/users.ts` | EXISTS — **MUST MODIFY** | `createUser(username, password)` currently hardcodes `balanceCents: 100000`. Add an optional 3rd param; do not duplicate the bcrypt-hash/insert/`USERNAME_TAKEN` logic anywhere else. |
| `src/lib/errors.ts` | EXISTS — no change | `AppError` already has the shape needed (`code === 'USERNAME_TAKEN'`) to detect duplicates for idempotency |
| `src/lib/logger.ts` | EXISTS — no change | `createLogger('seed')` — no raw `console.log` |
| `src/db/index.ts` | EXISTS — no change | Exposes the shared pg client via `globalThis._pgClient` (same global used by integration test teardown) — reuse it to close the connection cleanly when the CLI script finishes |
| `scripts/` | DOES NOT EXIST YET | This story creates the directory and `seed.ts` |
| `package.json` `scripts` | EXISTS — **MUST MODIFY** | No `seed` script and no `tsx`/`ts-node` dependency exists yet in this project — this story introduces the first one |

### `createUser()` Signature Change — Exact Diff

Current (`src/lib/users.ts`):
```typescript
export async function createUser(username: string, password: string): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const rows = await db
      .insert(users)
      .values({ username, passwordHash, balanceCents: 100000 })
      .returning()
    ...
```

Change to:
```typescript
export async function createUser(
  username: string,
  password: string,
  balanceCents = 100000,
): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const rows = await db
      .insert(users)
      .values({ username, passwordHash, balanceCents })
      .returning()
    ...
```
This is the only change to `users.ts`. All existing 2-arg call sites (`src/app/api/auth/register/route.ts`, `tests/unit/lib/users.test.ts`, `tests/integration/auth.test.ts`, `tests/integration/transactions.test.ts`) are unaffected — the default keeps `balanceCents = 100000`, identical to today's hardcoded behaviour. Do not add Zod validation on `balanceCents` here — it's an internal/trusted call path (route handler and script), not a user-facing input boundary.

### `scripts/seed.ts` — Reference Implementation

```typescript
import { fileURLToPath } from 'node:url'
import { createUser } from '@/lib/users'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('seed')

export const SEED_ACCOUNT_COUNT = Number(process.env.SEED_ACCOUNT_COUNT) || 10
export const SEED_BALANCE_CENTS = Number(process.env.SEED_BALANCE_CENTS) || 100000
export const SEED_USERNAME_PREFIX = 'testuser'
export const SEED_PASSWORD = 'password123'

export async function createTestAccounts(): Promise<void> {
  let created = 0
  let skipped = 0

  for (let i = 1; i <= SEED_ACCOUNT_COUNT; i++) {
    const username = `${SEED_USERNAME_PREFIX}${i}`
    try {
      await createUser(username, SEED_PASSWORD, SEED_BALANCE_CENTS)
      created++
    } catch (error) {
      if (error instanceof AppError && error.code === 'USERNAME_TAKEN') {
        skipped++
        continue
      }
      throw error
    }
  }

  log.info(
    `create: ${created} account(s) created, ${skipped} skipped (already existed), starting balance ${SEED_BALANCE_CENTS} cents`,
  )
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

// Only run when executed directly (`tsx scripts/seed.ts`), not when imported by tests
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .catch((error) => {
      log.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`)
      process.exitCode = 1
    })
    .finally(async () => {
      await globalThis._pgClient?.end()
    })
}
```

**Why the `import.meta.url` guard is required:** Task 4's integration test imports `createTestAccounts` directly from `scripts/seed.ts`. Without the guard, importing the module would also execute `main()` (and `process.exitCode = 1` / DB-closing side effects) as an unconditional side effect of the import, breaking the test run. The guard pattern was verified to work correctly under both `tsx` (direct CLI execution) and Vitest (import-only — `process.argv[1]` is Vitest's own entry point, so the guard correctly evaluates to `false`).

**Why per-account try/catch instead of a pre-check `findByUsername` call:** A check-then-insert (`findByUsername` then `createUser`) is a TOCTOU race and also duplicates the uniqueness logic the database already enforces via `idx_users_username`. Catching `USERNAME_TAKEN` from `createUser()` reuses the exact guard `createUser()` already has (NFR9) and is what makes the command idempotent — no separate "does this exist" logic needed.

**Balance is NOT retroactively updated on existing accounts:** If `SEED_BALANCE_CENTS` changes between runs, only newly-created accounts get the new value — pre-existing accounts keep whatever balance they currently have (which may have drifted from training activity). Re-synchronizing balances on existing accounts is explicitly **Story 5.2's job** (`reset` command) — do not add that behavior here.

### Running TypeScript Directly — `tsx` Setup (Verified)

No TypeScript script runner (`tsx`/`ts-node`) exists in this project yet — this is the first one. Verified directly in this environment before writing this story:
- `npx tsx scripts/seed.ts` correctly resolves the `@/*` → `./src/*` path alias from `tsconfig.json` with zero extra config — no `tsconfig-paths` package needed.
- `node --env-file-if-exists=.env.local` (Node ≥ 20.6, available here on Node v24) loads `.env.local` into `process.env` before the script runs — **no `dotenv` package needed**. This is the first place `--env-file-if-exists` is used in the project; Next.js itself loads `.env.local` automatically for `next dev`/`next build`, but a standalone script run via `tsx` does not get that for free, hence the explicit flag.
- `tsx` forwards unrecognized flags straight to the underlying `node` process, so `tsx --env-file-if-exists=.env.local scripts/seed.ts` is valid and was confirmed to set `DATABASE_URL` from `.env.local`.

`package.json` additions:
```json
"scripts": {
  "seed": "tsx --env-file-if-exists=.env.local scripts/seed.ts"
}
```
```json
"devDependencies": {
  "tsx": "^4.22.0"
}
```
Run as: `npm run seed -- create` (the `--` is required so `create` is forwarded to the script's `process.argv`, not consumed by `npm run`).

### Env Var Pattern — First Numeric Config in the Project

Only `DATABASE_URL` and `JWT_SECRET` exist as env vars today (`src/db/index.ts`, `src/lib/auth.ts`), both required strings with a throw-if-missing guard. `SEED_ACCOUNT_COUNT` / `SEED_BALANCE_CENTS` are the first **numeric, optional, defaulted** env vars in the codebase — there's no existing pattern to match beyond "read from `process.env`". Use `Number(process.env.X) || <default>` (falls back to the default for both `undefined` and non-numeric strings, since `Number(undefined)` is `NaN` and `NaN || x` is `x`). Document both in `.env.example` with a comment, consistent with the existing `DATABASE_URL`/`JWT_SECRET` documentation style, but make clear in the comment that they're optional and only used by the seed script.

### Testing Requirements

- **Unit tests:** Not required by the ACs for this story — `createTestAccounts()` only orchestrates real DB calls through `createUser()`, which already has full unit coverage of its hashing/error behaviour. Adding a mocked-DB unit test for the loop logic would duplicate what the integration test already proves more meaningfully.
- **Integration test** (`tests/integration/seed.test.ts`) — follow the established pattern from `tests/integration/auth.test.ts`:
  ```typescript
  import { describe, it, expect, afterEach, afterAll } from 'vitest'
  import { db } from '@/db/index'
  import { users } from '@/db/schema/users'
  import { like } from 'drizzle-orm'
  import { createTestAccounts, SEED_ACCOUNT_COUNT, SEED_BALANCE_CENTS, SEED_USERNAME_PREFIX } from '../../scripts/seed'

  afterAll(async () => {
    await globalThis._pgClient?.end()
    globalThis._pgClient = undefined
  })

  afterEach(async () => {
    try {
      await db.delete(users).where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
    } catch {
      // cleanup best-effort
    }
  })

  describe('createTestAccounts', () => {
    it('creates the configured number of accounts with the configured balance', async () => {
      await createTestAccounts()
      const rows = await db.select().from(users).where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
      expect(rows).toHaveLength(SEED_ACCOUNT_COUNT)
      expect(rows.every((r) => r.balanceCents === SEED_BALANCE_CENTS)).toBe(true)
    })

    it('is idempotent — a second run creates no duplicates', async () => {
      await createTestAccounts()
      await createTestAccounts()
      const rows = await db.select().from(users).where(like(users.username, `${SEED_USERNAME_PREFIX}%`))
      expect(rows).toHaveLength(SEED_ACCOUNT_COUNT)
    })
  })
  ```
  Note the relative import path (`../../scripts/seed`) — `scripts/` is outside `src/`, so the `@/*` alias doesn't reach it; `vitest.config.ts`'s `@` alias only maps to `./src`.

### Project Structure Notes

New files:
- `scripts/seed.ts` — matches the path already named in `architecture.md`'s project structure diagram exactly
- `tests/integration/seed.test.ts`

Modified files:
- `src/lib/users.ts` — `createUser()` gains an optional 3rd parameter
- `package.json` — new `seed` script, new `tsx` devDependency
- `.env.example` — document `SEED_ACCOUNT_COUNT` / `SEED_BALANCE_CENTS` as optional

No route handlers, no UI, no Zustand stores, no schema/migration changes — this story only touches the service layer (`users.ts`) and adds the standalone script.

### Cross-Story Context

- **Story 5.2** adds a `reset` command to the *same* `scripts/seed.ts` file (clears transactions/requests, restores balances for `testuser*` accounts). Keep the `main()` dispatch in this story to a plain `if (command !== 'create')` check — it will become a `switch`/two-branch dispatch in 5.2; don't over-build a command-routing abstraction now for a single command.
- This story runs after Epic 3 (Story 3.3, currently `review`) and before Epic 4 is built — Epic 5 has no dependency on Epic 4's request flow, so building it now does not block on Epic 4. `createUser()` is the only shared dependency, and it is unmodified in shape (only an additive optional param).

### References

- Epics: Story 5.1 ACs and Epic 5 goal/architecture note [Source: `_bmad-output/planning-artifacts/epics.md#Epic 5: Batch Administration`]
- Architecture: `scripts/seed.ts` location and "calls `src/lib/` service functions directly (plain async functions, no HTTP types)" [Source: `_bmad-output/planning-artifacts/architecture.md#Service boundary — Route Handlers ↔ src/lib/`]
- Architecture: No duplication of business logic (NFR9) — batch script must reuse `createUser()` rather than reimplement hashing/insert logic [Source: `_bmad-output/planning-artifacts/architecture.md#Enforcement Guidelines`]
- Architecture: Labeled logger convention — `createLogger(context)`, no raw `console.log` [Source: `_bmad-output/planning-artifacts/architecture.md#Logging`]
- Previous pattern: `AppError`/`USERNAME_TAKEN` idempotency guard already implemented in `createUser()` [Source: `src/lib/users.ts`]
- Previous pattern: integration test cleanup convention (`afterEach` delete + `afterAll` close shared pg client) [Source: `tests/integration/auth.test.ts`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Local dev database (`.env.local`) was missing the `transactions` migration (only `users` existed) — applied `npx drizzle-kit migrate` before running the regression suite; this was pre-existing environment drift unrelated to this story's code changes, not something introduced here.
- Verified (not assumed) that `tsx` resolves the project's `@/*` tsconfig path alias with zero extra config, and that `node --env-file-if-exists=.env.local` loads `.env.local` for a standalone script — confirmed via throwaway scripts before committing to this approach in `scripts/seed.ts`.
- Verified the `if (process.argv[1] === fileURLToPath(import.meta.url))` CLI-guard pattern correctly runs `main()` under direct `tsx` execution and correctly skips it when the module is imported (both under `tsx` and under Vitest).
- `tests/integration/seed.test.ts`'s idempotency test needed an explicit 20000ms timeout — bcrypt at work factor 12 across `SEED_ACCOUNT_COUNT` (10) sequential creates, doubled by the second idempotent run (10 created + 10 rejected-but-still-hashed), exceeds Vitest's 5000ms default.

### Completion Notes List

- Extended `createUser()` in `src/lib/users.ts` with an optional `balanceCents = 100000` third parameter; default behaviour for all existing 2-arg call sites (registration route, existing unit/integration tests) is unchanged.
- Created `scripts/seed.ts`: exports `createTestAccounts()` and config constants (`SEED_ACCOUNT_COUNT`, `SEED_BALANCE_CENTS`, `SEED_USERNAME_PREFIX`, `SEED_PASSWORD`); idempotency achieved by catching `AppError` with code `USERNAME_TAKEN` per account rather than a separate existence check; CLI entry point guarded so importing the module for tests doesn't trigger `main()`.
- Added `tsx` (`^4.22.4`) as a devDependency and a `"seed": "tsx --env-file-if-exists=.env.local scripts/seed.ts"` npm script; manually verified `npm run seed -- create` end-to-end against the local dev database, including a second run to confirm idempotency (0 created, 10 skipped), then cleaned up the manually-created rows before the automated test suite ran.
- Added `tests/integration/seed.test.ts` covering both ACs: correct count/balance on first run, and no duplicates on a second run — follows the existing `auth.test.ts` cleanup convention (`afterEach` delete by username pattern, `afterAll` close shared pg client).
- Added a unit test (`tests/unit/lib/users.test.ts`) confirming `createUser()` uses a provided `balanceCents` when given, alongside the existing default-balance test.
- Full regression: 39 unit tests + 14 integration tests pass; `npx tsc --noEmit` shows only the pre-existing, documented type error in `tests/unit/lib/users.test.ts` (unrelated to this story, not to be fixed per Story 3.1's Dev Notes); `npm run lint` reports 0 errors (2 pre-existing warnings in unrelated files).
- **Code review follow-up (2026-06-22):** addressed 6 findings from `/code-review`:
  - `createUser()` now validates `balanceCents` is a non-negative integer, throwing `AppError('Balance must be a non-negative integer', 'INVALID_AMOUNT', 400)` before hashing — closes a gap where an unvalidated negative/non-integer balance (e.g. from a malformed `SEED_BALANCE_CENTS`) could reach the DB unguarded, since `createUser` is also reachable from the public registration route.
  - `scripts/seed.ts`'s env parsing replaced `Number(x) || default` (which silently discarded an explicit `0`) with a `parseEnvInt` helper that only falls back on `undefined`/empty/`NaN`.
  - `src/db/index.ts` now exports the raw `pgClient` (the actual postgres client `db` uses); `scripts/seed.ts` closes that directly instead of `globalThis._pgClient?.end()`, which was a no-op whenever `NODE_ENV==='production'` (the global cache is skipped in production) and would have left the connection open.
  - `createTestAccounts()`'s loop is now wrapped in `try/finally` so the created/skipped summary always logs, even when a non-`USERNAME_TAKEN` error aborts the batch partway through.
  - The CLI-entrypoint guard now compares `realpathSync()`-resolved paths instead of raw `process.argv[1] === fileURLToPath(import.meta.url)`, so it can't silently mismatch (and skip `main()`) when a symlink is involved.
  - `createTestAccounts()` now checks `findByUsername()` before calling `createUser()`, skipping the ~100-300ms bcrypt hash entirely for accounts that already exist — confirmed by re-timing the idempotent re-run (was paying full hash cost per duplicate, now near-instant) and by the integration suite running measurably faster.
  - Re-ran full regression after fixes: 42 unit tests (+3 new validation tests) + 14 integration tests pass; manually verified `SEED_ACCOUNT_COUNT=0`, `SEED_BALANCE_CENTS=-500` (now rejected, zero rows inserted), and a clean `npm run seed -- create` exit (process no longer hangs).

### File List

- `scripts/seed.ts` (new)
- `tests/integration/seed.test.ts` (new)
- `src/lib/users.ts` (modified)
- `src/db/index.ts` (modified)
- `tests/unit/lib/users.test.ts` (modified)
- `package.json` (modified)
- `package-lock.json` (modified)
- `.env.example` (modified)

## Change Log

- 2026-06-22: Implemented Story 5.1 — extended `createUser()` with a configurable starting balance, added `scripts/seed.ts` with an idempotent `create` command, wired `npm run seed` via `tsx`, and added unit + integration test coverage.
- 2026-06-22: Addressed code review findings (round 1) — balance validation, falsy-zero env parsing, production-safe connection close, partial-batch summary reporting, symlink-safe CLI guard, and redundant-hash avoidance on idempotent re-runs.
- 2026-06-22: Addressed code review findings (round 2) — 5 more findings:
  - `parseEnvInt` now uses `Number.isFinite` instead of `!Number.isNaN`, so `SEED_ACCOUNT_COUNT=Infinity` falls back to the default instead of looping forever (`for (let i = 1; i <= Infinity; i++)` never terminated).
  - `createTestAccounts()` now calls `assertValidConfig()` up front, validating `SEED_ACCOUNT_COUNT`/`SEED_BALANCE_CENTS` are non-negative integers before any DB work — a bad `SEED_BALANCE_CENTS` previously only failed on account 1's `createUser()` call, aborting the whole batch with an error that looked specific to "testuser1" rather than to the shared config.
  - `createUser()`'s balance-validation error code changed from `INVALID_AMOUNT` (already used by `transactions.ts`/`requests.ts` for an unrelated "transfer/request amount invalid" failure) to a distinct `INVALID_BALANCE`, restoring the architecture's stated guarantee that `code` is a stable, unambiguous client-branchable discriminant.
  - `src/db/index.ts` no longer exports the raw `pgClient`; it exports a narrow `closeDb(): Promise<void>` instead, so `src/db/index.ts` remains the only place that knows how the connection is structured and torn down — `scripts/seed.ts` calls `closeDb()` rather than reaching into a raw client handle.
  - Added `findExistingUsernames(usernames: string[]): Promise<Set<string>>` to `src/lib/users.ts` (one batched `inArray` query) and switched `scripts/seed.ts` to call it once before the loop instead of `findByUsername()` once per candidate — N sequential round-trips collapsed to 1.
  - Updated `tests/unit/lib/users.test.ts`'s two validation tests to expect `INVALID_BALANCE`. Re-ran full regression: 52 unit + 19 integration tests pass; manually verified `SEED_ACCOUNT_COUNT=Infinity` (falls back to 10, no hang), `SEED_ACCOUNT_COUNT=3.7` and `SEED_BALANCE_CENTS=-500` (both now rejected fail-fast with a clear config error, exit 1, zero DB writes), and a normal create + idempotent re-run still complete correctly and exit cleanly.
