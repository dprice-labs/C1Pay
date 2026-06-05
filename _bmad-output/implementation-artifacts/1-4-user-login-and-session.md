# Story 1.4: User Login & Session

Status: ready-for-dev

## Story

As a registered user,
I want to log in with my username and password,
so that I receive a session cookie granting access to protected routes.

## Acceptance Criteria

1. **Given** the `/login` page, **When** valid credentials are submitted, **Then** `POST /api/auth/login` is called and on success the user is redirected to `/` (home)

2. **Given** `POST /api/auth/login` receives valid credentials, **When** executed, **Then** it returns a `Set-Cookie` header setting an `HttpOnly`, `SameSite=Strict`, `Path=/` cookie containing a signed JWT

3. **Given** the JWT is issued, **Then** its payload contains only `userId`, it is signed with `JWT_SECRET` via `jose`, and carries a 1-day expiry

4. **Given** invalid credentials are submitted (wrong password OR unknown username), **When** executed, **Then** it returns `401 { "error": "Invalid username or password", "code": "INVALID_CREDENTIALS" }` — same response for both cases (no username enumeration)

5. **Given** a unit test for `src/lib/auth.ts`, **When** run, **Then** `signJwt()` produces a token with correct claims and `verifyJwt()` rejects expired or tampered tokens

6. **Given** an integration test for login, **When** run, **Then** it verifies credentials are validated against a real database user and `findByUsername()` + `verifyPassword()` behave correctly

## Tasks / Subtasks

- [ ] Task 1: Install `jose` dependency (AC: #2, #3)
  - [ ] `npm install jose --legacy-peer-deps`
  - [ ] `JWT_SECRET` must be present in `.env.local` (confirm `.env.example` already documents it from Story 1.1)

- [ ] Task 2: Add `loginSchema` to `src/lib/schemas.ts` (AC: #1, #4)
  - [ ] Append `loginSchema` and `LoginInput` export — do NOT touch `registerSchema`
  - [ ] `loginSchema`: `{ username: z.string().trim().min(1), password: z.string().min(1) }` — login does NOT enforce `min(8)` (that's registration-only; a short entry just fails credential check)

- [ ] Task 3: Add `findByUsername()` to `src/lib/users.ts` (AC: #4, #6)
  - [ ] Import `eq` from `drizzle-orm` (if not already imported)
  - [ ] Export `async function findByUsername(username: string): Promise<User | undefined>`
  - [ ] Body: `const [user] = await db.select().from(users).where(eq(users.username, username)); return user`
  - [ ] No logging needed; this is a read-only lookup

- [ ] Task 4: Create `src/lib/auth.ts` (AC: #2, #3, #5)
  - [ ] Export `COOKIE_NAME = 'session'` constant — used by login route, getAuthUser, and Story 1.5 middleware.ts
  - [ ] Export `async function signJwt(payload: { userId: number }): Promise<string>` — uses `SignJWT` from `jose`, HS256, 1-day expiry, `setIssuedAt()`
  - [ ] Export `async function verifyJwt(token: string): Promise<{ userId: number }>` — uses `jwtVerify` from `jose`; throws on invalid/expired
  - [ ] Export `async function getAuthUser(): Promise<{ userId: number }>` — reads cookie via `cookies()` from `next/headers` (async in Next.js 15+), calls `verifyJwt`; throws `AppError('Unauthorized', 'UNAUTHORIZED', 401)` if cookie missing or JWT invalid
  - [ ] Export `async function verifyPassword(password: string, hash: string): Promise<boolean>` — delegates to `bcrypt.compare` from `bcryptjs`
  - [ ] Do NOT export `hashPassword` — `bcrypt.hash` is only needed in `users.ts` and should stay there

- [ ] Task 5: Create `src/app/api/auth/login/route.ts` (AC: #1, #2, #3, #4)
  - [ ] Parse body with try/catch around `request.json()` — return 400 on `SyntaxError`
  - [ ] Validate with `loginSchema.safeParse()` — return 400 `VALIDATION_ERROR` on failure
  - [ ] Call `findByUsername(username)` — if `undefined`, return 401 `INVALID_CREDENTIALS` immediately
  - [ ] Call `verifyPassword(password, user.passwordHash)` — if `false`, return 401 `INVALID_CREDENTIALS`
  - [ ] Call `signJwt({ userId: user.id })` to produce the token
  - [ ] Use `NextResponse` from `next/server` to set cookie: `response.cookies.set({ name: COOKIE_NAME, value: token, httpOnly: true, sameSite: 'strict', path: '/', maxAge: 86400 })`
  - [ ] Return 200 with `{ userId: user.id }` — do NOT expose `username`, `passwordHash`, or `balanceCents`

- [ ] Task 6: Install shadcn components and create login UI (AC: #1)
  - [ ] Run `npx shadcn@latest docs button` and fetch the returned URL before writing any Button usage
  - [ ] Run `npx shadcn@latest docs input` and fetch the returned URL before writing any Input usage
  - [ ] Check for a form/field component: `npx shadcn@latest search field` — install if available, else use semantic HTML with explicit `htmlFor`/`id` pairing
  - [ ] Add components: `npx shadcn@latest add button input` (add `--legacy-peer-deps` if needed)
  - [ ] Create `src/app/(auth)/login/page.tsx` — Server Component, renders `<main>` + `<LoginForm />`
  - [ ] Create `src/app/(auth)/login/LoginForm.tsx` — `'use client'` component
    - [ ] Fields: username (type="text"), password (type="password") — use shadcn `Input` component
    - [ ] Submit: `POST /api/auth/login` with `{ username, password }`
    - [ ] Guard: `if (isLoading) return` at top of `handleSubmit`
    - [ ] Guard: empty username/password check before fetch (same pattern as RegisterForm)
    - [ ] On success (2xx): `router.push('/')` — redirects to home
    - [ ] On `401 INVALID_CREDENTIALS`: show "Invalid username or password"
    - [ ] On `400 VALIDATION_ERROR`: show "Username and password are required"
    - [ ] On non-JSON error body: show "Login failed. Please try again." (wrap `res.json()` in try/catch)
    - [ ] Use same ARIA pattern as RegisterForm: persistent `<p id="login-error" aria-live="assertive" aria-atomic="true" style={{ minHeight: '1em' }}>` for errors; `aria-invalid` + `aria-describedby` on the offending field
    - [ ] Submit button text: "Sign in" (loading: "Signing in…"), disabled while `isLoading`

- [ ] Task 7: Write unit tests `tests/unit/lib/auth.test.ts` (AC: #5)
  - [ ] `JWT_SECRET` is loaded from `.env.local` automatically via `vitest.config.ts`'s `loadEnv` — no mock needed
  - [ ] Test: `signJwt()` produces a token verifiable by `verifyJwt()` with correct `userId`
  - [ ] Test: `verifyJwt()` rejects a tampered token (corrupt last character of signature segment)
  - [ ] Test: `verifyJwt()` rejects an expired token (sign a token with `setExpirationTime` in the past using `jose` `SignJWT` directly in test)
  - [ ] Do NOT mock `jose` — test real signing/verification (no DB or network involved)

- [ ] Task 8: Extend integration tests `tests/integration/auth.test.ts` (AC: #6)
  - [ ] ADD a new `describe('findByUsername + verifyPassword')` block — do NOT remove or alter existing `describe('createUser', ...)` block
  - [ ] Reuse `TEST_USERNAME` constant and `afterEach` cleanup — already in the file
  - [ ] Test: `findByUsername()` returns the correct user for an existing username
  - [ ] Test: `findByUsername()` returns `undefined` for a non-existent username
  - [ ] Test: `verifyPassword()` returns `true` for the correct password
  - [ ] Test: `verifyPassword()` returns `false` for an incorrect password
  - [ ] Do NOT test `signJwt` or `verifyJwt` in integration tests — they have no DB dependency and belong in unit tests

## Dev Notes

### Dependency: `jose` NOT yet installed

`jose` is architecture-mandated for JWT but **not in `package.json` yet** — Story 1.4 installs it.

```bash
npm install jose --legacy-peer-deps
```

`--legacy-peer-deps` is **required project-wide** due to a pre-existing `@playwright/test` / `next@16` peer dep conflict (established Story 1.2). Every `npm install` in this project needs this flag.

`jose` uses the Web Crypto API — it runs in both the Next.js edge runtime (required for `middleware.ts` in Story 1.5) and the Node.js runtime. Do NOT use `jsonwebtoken` — it is Node.js-only and breaks in edge middleware.

---

### `src/lib/schemas.ts` (MODIFY — append only)

Current contents: `registerSchema` + `RegisterInput`. **Do not touch existing exports.**

Append:

```typescript
export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>
```

Login `password` uses `min(1)` only — the `min(8).max(72)` constraint is registration-only. An under-8-char password at login simply fails credential verification and returns `INVALID_CREDENTIALS`.

---

### `src/lib/users.ts` (MODIFY — append only)

Current exports: `createUser()`. Current imports already include `db` and `users` schema. **Add `eq` import if not present** (check: the file currently has no `eq` import).

Append:

```typescript
export async function findByUsername(username: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.username, username))
  return user
}
```

Import line to add at top: `import { eq } from 'drizzle-orm'`

---

### `src/lib/auth.ts` (NEW)

Full implementation:

```typescript
import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('auth')

export const COOKIE_NAME = 'session'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('[auth] JWT_SECRET is not set — add it to .env.local')
  return new TextEncoder().encode(secret)
}

export async function signJwt(payload: { userId: number }): Promise<string> {
  return new SignJWT(payload as Parameters<typeof SignJWT>[0])
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(getSecret())
}

export async function verifyJwt(token: string): Promise<{ userId: number }> {
  const { payload } = await jwtVerify(token, getSecret())
  return { userId: payload.userId as number }
}

export async function getAuthUser(): Promise<{ userId: number }> {
  const cookieStore = await cookies()  // Next.js 15+: cookies() is async
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) {
    throw new AppError('Unauthorized', 'UNAUTHORIZED', 401)
  }
  try {
    return await verifyJwt(token)
  } catch {
    throw new AppError('Unauthorized', 'UNAUTHORIZED', 401)
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

**Critical notes:**

| Point | Detail |
|-------|--------|
| `COOKIE_NAME` export | Story 1.5 (`middleware.ts`) imports this constant — define it once here |
| `jose` payload type | `SignJWT` constructor accepts `JWTPayload`; cast with `as Parameters<typeof SignJWT>[0]` or just `as Record<string, unknown>` |
| `cookies()` is async | In Next.js 15+, `await cookies()` is required — missing `await` causes a runtime error |
| `getAuthUser` catches `verifyJwt` throws | An expired or tampered JWT should be treated as unauthenticated, not as a 500 |
| No `hashPassword` export | `bcrypt.hash` is only called in `createUser()` in `users.ts`; exporting it from `auth.ts` would create two pathways (NFR9 violation) |
| No `console.log` | Use `createLogger('auth')` for any logging |

---

### `src/app/api/auth/login/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server'
import { loginSchema } from '@/lib/schemas'
import { findByUsername } from '@/lib/users'
import { signJwt, verifyPassword, COOKIE_NAME } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('login')

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  const { username, password } = parsed.data
  const user = await findByUsername(username)

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return errorResponse('Invalid username or password', 'INVALID_CREDENTIALS', 401)
  }

  const token = await signJwt({ userId: user.id })
  log.info(`Login successful for userId ${user.id}`)

  const response = NextResponse.json({ userId: user.id })
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 86400, // 1 day in seconds
  })
  return response
}
```

**Critical notes:**

| Point | Detail |
|-------|--------|
| `NextResponse` (not `Response`) | Only this route needs cookie-setting; `NextResponse.cookies.set()` is the cleanest API for it |
| `request.json()` wrapped in try/catch | Prevents unhandled `SyntaxError` on malformed body (learned from Story 1.3 review) |
| Same 401 for unknown user and wrong password | Enforces no username enumeration (AC #4); do NOT return different errors |
| Do NOT log `username` after credential check | Per Story 1.3 deferred finding — log `userId` only |
| `findByUsername` before `verifyPassword` | If user not found, short-circuit and return 401 immediately; do NOT call `verifyPassword` with a dummy hash (this app is not production; timing attack risk is noted in deferred work) |
| HTTP status for success | 200 (action returning a result), NOT 201 |

**HTTP status table for this route:**

| Outcome | Status | Code |
|---------|--------|------|
| Valid credentials | 200 | — |
| Empty fields / Zod failure | 400 | `VALIDATION_ERROR` |
| Wrong username or password | 401 | `INVALID_CREDENTIALS` |
| Unexpected error | 500 | `INTERNAL_ERROR` |

---

### Login UI — shadcn/ui Components Required

This is the first story to build UI after shadcn was installed. Per CLAUDE.md rules, **always use shadcn components** — never raw HTML markup for interactive elements.

**Before writing any component code:**

```bash
# Research components first
npx shadcn@latest docs button   # fetch the returned URL
npx shadcn@latest docs input    # fetch the returned URL

# Install components
npx shadcn@latest add button input
```

If a `field` or `form` component exists (`npx shadcn@latest search field`), install and use it for form layout. Per CLAUDE.md: use `FieldGroup` + `Field` — never raw `div` + `Label`.

Components live at `@/components/ui/<component>` after installation.

**CLAUDE.md quick-reference for this form:**

- Semantic tokens only: `bg-primary`, `text-muted-foreground` — never `bg-blue-500`
- Spacing: `flex` + `gap-*` — never `space-x-*` / `space-y-*`
- Icons (if any): `lucide-react`, `data-icon` on icons inside `<Button>`
- Conditional classes: `cn()` from `@/lib/utils`

---

### `src/app/(auth)/login/page.tsx` (NEW — Server Component)

```typescript
import LoginForm from './LoginForm'

export default function LoginPage() {
  return (
    <main>
      <h1>Sign in</h1>
      <LoginForm />
    </main>
  )
}
```

No `'use client'` — Server Component shell pattern (established in Story 1.3 with `register/page.tsx`).

---

### `src/app/(auth)/login/LoginForm.tsx` (NEW — Client Component)

Mirrors the structure of `RegisterForm.tsx` (Story 1.3) — reuse all patterns:
- `'use client'` directive
- `useRouter` from `next/navigation` (App Router)
- `isLoading` guard at top of `handleSubmit`
- Persistent error paragraph with `aria-live="assertive"` and `aria-atomic="true"`
- `aria-invalid` + `aria-describedby` on the field with an error
- `try/catch` around `res.json()` to handle non-JSON error bodies
- `style={{ minHeight: '1em' }}` on the error paragraph to prevent layout shift

**Key differences from RegisterForm:**
- Two fields only: `username` + `password` (no confirm password)
- `autoComplete="current-password"` on password (not `"new-password"`)
- On `401 INVALID_CREDENTIALS`: show "Invalid username or password"
- On `400 VALIDATION_ERROR`: show "Username and password are required"
- Submit button text: "Sign in" / "Signing in…"
- On success: `router.push('/')` (home, NOT `/login`)

**Sketch (adapt to shadcn components after reading docs):**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
// import shadcn components after installing

const ERROR_ID = 'login-error'

export default function LoginForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isLoading) return
    setError(null)

    if (!username.trim() || !password) {
      setError('Username and password are required')
      return
    }

    setIsLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (res.ok) {
        router.push('/')
        return
      }

      let data: { code?: string } = {}
      try { data = await res.json() } catch { /* non-JSON body */ }

      if (data.code === 'INVALID_CREDENTIALS') {
        setError('Invalid username or password')
      } else if (data.code === 'VALIDATION_ERROR') {
        setError('Username and password are required')
      } else {
        setError('Login failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Replace div+label+input with shadcn FieldGroup/Field/Input after reading docs */}
      <div>
        <label htmlFor="username">Username</label>
        <input id="username" type="text" value={username}
          onChange={e => setUsername(e.target.value)}
          autoComplete="username"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ERROR_ID : undefined}
        />
      </div>
      <div>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? ERROR_ID : undefined}
        />
      </div>
      <p id={ERROR_ID} aria-live="assertive" aria-atomic="true" style={{ minHeight: '1em' }}>
        {error ?? ''}
      </p>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
```

Replace `div`/`label`/`input`/`button` with their shadcn equivalents after reading the component docs.

---

### Unit tests: `tests/unit/lib/auth.test.ts` (NEW)

```typescript
import { describe, it, expect } from 'vitest'
import { SignJWT } from 'jose'
import { signJwt, verifyJwt } from '@/lib/auth'

// JWT_SECRET loaded from .env.local via vitest.config.ts loadEnv — no mocking needed

describe('signJwt + verifyJwt', () => {
  it('produces a token with correct userId claim', async () => {
    const token = await signJwt({ userId: 42 })
    const { userId } = await verifyJwt(token)
    expect(userId).toBe(42)
  })

  it('rejects a tampered token', async () => {
    const token = await signJwt({ userId: 1 })
    const parts = token.split('.')
    parts[2] = parts[2].slice(0, -2) + 'xx' // corrupt signature
    const tampered = parts.join('.')
    await expect(verifyJwt(tampered)).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const expiredToken = await new SignJWT({ userId: 1 } as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // expired 1 hour ago
      .sign(secret)
    await expect(verifyJwt(expiredToken)).rejects.toThrow()
  })
})
```

**Why no mocking:** `signJwt` and `verifyJwt` have no DB or network dependency — they are pure crypto operations. Test them directly against `JWT_SECRET` from `.env.local` (already loaded by `vitest.config.ts`).

---

### Integration tests: `tests/integration/auth.test.ts` (MODIFY — append only)

The file already contains `describe('createUser', ...)` from Story 1.3. **Do NOT remove or modify it.** Append a new describe block:

```typescript
import { findByUsername } from '@/lib/users'
import { verifyPassword } from '@/lib/auth'

// Add these imports at the top of the existing file

describe('findByUsername + verifyPassword', () => {
  it('returns the user for an existing username', async () => {
    await createUser(TEST_USERNAME, 'testpassword')
    const user = await findByUsername(TEST_USERNAME)
    expect(user).toBeDefined()
    expect(user!.username).toBe(TEST_USERNAME)
  })

  it('returns undefined for a non-existent username', async () => {
    const user = await findByUsername('__does_not_exist_1234__')
    expect(user).toBeUndefined()
  })

  it('verifyPassword returns true for the correct password', async () => {
    const user = await createUser(TEST_USERNAME, 'testpassword')
    expect(await verifyPassword('testpassword', user.passwordHash)).toBe(true)
  })

  it('verifyPassword returns false for an incorrect password', async () => {
    const user = await createUser(TEST_USERNAME, 'testpassword')
    expect(await verifyPassword('wrongpassword', user.passwordHash)).toBe(false)
  })
})
```

`TEST_USERNAME`, `afterEach`, and `afterAll` are already defined in the file — the new block inherits them automatically.

---

### File structure after this story

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   ├── page.tsx         ← NEW: Server Component shell
│   │   │   └── LoginForm.tsx    ← NEW: 'use client' form
│   │   └── register/            ← EXISTING (Story 1.3)
│   └── api/
│       └── auth/
│           ├── login/
│           │   └── route.ts     ← NEW: POST handler
│           └── register/        ← EXISTING (Story 1.3)
├── components/
│   └── ui/
│       ├── button.tsx           ← NEW: via npx shadcn@latest add
│       └── input.tsx            ← NEW: via npx shadcn@latest add
└── lib/
    ├── auth.ts                  ← NEW: signJwt, verifyJwt, getAuthUser, verifyPassword, COOKIE_NAME
    ├── schemas.ts               ← MODIFIED: append loginSchema
    └── users.ts                 ← MODIFIED: append findByUsername
tests/
├── unit/
│   └── lib/
│       └── auth.test.ts         ← NEW
└── integration/
    └── auth.test.ts             ← MODIFIED: append describe block
```

**Do NOT create in this story:**
- `src/middleware.ts` — Story 1.5
- `src/app/api/auth/logout/route.ts` — Story 1.5
- Any Zustand stores — Epic 2
- Any `(protected)/` routes or layout — Stories 1.5, Epic 2

---

### Architecture compliance checklist

- [ ] JWT payload contains only `userId` — no username, email, or roles (NFR6)
- [ ] JWT signed with `jose` (not `jsonwebtoken`) — edge runtime compatible for Story 1.5 middleware
- [ ] Cookie set as `HttpOnly`, `SameSite=Strict`, `Path=/` — never `localStorage` (arch anti-pattern)
- [ ] `COOKIE_NAME` constant exported from `auth.ts` — imported by login route AND Story 1.5 middleware (single source of truth)
- [ ] Same `INVALID_CREDENTIALS` error for unknown user and wrong password — no username enumeration
- [ ] `findByUsername()` in `users.ts` (not `auth.ts`) — auth concerns and user-lookup concerns are separated; `auth.ts` contains only crypto and session utilities
- [ ] `getAuthUser()` uses `await cookies()` from `next/headers` — Next.js 15+ requires `await`
- [ ] Login route returns 200 on success — not 201 (no resource created)
- [ ] `--legacy-peer-deps` on all npm installs
- [ ] shadcn components used for login form (not raw HTML markup)
- [ ] shadcn docs fetched before writing any component code

---

### Deferred (do not implement)

- Timing-based username enumeration: if the user is not found, skipping `bcrypt.compare` saves ~300ms — a timing difference that leaks username existence. For production this requires a constant-time dummy hash check. Deferred as out-of-scope for this training tool.
- Rate limiting on `POST /api/auth/login` — same concern as `/api/auth/register` (already deferred in Story 1.3 deferred-work.md).

---

### Previous story learnings (from Stories 1.2 and 1.3)

- **`--legacy-peer-deps` on ALL `npm install`** — Playwright/Next.js peer dep conflict. No exceptions.
- **`await cookies()` in Next.js 15+** — `cookies()` from `next/headers` returns a Promise; missing `await` causes a runtime error. This is new in Next.js 15.
- **`request.json()` try/catch** — Story 1.3 review found unhandled `SyntaxError` on malformed body. Wrap in try/catch.
- **`afterAll` + `afterEach` pattern in integration tests** — always include `await globalThis._pgClient?.end()` and try/catch cleanup (established Story 1.2).
- **`vi.mock` not needed for `auth.ts`** — `signJwt`/`verifyJwt` are pure crypto with no DB/network; test directly with real `JWT_SECRET`.
- **Drizzle error wrapping** — Story 1.3 found Postgres errors wrapped in `DrizzleQueryError`; use `.code ?? .cause?.code` for error code inspection (already in `createUser`).
- **`createLogger('context')` pattern** — bound logger factory; use `const log = createLogger('auth')` in `auth.ts`.
- **`(auth)` route group** — parentheses in folder name only, not in URL. Path is `src/app/(auth)/login/`.

### References

- [Source: epics.md#Story 1.4] — acceptance criteria and scope
- [Source: architecture.md#Authentication & Security] — `jose` rationale, httpOnly cookie, COOKIE_NAME shared constant
- [Source: architecture.md#Service layer] — `auth.ts` exports, `findByUsername` in `users.ts`
- [Source: architecture.md#Route handlers] — parse → validate → call service → return pattern
- [Source: architecture.md#Format Patterns] — HTTP status code table (200 for login success, 401 unauth)
- [Source: architecture.md#Enforcement Guidelines] — `getAuthUser()` in every protected route handler
- [Source: architecture.md#Anti-patterns] — never `localStorage` for JWT
- [Source: 1-3-user-registration.md#Dev Notes] — `--legacy-peer-deps`, `request.json()` guard, ARIA patterns
- [Source: CLAUDE.md] — shadcn components required, `FieldGroup`+`Field` for forms, semantic tokens

## Dev Agent Record

### Agent Model Used

_to be filled by dev agent_

### Debug Log References

### Completion Notes List

### File List
