---
baseline_commit: e86f77417cdc976303c4577a80e1cb7adefcd36c
---

# Story 1.2: Database Foundation

Status: done

## Story

As a developer,
I want a configured Drizzle ORM client with the users schema and migration workflow,
so that the database layer is ready for user data to be persisted in the next story.

## Acceptance Criteria

1. **Given** `src/db/index.ts` exists, **When** imported, **Then** it exports a singleton Drizzle client connected to `DATABASE_URL` — no other module instantiates a second client

2. **Given** `src/db/schema/users.ts` exists, **Then** it defines a `users` table with: `id` (serial PK), `username` (text, unique, not null), `password_hash` (text, not null), `balance_cents` (integer, not null, default 0), `created_at` (timestamp with timezone, default now())

3. **Given** `drizzle.config.ts` exists, **When** `npm run db:generate` is run, **Then** it produces a versioned SQL migration file in `src/db/migrations/`

4. **Given** a migration file exists, **When** `npm run db:migrate` is run, **Then** the `users` table is created in the PostgreSQL database

5. **Given** the migration is applied, **When** a duplicate username is inserted, **Then** the database enforces the unique constraint and rejects the insert

## Tasks / Subtasks

- [x] Task 1: Install database dependencies (AC: #1, #2)
  - [x] `npm install drizzle-orm postgres`
  - [x] `npm install -D drizzle-kit`

- [x] Task 2: Create `drizzle.config.ts` in project root and add npm scripts (AC: #3, #4)
  - [x] Configure `dialect: 'postgresql'`, `schema: './src/db/schema'`, `out: './src/db/migrations'`
  - [x] Wire `dbCredentials.url` to `process.env.DATABASE_URL!`
  - [x] Add `"db:generate": "drizzle-kit generate"` and `"db:migrate": "drizzle-kit migrate"` to `package.json` scripts

- [x] Task 3: Create `src/db/schema/users.ts` (AC: #2, #5)
  - [x] Define `users` table with all five columns from AC #2
  - [x] Use `uniqueIndex('idx_users_username')` — satisfies both the unique constraint (AC #5) and the named index that Story 3.2 search requires
  - [x] Export inferred TypeScript types: `User` and `NewUser`

- [x] Task 4: Create `src/db/index.ts` singleton client (AC: #1)
  - [x] Import from `drizzle-orm/postgres-js` and `postgres`
  - [x] Use global variable guard to prevent duplicate connections during Next.js hot-reload
  - [x] Throw at startup if `DATABASE_URL` is not set
  - [x] Export `db` as the sole Drizzle instance

- [x] Task 5: Run migration workflow (AC: #3, #4)
  - [x] Ensure PostgreSQL is running and `DATABASE_URL` is set in `.env.local`
  - [x] Run `npm run db:generate` — verify migration file appears in `src/db/migrations/`
  - [x] **Commit the generated migration file** (architecture requires it in source control)
  - [x] Run `npm run db:migrate` — verify `users` table is created

- [x] Task 6: Write integration test for unique constraint (AC: #5)
  - [x] Create `tests/integration/db-schema.test.ts`
  - [x] Insert two rows with the same username — second must throw
  - [x] Use `afterEach` to delete test rows (cleanup by username match)
  - [x] Run `npm run test:integration` — must pass

### Review Findings

- [x] [Review][Patch] Migration SQL missing trailing newline [`src/db/migrations/0000_cloudy_spacker_dave.sql:9`]
- [x] [Review][Patch] `.rejects.toThrow()` not scoped to constraint error — any error passes the test [`tests/integration/db-schema.test.ts:21-27`]
- [x] [Review][Patch] No postgres connection teardown after test suite — Vitest may hang on open handles [`tests/integration/db-schema.test.ts`]
- [x] [Review][Patch] `afterEach` cleanup not error-guarded — cleanup failure leaves orphan rows [`tests/integration/db-schema.test.ts:9-11`]
- [x] [Review][Patch] `drizzle.config.ts` DATABASE_URL uses non-null assertion with no runtime guard [`drizzle.config.ts:8`]
- [x] [Review][Defer] `balanceCents` integer ceiling concern (~$21M max) [`src/db/schema/users.ts:7`] — deferred, architectural decision
- [x] [Review][Defer] Single schema import in `db/index.ts` needs barrel when second schema added [`src/db/index.ts:3`] — deferred, pre-existing (Stories 3.1, 4.1)
- [x] [Review][Defer] No `db:seed`/`db:reset` scripts [`package.json`] — deferred, out of scope for Story 1.2
- [x] [Review][Defer] No `db.push` protection in drizzle.config.ts — deferred, defense-in-depth concern
- [x] [Review][Defer] `drizzle-kit` in devDependencies — `db:migrate` will fail in stripped production environments [`package.json:32`] — deferred, deployment concern
- [x] [Review][Defer] `postgres()` constructor error on malformed DATABASE_URL not handled [`src/db/index.ts:19`] — deferred, acceptable error propagation

## Dev Notes

### Packages to install

```bash
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

**Why `postgres` (postgres.js) over `pg`:**
- Pure TypeScript, zero native dependencies — same reasoning as `bcryptjs` over native `bcrypt` (already established in Story 1.1)
- Drizzle's recommended adapter for server-side Node.js PostgreSQL connections is `drizzle-orm/postgres-js`

### `drizzle.config.ts` (project root)

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

- `schema: './src/db/schema'` — directory glob: picks up all `.ts` files. When `transactions.ts` and `requests.ts` are added in Stories 3.1 and 4.1, no config change is needed.
- `out: './src/db/migrations'` — versioned SQL files are committed to source control per the architecture decision (migration files as schema history and teaching artifact).
- `dialect: 'postgresql'` — required field for drizzle-kit ≥ 0.21.

### `package.json` scripts to add

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "drizzle-kit migrate"
```

drizzle-kit loads `.env.local` automatically (it uses dotenv internally). No `dotenv-cli` wrapper is needed. If `drizzle-kit generate` errors with "DATABASE_URL not found", run: `export DATABASE_URL=$(grep DATABASE_URL .env.local | cut -d= -f2-)` as a workaround, or install `dotenv-cli` and prefix: `dotenv -e .env.local -- drizzle-kit generate`.

### `src/db/schema/users.ts`

```typescript
import { integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  balanceCents: integer('balance_cents').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_users_username').on(table.username),
])

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
```

**Critical column details:**

| Drizzle field | DB column | Notes |
|---|---|---|
| `passwordHash` | `password_hash` | Drizzle maps camelCase ↔ snake_case automatically |
| `balanceCents` | `balance_cents` | Default `0` in schema — `createUser()` (Story 1.3) sets `100000` (=$1,000.00) |
| `createdAt` | `created_at` | `withTimezone: true` is required by architecture; `notNull()` + `defaultNow()` — DB always populates it |

**`uniqueIndex('idx_users_username')`**: The named unique index follows the architecture naming convention (`idx_{table}_{column}`). This single declaration satisfies AC #5 (unique constraint enforcement) AND creates the exact index name Story 3.2's username search query references. Do not use the unnamed `.unique()` shorthand — the name matters.

**`balance_cents` default is `0`**: The $1,000.00 starting balance (`100000` cents) is a business rule owned by `createUser()` in Story 1.3. The schema default of `0` is correct — the service layer applies the business default, not the DB schema.

**`(table) => [...]` syntax**: This is the array-based extra config introduced in drizzle-orm 0.30+. Do not use the older object form `(table) => ({ idx: ... })` — it is deprecated.

### `src/db/index.ts`

```typescript
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/users'
import { logger } from '@/lib/logger'

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
```

**Why the global guard matters:** Next.js dev mode re-executes all module code on every file save (hot-reload). Each call to `postgres(connectionString)` opens a new connection pool. Without the guard, saving a file 20 times = 20 pools = PostgreSQL max_connections errors. The `globalThis._pgClient` persists across hot-reloads within the same Node.js process. In production there is no hot-reload, so the guard only applies in dev/test.

**`{ schema }` option:** Passing the schema enables Drizzle relational queries (`db.query.users.findMany()`). The standard query builder (`db.select().from(users)`) always works regardless. Include it now so the option is available for future stories.

**Updating `src/db/index.ts` when adding schemas (Stories 3.1, 4.1):** Replace the single schema import with a barrel or merged import:
```typescript
// Option A: barrel file src/db/schema/index.ts that re-exports all schemas (preferred)
import * as schema from './schema'
// Option B: merge inline
import * as usersSchema from './schema/users'
import * as txSchema from './schema/transactions'
export const db = drizzle(client, { schema: { ...usersSchema, ...txSchema } })
```
Create `src/db/schema/index.ts` as a barrel when the second schema file is added.

### Migration workflow

Prerequisite: PostgreSQL running locally with a database created for C1Pay (e.g., `createdb c1pay`). `.env.local` must contain:
```
DATABASE_URL=postgresql://user:password@localhost:5432/c1pay
```

```bash
# 1. Generate versioned SQL migration file
npm run db:generate
# → Creates src/db/migrations/0000_<descriptive_name>.sql
# → Also creates src/db/migrations/meta/ (drizzle-kit internal state — commit this too)

# 2. Apply migration to local database
npm run db:migrate
# → Applies unapplied migrations
# → Creates __drizzle_migrations table to track applied state

# 3. Verify (optional)
psql $DATABASE_URL -c "\d users"
# → Shows: id, username, password_hash, balance_cents, created_at columns
# → Shows idx_users_username index
```

**Commit everything generated in `src/db/migrations/`** — both the `.sql` file and the `meta/` directory. These are the schema history and are required for `drizzle-kit migrate` to work correctly.

### Integration test: `tests/integration/db-schema.test.ts`

```typescript
import { describe, it, expect, afterEach } from 'vitest'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { eq } from 'drizzle-orm'

const TEST_USERNAME = '__integration_test_schema__'

afterEach(async () => {
  await db.delete(users).where(eq(users.username, TEST_USERNAME))
})

describe('users schema', () => {
  it('enforces unique constraint on username', async () => {
    await db.insert(users).values({
      username: TEST_USERNAME,
      passwordHash: 'test-hash-1',
      balanceCents: 0,
    })

    await expect(
      db.insert(users).values({
        username: TEST_USERNAME,
        passwordHash: 'test-hash-2',
        balanceCents: 0,
      })
    ).rejects.toThrow()
  })
})
```

**Test database setup:**
- Vitest loads `.env.local` automatically (Vite env loading is built into Vitest). `DATABASE_URL` from `.env.local` is available without any extra config.
- The test database must already have migrations applied (`npm run db:migrate`) before running `npm run test:integration`.
- Using a collision-resistant test username (`__integration_test_schema__`) ensures `afterEach` cleanup is scoped and won't accidentally delete real data.
- Do **not** run migrations inside test setup — migrations are a prerequisite, not a test concern.

### File structure after this story

```
/                         (project root)
├── drizzle.config.ts     ← NEW
│
src/
└── db/
    ├── index.ts          ← NEW: singleton Drizzle client, global hot-reload guard
    ├── migrations/
    │   ├── 0000_*.sql    ← NEW: generated — COMMIT this
    │   └── meta/         ← NEW: drizzle-kit state — COMMIT this entire folder
    └── schema/
        └── users.ts      ← NEW: users table + User/NewUser types

tests/
└── integration/
    └── db-schema.test.ts ← NEW: unique constraint integration test
```

**Do NOT create in this story:**
- `src/db/schema/transactions.ts` — Story 3.1
- `src/db/schema/requests.ts` — Story 4.1
- `src/db/schema/index.ts` (barrel) — add when second schema file lands in Story 3.1
- `src/lib/users.ts` — Story 1.3 (owns `createUser`, `findByUsername`)
- `src/types/index.ts` — use `User` type exported from `src/db/schema/users.ts` directly until a centralised types file is warranted

### Architecture compliance checklist

- [ ] Monetary value `balance_cents` stored as `integer` (never `decimal`, never `float`) — AC #2, architecture integer cents invariant
- [ ] Single Drizzle client exported from `src/db/index.ts` only — no second client anywhere — AC #1
- [ ] Migration files committed to source control — architecture decision (migration-as-artifact)
- [ ] `uniqueIndex('idx_users_username')` uses the naming convention `idx_{table}_{column}` — architecture naming patterns
- [ ] No `db.push` — architecture requires versioned migration files, not `push`
- [ ] No `console.log` — `logger.info('db', '...')` used in `src/db/index.ts`
- [ ] `src/lib/users.ts` NOT created here — service layer boundary respected

### Anti-patterns (never do)

- `const db = drizzle(postgres(url))` anywhere outside `src/db/index.ts` — breaks the singleton constraint
- `npx drizzle-kit push` — bypasses versioned migrations; never use in this project
- `balance_cents: decimal(...)` or `balance_cents: real(...)` — must be integer
- Running `drizzle-kit migrate` in tests — migrations are environment setup, not test fixtures
- Route handlers importing from `src/db/` directly — they must call `src/lib/` service functions (enforced from Story 1.3 onward; the boundary is established now)

### Previous story learnings (from Story 1.1)

- **`--passWithNoTests` is already set:** `npm run test:integration` uses `--passWithNoTests` so adding the first real integration test file will automatically become part of the run — no script change needed.
- **Vitest path alias is working:** `@/db/index` resolves correctly in tests because `vitest.config.ts` maps `@` → `./src` (verified in Story 1.1).
- **ESLint `no-var` note:** The `declare global { var _pgClient: ... }` block requires `eslint-disable-next-line no-var`. This is an intentional, unavoidable exception — TypeScript ambient global declarations require `var`.
- **No `@testing-library/jest-dom` needed:** Vitest's native `expect` is used directly (established in Story 1.1 test patterns).
- **`console.log` ban:** `src/db/index.ts` must use `logger` from `@/lib/logger` — established anti-pattern from Story 1.1, enforced in all server-side modules.

### References

- [Source: epics.md#Story 1.2] — acceptance criteria and scope boundary
- [Source: architecture.md#Data Architecture] — singleton Drizzle client rationale, `drizzle-kit generate+migrate` decision, schema organisation in domain files
- [Source: architecture.md#Naming Patterns] — `idx_users_username` naming convention, column snake_case, table plural
- [Source: architecture.md#Format Patterns] — integer cents invariant (`balance_cents` as `integer`)
- [Source: architecture.md#Complete Project Directory Structure] — `src/db/` layout, `drizzle.config.ts` at project root
- [Source: architecture.md#Architectural Boundaries] — DB access only inside `src/lib/` service functions; route handlers never import `src/db/`
- [Source: architecture.md#Infrastructure & Deployment] — `DATABASE_URL` in `.env.local`, `.env.example` already committed in Story 1.1

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Used `--legacy-peer-deps` for npm installs due to pre-existing `@playwright/test` version conflict with `next@16.2.6`
- Postgres.app installed at `/Applications/Postgres.app` (not Homebrew); psql at `Contents/Versions/18/bin/psql`
- `.env` used instead of `.env.local`; drizzle-kit auto-loads it via dotenv

### Completion Notes List

- Installed `drizzle-orm@^0.45.2`, `postgres@^3.4.9`, `drizzle-kit@^0.31.10`
- `drizzle.config.ts` created at project root with `dialect: 'postgresql'`, schema dir glob, migrations output dir
- `db:generate` and `db:migrate` scripts added to `package.json`
- `src/db/schema/users.ts`: 5 columns (`id`, `username`, `password_hash`, `balance_cents`, `created_at`), `uniqueIndex('idx_users_username')`, `User`/`NewUser` types exported
- `src/db/index.ts`: singleton with `globalThis._pgClient` hot-reload guard, startup `DATABASE_URL` check, `logger.info` call, `{ schema }` passed to drizzle for relational queries
- Generated migration `0000_cloudy_spacker_dave.sql` verified — correct DDL including `idx_users_username` UNIQUE btree index
- Migration applied; `\d users` confirmed all 5 columns and indexes in PostgreSQL 18
- Integration test passes: unique constraint enforced, `afterEach` cleanup scoped to `__integration_test_schema__`
- All 3 unit tests and 1 integration test pass; no regressions

### File List

- `drizzle.config.ts`
- `package.json`
- `package-lock.json`
- `src/db/index.ts`
- `src/db/schema/users.ts`
- `src/db/migrations/0000_cloudy_spacker_dave.sql`
- `src/db/migrations/meta/_journal.json`
- `src/db/migrations/meta/0000_snapshot.json`
- `tests/integration/db-schema.test.ts`

## Change Log

- 2026-06-03: Implemented Story 1.2 — Drizzle ORM setup, users schema, migration workflow, singleton client, integration test (claude-sonnet-4-6)
