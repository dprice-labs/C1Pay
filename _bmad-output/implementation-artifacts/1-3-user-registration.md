---
baseline_commit: e86f77417cdc972303c4577a80e1cb7adefcd36c
---

# Story 1.3: User Registration

Status: review

## Story

As a new user,
I want to register an account with a unique username and password,
so that I can access the application with a starting balance.

## Acceptance Criteria

1. **Given** the `/register` page, **When** a user submits a valid username, password, and matching confirm password, **Then** `POST /api/auth/register` is called and on success the user is redirected to `/login`

2. **Given** the `/register` page, **When** the password and confirm password fields do not match, **Then** a client-side validation error is shown before submission and the form is not submitted

3. **Given** `POST /api/auth/register` receives a valid username and password, **When** executed, **Then** `createUser()` in `src/lib/users.ts` creates the user in the database with `balance_cents` of `100000` ($1,000.00)

4. **Given** a registration request, **When** `createUser()` runs, **Then** the password is hashed with bcryptjs at work factor 12 — plaintext password is never stored or logged

5. **Given** a registration request with a username that already exists, **When** executed, **Then** it returns `409 { "error": "Username already taken", "code": "USERNAME_TAKEN" }`

6. **Given** a registration request with missing or empty username or password, **When** Zod validation runs, **Then** it returns `400 { "error": "Validation failed", "code": "VALIDATION_ERROR" }`

7. **Given** a unit test for `createUser()`, **When** run, **Then** it verifies correct bcrypt hashing without a real database

8. **Given** an integration test for registration, **When** run, **Then** it verifies a user is created in the real database with a hashed password and `balance_cents = 100000`

_Note: confirm password is UI-only — `POST /api/auth/register` receives a single `password` field; the match check is client-side only._

## Tasks / Subtasks

- [x] Task 1: Install new dependencies (AC: #3, #4, #6)
  - [x] `npm install bcryptjs zod --legacy-peer-deps`
  - [x] `npm install -D @types/bcryptjs --legacy-peer-deps`

- [x] Task 2: Create `src/lib/schemas.ts` with `registerSchema` (AC: #6)
  - [x] Define `registerSchema` as `z.object({ username: z.string().min(1), password: z.string().min(1) })`
  - [x] Export `registerSchema` and its inferred type `RegisterInput`

- [x] Task 3: Create `src/lib/users.ts` with `createUser()` (AC: #3, #4, #5)
  - [x] Import `bcrypt` from `bcryptjs`, `db` from `@/db/index`, `users` from `@/db/schema/users`
  - [x] Import `AppError` from `@/lib/errors` and `createLogger` from `@/lib/logger`
  - [x] Hash password: `await bcrypt.hash(password, 12)` — work factor 12 is non-negotiable
  - [x] Insert with `balanceCents: 100000` (business rule, not DB default) via `.returning()`
  - [x] Catch Postgres duplicate key errors → throw `AppError('Username already taken', 'USERNAME_TAKEN', 409)`
  - [x] Return the created `User`

- [x] Task 4: Create `src/app/api/auth/register/route.ts` (AC: #3, #5, #6)
  - [x] Parse body, validate with `registerSchema.safeParse()`, return 400 on failure
  - [x] Call `createUser(username, password)`, catch `AppError` and return its status + `{ error, code }`
  - [x] Return `201` with the created user on success

- [x] Task 5: Create registration UI (AC: #1, #2)
  - [x] Create `src/app/(auth)/register/page.tsx` — Server Component shell rendering title and `<RegisterForm />`
  - [x] Create `src/app/(auth)/register/RegisterForm.tsx` — `'use client'` component
    - [x] Fields: username, password, confirm password
    - [x] Client-side validation: confirm password match before `fetch` (not sent to server)
    - [x] Submit: `POST /api/auth/register` with `{ username, password }` only
    - [x] On `201`: redirect to `/login` via `router.push('/login')`
    - [x] On `409` `USERNAME_TAKEN`: show inline error "Username already taken"
    - [x] On `400` `VALIDATION_ERROR`: show inline error "Username and password are required"
    - [x] Use semantic HTML: `<form>`, `<label>`, `<input>`, `<button>` — no `div` for interactive elements
    - [x] Keyboard-operable: tab order, visible focus indicator, no `outline: none`

- [x] Task 6: Write unit test `tests/unit/lib/users.test.ts` (AC: #7)
  - [x] Mock `@/db/index` with `vi.mock` to eliminate real DB
  - [x] Spy on `bcrypt.hash` and verify it is called with `(plaintext, 12)`
  - [x] Verify inserted `passwordHash` is NOT the plaintext password
  - [x] Verify `balanceCents` is `100000`
  - [x] Verify duplicate key error from mock DB → throws `AppError` with code `USERNAME_TAKEN`

- [x] Task 7: Write integration test `tests/integration/auth.test.ts` (AC: #8)
  - [x] Insert a user via `createUser()` against the real database
  - [x] Verify the row exists with a bcrypt hash (not plaintext) for `password_hash`
  - [x] Verify `balance_cents = 100000`
  - [x] Verify calling `createUser()` with the same username throws `USERNAME_TAKEN`
  - [x] Clean up in `afterEach` with try/catch (pattern from `db-schema.test.ts`)
  - [x] Tear down postgres client in `afterAll`: `await globalThis._pgClient?.end()`
  - [x] Run `npm run test:integration` — must pass

### Review Findings

#### Decision Needed

- [ ] [Review][Decision] Password length bounds undefined — `z.string().min(1)` accepts single-char passwords and has no max; bcrypt silently truncates inputs >72 bytes (a 100-char password authenticates with its first 72 chars) — decide minimum (e.g. 8) and enforce max 72 [src/lib/schemas.ts:5]
- [ ] [Review][Decision] Username logged on every registration — `log.info(\`User created: ${username}\`)` writes every new username to logs; decide: keep for audit trail (and sanitize against log injection) or remove [src/lib/users.ts:17]

#### Patches

- [ ] [Review][Patch] Unhandled `request.json()` SyntaxError crashes route on malformed/empty body [src/app/api/auth/register/route.ts:6]
- [ ] [Review][Patch] `createUser` missing guard on `.returning()` result — can silently return `undefined`, causing 500 in route handler [src/lib/users.ts:13-16]
- [ ] [Review][Patch] Duplicate-key detection uses fragile string regex instead of stable Postgres error code `23505` [src/lib/users.ts:21-25]
- [ ] [Review][Patch] Whitespace-only username (e.g. `"   "`) passes Zod validation and persists to DB [src/lib/schemas.ts:4]
- [ ] [Review][Patch] `res.json()` called unconditionally on non-ok response — throws on non-JSON error body (e.g. HTML 500 page), silently leaving no user feedback [src/app/(auth)/register/RegisterForm.tsx:36]
- [ ] [Review][Patch] `globalThis._pgClient` not reset to `undefined` after `.end()` — second test suite reuses the terminated client [tests/integration/auth.test.ts]
- [ ] [Review][Patch] `noValidate` + no pre-fetch empty-field guard — empty username/password bypass the confirm-password check and are sent to the server [src/app/(auth)/register/RegisterForm.tsx]
- [ ] [Review][Patch] Enter key triggers double-submit — `if (isLoading) return` missing at `handleSubmit` entry [src/app/(auth)/register/RegisterForm.tsx]
- [ ] [Review][Patch] WCAG: error paragraph missing `aria-invalid`/`aria-describedby` on inputs; alert region conditionally unmounts preventing same-error re-announcement [src/app/(auth)/register/RegisterForm.tsx:84]
- [ ] [Review][Patch] Unexpected DB errors silently re-thrown without logging — lose the stack trace on pool exhaustion or connection failures [src/lib/users.ts:27-28]

#### Deferred

- [x] [Review][Defer] No rate limiting on `/api/auth/register` — DoS/abuse vector via bcrypt CPU cost; infrastructure-level, out of scope for this story [src/app/api/auth/register/route.ts]
- [x] [Review][Defer] `bcrypt.hash` runs before DB duplicate check — maximizes CPU cost on duplicate-username flood; fixing with pre-check introduces TOCTOU; DB constraint is the correct guard [src/lib/users.ts:11]
- [x] [Review][Defer] `vitest.config.ts` `loadEnv(mode, cwd, '')` loads all `.env.local` vars including any production secrets — deliberate fix for test env; standard pattern; reassess if staging secrets appear in local `.env.local` [vitest.config.ts:10]
- [x] [Review][Defer] No username character restrictions (NUL bytes, control chars, RTL override) — theoretical spoofing/injection risk; product decision about allowed characters [src/lib/schemas.ts:4]
- [x] [Review][Defer] Plaintext password persists in React state if navigation is interrupted — component unmount clears state; theoretical risk only; no route guards exist yet [src/app/(auth)/register/RegisterForm.tsx]

## Dev Notes

### Packages to install

```bash
npm install bcryptjs zod --legacy-peer-deps
npm install -D @types/bcryptjs --legacy-peer-deps
```

**`--legacy-peer-deps` is required** on this project due to a pre-existing peer dependency conflict between `@playwright/test@1.61.0-alpha` and `next@16.2.6`. This was established in Story 1.2 and applies to ALL `npm install` commands in this project.

**Why `bcryptjs` over `bcrypt`:** Pure JavaScript, zero native build dependencies — same rationale as the architecture decision for `postgres` over `pg`. Runs identically on any machine without node-gyp build tooling.

**Why `zod`:** Architecture-mandated Zod for all route handler input validation. Dual-purpose: runtime validation + TypeScript type inference from the same schema (one source of truth).

---

### `src/lib/schemas.ts` (NEW)

```typescript
import { z } from 'zod'

export const registerSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export type RegisterInput = z.infer<typeof registerSchema>
```

This file will grow with `loginSchema`, `sendMoneySchema`, etc. in future stories. For this story, only `registerSchema` is added. Do NOT add schemas for other stories now.

---

### `src/lib/users.ts` (NEW)

```typescript
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import type { User } from '@/db/schema/users'

const log = createLogger('users')

export async function createUser(username: string, password: string): Promise<User> {
  const passwordHash = await bcrypt.hash(password, 12)
  try {
    const [user] = await db
      .insert(users)
      .values({ username, passwordHash, balanceCents: 100000 })
      .returning()
    log.info(`User created: ${username}`)
    return user
  } catch (error) {
    if (error instanceof Error && /duplicate key|unique constraint/i.test(error.message)) {
      throw new AppError('Username already taken', 'USERNAME_TAKEN', 409)
    }
    throw error
  }
}
```

**Critical implementation details:**

| Detail | Requirement |
|--------|-------------|
| `bcrypt.hash(password, 12)` | Work factor 12 is mandatory (NFR4). Never log or pass `password` anywhere after this call. |
| `balanceCents: 100000` | Business rule: $1,000.00 starting balance. The DB schema default is `0` — the service layer applies `100000`. Do not change the schema default. |
| `.returning()` | Returns the full inserted row. Drizzle PostgreSQL `.returning()` returns an array; destructure to `[user]`. |
| Duplicate key detection | Postgres throws on the `idx_users_username` unique index. The error message contains "duplicate key" — match case-insensitively. |
| `createLogger('users')` | Use the bound logger from Story 1.1. Never use `console.log`. |

**Do NOT add to this file in Story 1.3:**
- `findByUsername()` — Story 1.4 needs it; add it then
- `getUserById()` — future story
- Any password comparison logic — that belongs in `src/lib/auth.ts` (Story 1.4)

---

### `src/app/api/auth/register/route.ts` (NEW)

```typescript
import { registerSchema } from '@/lib/schemas'
import { createUser } from '@/lib/users'
import { AppError } from '@/lib/errors'
import { errorResponse } from '@/lib/errors'

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }
  try {
    const user = await createUser(parsed.data.username, parsed.data.password)
    return Response.json({ id: user.id, username: user.username }, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.status)
    }
    return errorResponse('Unexpected error', 'INTERNAL_ERROR', 500)
  }
}
```

**Route handler pattern (from architecture):**
- Parse → Zod validate → call service → return response
- No business logic in the route handler itself
- `errorResponse` is from `@/lib/errors` (Story 1.1) — always use it for error responses
- **Do NOT expose** `password_hash` or `balance_cents` in the response — return only `{ id, username }`

**HTTP status codes:**
| Outcome | Status | Code |
|---------|--------|------|
| Success | 201 | — |
| Empty/invalid fields | 400 | `VALIDATION_ERROR` |
| Duplicate username | 409 | `USERNAME_TAKEN` |
| Unexpected | 500 | `INTERNAL_ERROR` |

---

### `src/app/(auth)/register/page.tsx` (NEW — Server Component)

```typescript
import RegisterForm from './RegisterForm'

export default function RegisterPage() {
  return (
    <main>
      <h1>Create account</h1>
      <RegisterForm />
    </main>
  )
}
```

This is a Server Component (no `'use client'`). It renders the page title and delegates the interactive form to `RegisterForm.tsx`. The `(auth)` route group has no layout yet — that's added later if needed.

---

### `src/app/(auth)/register/RegisterForm.tsx` (NEW — Client Component)

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Client-side only: confirm password match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        router.push('/login')
        return
      }

      const data = await res.json()
      if (data.code === 'USERNAME_TAKEN') {
        setError('Username already taken')
      } else if (data.code === 'VALIDATION_ERROR') {
        setError('Username and password are required')
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      <div>
        <label htmlFor="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </div>
      {error && <p role="alert">{error}</p>}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
```

**Accessibility requirements (WCAG AA + CLAUDE.md):**
- Semantic HTML: `<form>`, `<label htmlFor>`, `<input id>` — explicit label association via `htmlFor`/`id` pairing
- Error output uses `role="alert"` — announces to screen readers on mount
- Button uses `type="submit"` — triggers Enter key submission naturally
- All inputs have `id` matching their `<label htmlFor>` — required for keyboard/screen reader accessibility
- `autoComplete` attributes help password managers and reduce friction
- `disabled` state on the button prevents double-submit during loading
- Tab order is implicit and correct: username → password → confirm → button
- Do NOT add `outline: none` to any focusable element

**Confirm password field:**
- Client-side only: checked in `handleSubmit` before `fetch`
- Server `POST /api/auth/register` receives `{ username, password }` only — no `confirmPassword`

**Router:**
- Import `useRouter` from `next/navigation` (App Router), NOT from `next/router` (Pages Router)

---

### Unit test: `tests/unit/lib/users.test.ts` (NEW)

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as bcrypt from 'bcryptjs'

// vi.mock is hoisted — these run before imports below
const mockValues = vi.fn()
vi.mock('@/db/index', () => ({
  db: {
    insert: () => ({ values: mockValues }),
  },
}))

// Import AFTER mock declarations
import { createUser } from '@/lib/users'

const MOCK_USER = {
  id: 1,
  username: 'alice',
  passwordHash: 'bcrypt-hash',
  balanceCents: 100000,
  createdAt: new Date(),
}

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValues.mockResolvedValue([MOCK_USER])
  })

  it('hashes the password with bcrypt at work factor 12', async () => {
    const hashSpy = vi.spyOn(bcrypt, 'hash')
    await createUser('alice', 'mypassword')
    expect(hashSpy).toHaveBeenCalledWith('mypassword', 12)
  })

  it('never passes plaintext password to db.insert', async () => {
    await createUser('alice', 'mypassword')
    const inserted = mockValues.mock.calls[0][0]
    expect(inserted.passwordHash).not.toBe('mypassword')
  })

  it('sets balanceCents to 100000', async () => {
    await createUser('alice', 'pass')
    const inserted = mockValues.mock.calls[0][0]
    expect(inserted.balanceCents).toBe(100000)
  })

  it('throws AppError USERNAME_TAKEN on duplicate username', async () => {
    mockValues.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint')
    )
    await expect(createUser('alice', 'pass')).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
      status: 409,
    })
  })
})
```

**Vitest mock notes:**
- `vi.mock('@/db/index', factory)` is automatically hoisted by Vitest even if written after imports — the factory runs first
- `mockValues` is declared before `vi.mock` using `vi.fn()` so the factory closure captures it correctly
- `vi.spyOn(bcrypt, 'hash')` works because `bcryptjs` is CommonJS and `bcrypt.hash` is an enumerable property on the default export object
- Clear mocks in `beforeEach` to prevent test bleed

---

### Integration test: `tests/integration/auth.test.ts` (NEW)

```typescript
import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { createUser } from '@/lib/users'

const TEST_USERNAME = '__integration_test_auth__'

afterAll(async () => {
  await globalThis._pgClient?.end()
})

afterEach(async () => {
  try {
    await db.delete(users).where(eq(users.username, TEST_USERNAME))
  } catch {
    // cleanup best-effort
  }
})

describe('createUser', () => {
  it('persists a user with hashed password and balance_cents = 100000', async () => {
    await createUser(TEST_USERNAME, 'testpassword')

    const [row] = await db.select().from(users).where(eq(users.username, TEST_USERNAME))

    expect(row).toBeDefined()
    expect(row.balanceCents).toBe(100000)
    expect(row.passwordHash).not.toBe('testpassword')
    expect(await bcrypt.compare('testpassword', row.passwordHash)).toBe(true)
  })

  it('throws USERNAME_TAKEN when username already exists', async () => {
    await createUser(TEST_USERNAME, 'firstpassword')
    await expect(createUser(TEST_USERNAME, 'secondpassword')).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
    })
  })
})
```

**Integration test setup:**
- `DATABASE_URL` must be set in `.env` (or `.env.local`) — loaded automatically by Vitest/Vite env
- Migrations must already be applied (`npm run db:migrate`)
- Uses collision-resistant test username prefix `__integration_test_auth__` to avoid conflicts with `db-schema.test.ts`'s `__integration_test_schema__` constant
- `afterAll` tears down the postgres connection — required to prevent Vitest hanging on open handles (pattern from Story 1.2 review finding)
- `afterEach` cleanup wrapped in try/catch — pattern established in Story 1.2 review finding

---

### File structure after this story

```
src/
├── app/
│   ├── (auth)/
│   │   └── register/
│   │       ├── page.tsx          ← NEW: Server Component
│   │       └── RegisterForm.tsx  ← NEW: 'use client'
│   └── api/
│       └── auth/
│           └── register/
│               └── route.ts      ← NEW: POST handler
├── lib/
│   ├── errors.ts                 ← EXISTING (Story 1.1)
│   ├── logger.ts                 ← EXISTING (Story 1.1)
│   ├── users.ts                  ← NEW: createUser()
│   └── schemas.ts                ← NEW: registerSchema
tests/
├── unit/
│   └── lib/
│       └── users.test.ts         ← NEW
└── integration/
    ├── db-schema.test.ts         ← EXISTING (Story 1.2)
    └── auth.test.ts              ← NEW
```

**Do NOT create in this story:**
- `src/lib/auth.ts` — Story 1.4 (signJwt, verifyJwt, getAuthUser, verifyPassword)
- `src/app/(auth)/login/` — Story 1.4
- `src/middleware.ts` — Story 1.5
- `findByUsername()` or `getUserById()` in `users.ts` — Story 1.4
- `loginSchema` or any other schemas in `schemas.ts` — future stories

---

### Architecture compliance checklist

- [ ] Business logic (`bcrypt.hash`, `balanceCents: 100000`, duplicate detection) is in `src/lib/users.ts` only — NOT in the route handler
- [ ] Route handler contains parse → validate → call service → return response, nothing else
- [ ] `errorResponse()` used for all error returns — never inline `Response.json({ error: ... })`
- [ ] `AppError` thrown by service, caught by route handler — consistent error propagation
- [ ] Plaintext password never logged, never returned in any response
- [ ] `balanceCents: 100000` set in `createUser()`, NOT in DB schema (schema default remains `0`)
- [ ] `createLogger('users')` used in `users.ts` — no `console.log`
- [ ] Route handler returns `{ id, username }` only — never `password_hash`, `balance_cents`
- [ ] `registerSchema` only validates `username` and `password` — no `confirmPassword` (that's UI-only)
- [ ] `router.push` imported from `next/navigation` — not `next/router`
- [ ] `(auth)` route group path is `src/app/(auth)/register/` — parentheses in folder name, not URL

---

### Anti-patterns (never do)

- `await bcrypt.hash(password, 10)` — work factor must be 12 (NFR4)
- `console.log(password)` or passing password to logger — never log plaintext
- Putting `bcrypt.hash()` in the route handler — hashing is service-layer business logic
- `import { useRouter } from 'next/router'` — this is App Router; use `next/navigation`
- Validating `confirmPassword` on the server — it's UI-only per the epics note
- Using `db.insert()` directly in the route handler — all DB access through `src/lib/`
- `balance_cents: 0` when inserting — must be `100000` (business rule)

---

### Previous story learnings (from Story 1.2)

- **`--legacy-peer-deps` required for ALL npm installs** — pre-existing Playwright/Next.js peer dep conflict. Every `npm install` in this project needs this flag.
- **Vitest `@` alias works in tests** — `@/db/index` and `@/lib/users` resolve correctly via the `vitest.config.ts` path alias (`@` → `./src`).
- **`afterAll` connection teardown is mandatory** — `await globalThis._pgClient?.end()` in all integration test files to prevent Vitest hanging after test suite completion.
- **`afterEach` cleanup must be wrapped in try/catch** — orphan rows from failed tests must not break subsequent tests; cleanup is best-effort.
- **Integration tests use real DB only** — do not mock `db` in integration tests. Migrations must be pre-applied.
- **`createLogger('context')` pattern** — use the bound logger factory from Story 1.1's `createLogger` export. More ergonomic than `logger.info('context', '...')` at every call site.
- **`.env` is loaded (not `.env.local`)** — Vitest/drizzle-kit loads `.env`. The dev agent installed Postgres.app at `/Applications/Postgres.app`, not Homebrew.
- **`npm run test:integration` uses `--passWithNoTests`** — a new test file will automatically be picked up; no script changes needed.

### References

- [Source: epics.md#Story 1.3] — acceptance criteria and scope boundary
- [Source: architecture.md#Authentication & Security] — bcryptjs work factor 12, httpOnly cookie decision
- [Source: architecture.md#Service layer] — createUser() signature pattern, service boundary rule
- [Source: architecture.md#Route handlers] — parse → validate → call service → return; use getAuthUser() pattern
- [Source: architecture.md#Naming Patterns] — registerSchema, RegisterInput type naming conventions
- [Source: architecture.md#Format Patterns] — HTTP status code table (201 create, 400 validation, 409 conflict)
- [Source: architecture.md#Complete Project Directory Structure] — (auth) route group, api/auth/register/route.ts path
- [Source: architecture.md#Enforcement Guidelines] — "Put business logic in src/lib/ — not in route handlers"
- [Source: architecture.md#Anti-patterns] — "Validation only on client side — server must always re-validate"
- [Source: 1-2-database-foundation.md#Dev Agent Record] — --legacy-peer-deps requirement, .env loading, afterAll/afterEach patterns

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- `vi.spyOn(bcrypt, 'hash')` fails on ESM modules in Vitest 4.x — resolved by mocking `bcryptjs` at module level with `vi.mock` and `vi.hoisted` for the mock variable declarations.
- `vi.mock` factory closures require `vi.hoisted()` for variable access since mock factories are hoisted before variable initialization.
- Drizzle ORM wraps Postgres errors in `DrizzleQueryError`; the original `PostgresError` is in `.cause`. Updated error detection in `createUser()` to check both `error.message` and `error.cause.message`.
- Vitest in test mode does not load `.env.local` by default (Vite only loads it in dev/production modes). Fixed by adding `env: loadEnv(mode, cwd, '')` in `vitest.config.ts` using `loadEnv` from `vite`.
- Updated `tests/integration/db-schema.test.ts` (Story 1.2 test) to match Drizzle's `DrizzleQueryError` wrapping — checked `cause.message` instead of top-level `message`.

### Completion Notes List

- Installed `bcryptjs@^3.0.3`, `zod@^4.4.3`, `@types/bcryptjs` with `--legacy-peer-deps` (required project-wide).
- Created `src/lib/schemas.ts` — `registerSchema` with `username` and `password` fields; `RegisterInput` type.
- Created `src/lib/users.ts` — `createUser()` hashes with bcrypt work factor 12, inserts with `balanceCents: 100000`, throws `AppError(USERNAME_TAKEN, 409)` on duplicate.
- Created `src/app/api/auth/register/route.ts` — parses body, validates with Zod, delegates to `createUser()`, returns `{ id, username }` on 201.
- Created `src/app/(auth)/register/page.tsx` — Server Component shell.
- Created `src/app/(auth)/register/RegisterForm.tsx` — Client Component with semantic HTML, WCAG-compliant labels, `role="alert"` error output, confirm-password client-side only check.
- Created `tests/unit/lib/users.test.ts` — 4 tests: bcrypt work factor, no plaintext in DB, balanceCents=100000, USERNAME_TAKEN on duplicate.
- Created `tests/integration/auth.test.ts` — 2 tests: hashed password persisted, USERNAME_TAKEN on duplicate.
- All 9 tests (6 unit + 3 integration) pass. No lint errors in new files.

### File List

- `src/lib/schemas.ts` (NEW)
- `src/lib/users.ts` (NEW)
- `src/app/api/auth/register/route.ts` (NEW)
- `src/app/(auth)/register/page.tsx` (NEW)
- `src/app/(auth)/register/RegisterForm.tsx` (NEW)
- `tests/unit/lib/users.test.ts` (NEW)
- `tests/integration/auth.test.ts` (NEW)
- `vitest.config.ts` (MODIFIED — added `loadEnv` for `.env.local` loading in test mode)
- `tests/integration/db-schema.test.ts` (MODIFIED — updated error match to handle `DrizzleQueryError` wrapping)
- `package.json` (MODIFIED — added bcryptjs, zod, @types/bcryptjs)
- `package-lock.json` (MODIFIED)

## Change Log

- 2026-06-03: Implemented Story 1.3 — user registration endpoint, service layer, and UI. Added bcryptjs/zod dependencies. Fixed vitest env loading for `.env.local`. Fixed Drizzle error wrapping in duplicate-key detection and db-schema integration test.
