---
baseline_commit: 39ce4ed
---

# Story 2.1: Protected Layout & Zustand Foundation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want Zustand stores initialized with server-fetched data and a client wrapper that mounts the SSE hook,
So that all protected pages share a single source of truth for balance, pending request count, and auth state.

## Acceptance Criteria

1. **Given** `src/store/auth.ts` exists, **When** imported, **Then** it exports `useAuthStore` with `{ user, setUser, clearUser }` state and actions

2. **Given** `src/store/balance.ts` exists, **When** imported, **Then** it exports `useBalanceStore` with `{ balanceCents, setBalance }` state and actions

3. **Given** `src/store/requests.ts` exists, **When** imported, **Then** it exports `useRequestStore` with `{ pendingCount, setPendingCount }` state and actions

4. **Given** `/(protected)/layout.tsx` is a Server Component, **When** rendered for an authenticated user, **Then** it calls `getAuthUser()` to extract the userId from the JWT cookie, fetches the user's `balance_cents` and pending request count directly from the database, and passes them as props to `Providers.tsx`

5. **Given** `Providers.tsx` is a `'use client'` component, **When** mounted, **Then** it seeds `useBalanceStore` with `initialBalance` and `useRequestStore` with `initialPendingCount` received from the layout

6. **Given** a unit test for each Zustand store, **When** run, **Then** it verifies each store's actions update state correctly without any database or network dependencies

## Tasks / Subtasks

- [x] Task 1: Install Zustand (AC: #1, #2, #3)
  - [x] Run `npm install zustand --legacy-peer-deps` (the `--legacy-peer-deps` flag is established for this project due to the `@playwright/test`/`next@16` peer-dep conflict — use it for any new install)
  - [x] Verify Zustand appears in `package.json` dependencies (not devDependencies)

- [x] Task 2: Create `src/store/auth.ts` (AC: #1)
  - [x] Define `AuthUser` type: `{ id: number; username: string }` (NOT the full DB `User` type — no password hash in client state)
  - [x] Export `useAuthStore` using Zustand's double-curried `create<AuthState>()(...)` pattern
  - [x] State shape: `{ user: AuthUser | null, setUser: (user: AuthUser) => void, clearUser: () => void }`
  - [x] Initial state: `user: null`
  - [x] Note: This store is created here but not seeded from the layout in this story. It will be populated by the SSE hook and/or post-login redirects in later stories. Creating it now (per the AC) ensures the store contract is in place before any consumer code references it.

- [x] Task 3: Create `src/store/balance.ts` (AC: #2)
  - [x] Export `useBalanceStore` using `create<BalanceState>()(...)` pattern
  - [x] State shape: `{ balanceCents: number, setBalance: (cents: number) => void }`
  - [x] Initial state: `balanceCents: 0` (will be overwritten by `Providers.tsx` on mount)

- [x] Task 4: Create `src/store/requests.ts` (AC: #3)
  - [x] Export `useRequestStore` using `create<RequestState>()(...)` pattern
  - [x] State shape: `{ pendingCount: number, setPendingCount: (count: number) => void }`
  - [x] Initial state: `pendingCount: 0`

- [x] Task 5: Add `getUserById` to `src/lib/users.ts` (AC: #4)
  - [x] The layout needs to fetch `balance_cents` by `userId`, but `src/lib/users.ts` currently only exports `findByUsername` and `createUser` — there is no `getUserById` yet
  - [x] Add: `export async function getUserById(id: number): Promise<User>` — query `db.select().from(users).where(eq(users.id, id))`, throw `AppError('User not found', 'USER_NOT_FOUND', 404)` if the result is empty, return `user`
  - [x] Use `createLogger('users')` (already in scope at the top of the file) — add a `log.warn` if user not found before throwing
  - [x] The service layer pattern is already established — this follows the same pattern as `findByUsername`

- [x] Task 6: Create `src/app/(protected)/Providers.tsx` (AC: #4, #5)
  - [x] `'use client'` directive at the top
  - [x] Props interface: `{ children: React.ReactNode; initialBalance: number; initialPendingCount: number }`
  - [x] Seed `useBalanceStore` and `useRequestStore` synchronously on first render using a `useRef(false)` guard:
    ```tsx
    const seeded = useRef(false)
    if (!seeded.current) {
      useBalanceStore.getState().setBalance(initialBalance)
      useRequestStore.getState().setPendingCount(initialPendingCount)
      seeded.current = true
    }
    ```
  - [x] This avoids the hydration flash of a `useEffect`-based approach (where stores briefly hold `0` before the effect runs), and is idempotent (the ref prevents re-seeding on re-renders)
  - [x] Return `<>{children}</>` — no DOM wrapper; the layout's `<header>` / `<main>` structure is already established
  - [x] **Do NOT import or mount `useSSE`** — that is Story 2.3's scope. Leave a comment: `// Story 2.3 will add: import { useSSE } from '@/hooks/use-sse' and mount it here`
  - [x] Imports needed: `useRef` from `react`, `useBalanceStore` from `@/store/balance`, `useRequestStore` from `@/store/requests`

- [x] Task 7: Extend `src/app/(protected)/layout.tsx` (AC: #4, #5)
  - [x] **Read the current file before editing** — it currently contains `await getAuthUser()` (as a void call), the `<header>` with `<LogoutButton>`, and `<main>{children}</main>` wrapped in a fragment. The return value of `getAuthUser()` was discarded.
  - [x] Change `await getAuthUser()` to `const { userId } = await getAuthUser()` to capture the userId
  - [x] Call `const user = await getUserById(userId)` to get `balance_cents` — import `getUserById` from `@/lib/users`
  - [x] Set `const initialPendingCount = 0` — the `payment_requests` table does not exist until Story 4.1. This value is hardcoded as a placeholder; Story 4.2 will replace it with a real DB query once the schema is in place.
  - [x] Wrap the existing `<header>` + `<main>` in `<Providers initialBalance={user.balanceCents} initialPendingCount={initialPendingCount}>` — import `Providers` from `./Providers`
  - [x] The `<header>` and `<main>` structure does NOT change — only the wrapping
  - [x] Final shape:
    ```tsx
    import { getAuthUser } from '@/lib/auth'
    import { getUserById } from '@/lib/users'
    import LogoutButton from './LogoutButton'
    import Providers from './Providers'

    export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
      const { userId } = await getAuthUser()
      const user = await getUserById(userId)
      const initialPendingCount = 0 // Story 4.2 wires the real query once payment_requests exists

      return (
        <Providers initialBalance={user.balanceCents} initialPendingCount={initialPendingCount}>
          <header className="flex items-center justify-between gap-4 border-b p-4">
            <span className="font-semibold">C1Pay</span>
            <LogoutButton />
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
        </Providers>
      )
    }
    ```

- [x] Task 8: Write unit tests for all three Zustand stores (AC: #6)
  - [x] Create `tests/unit/store/balance.test.ts`:
    - `beforeEach` resets state via `useBalanceStore.setState({ balanceCents: 0 })`
    - Test: `setBalance(5000)` → `useBalanceStore.getState().balanceCents === 5000`
    - Test: `setBalance(0)` → correctly stores 0 (edge case: zero balance is valid)
  - [x] Create `tests/unit/store/requests.test.ts`:
    - `beforeEach` resets via `useRequestStore.setState({ pendingCount: 0 })`
    - Test: `setPendingCount(3)` → `useRequestStore.getState().pendingCount === 3`
    - Test: `setPendingCount(0)` → count correctly clears to 0
  - [x] Create `tests/unit/store/auth.test.ts`:
    - `beforeEach` resets via `useAuthStore.setState({ user: null })`
    - Test: `setUser({ id: 1, username: 'alice' })` → `useAuthStore.getState().user` equals the set value
    - Test: `clearUser()` after `setUser(...)` → `useAuthStore.getState().user === null`
  - [x] No mocking needed — Zustand stores are plain JS objects; Vitest runs them without any browser/DB setup
  - [x] All three test files live in `tests/unit/store/` (not `tests/unit/lib/` — stores are not lib)

### Review Findings

- [x] [Review][Patch] Loose `== null` equality should be strict `=== null` — type is `true | null`, `==` silently matches `undefined` which can't occur here but is non-idiomatic and fragile under TypeScript strict mode [src/app/(protected)/Providers.tsx:17] — fixed
- [x] [Review][Defer] No error boundary for Server Component exceptions — unhandled `AppError` from `getAuthUser()` or `getUserById()` (e.g. DB unreachable, deleted user) produces a hard 500 with no redirect to `/login`; needs an `error.tsx` boundary under `(protected)/` — deferred, pre-existing architecture gap outside this story's scope
- [x] [Review][Defer] `getUserById` returns full `User` type including `passwordHash` — only `balanceCents` is forwarded to the client today, but a future refactor passing `user` directly would serialize the hash; consider returning a projected type — deferred, no active bug; revisit when adding user-facing profile data
- [x] [Review][Defer] No unit tests for `getUserById` service function — warn+throw behavior is untested directly (covered only by integration); not required by story ACs — deferred, good practice; add in a service-layer test pass

## Dev Notes

### Zustand v5 API — critical differences from v4

Architecture calls for Zustand but does not pin a version. **Install the latest stable Zustand (v5.x as of June 2026)**. Zustand v5 has a breaking API change from v4:

- **Use the double-curried `create<State>()(...)` form** — the middleware wrapper is required even without middleware in v5 for correct TypeScript inference:
  ```ts
  import { create } from 'zustand'
  
  interface BalanceState {
    balanceCents: number
    setBalance: (cents: number) => void
  }
  
  export const useBalanceStore = create<BalanceState>()((set) => ({
    balanceCents: 0,
    setBalance: (cents) => set({ balanceCents: cents }),
  }))
  ```
- **`useStore.getState()`** is the synchronous imperative accessor (used in Providers.tsx seeding and unit tests) — no hooks needed outside components
- **`useStore.setState({...})`** in tests — direct state override for test resets without calling actions

### Why seed synchronously (not in `useEffect`)

The balance displayed on the home screen (Story 2.2) reads from `useBalanceStore`. If `Providers.tsx` seeds via `useEffect`, there is a brief render where `balanceCents = 0` is in the store before the effect fires — components that mount and read the store immediately would briefly see `$0.00`. The `useRef` + synchronous-during-first-render pattern eliminates this flash without violating React's rules (we are not calling a hook imperatively; we are calling `getState()`, which is a plain function on the store object).

### `getUserById` does not exist yet — you must add it

`src/lib/users.ts` currently exports only `findByUsername` and `createUser`. The layout's data-fetch needs `getUserById(userId: number)`. Add it to `src/lib/users.ts` — it follows the exact same pattern as `findByUsername`:
```ts
export async function getUserById(id: number): Promise<User> {
  const [user] = await db.select().from(users).where(eq(users.id, id))
  if (!user) {
    log.warn(`getUserById: no user found for id=${id}`)
    throw new AppError('User not found', 'USER_NOT_FOUND', 404)
  }
  return user
}
```
`AppError`, `db`, `users` (schema), `eq`, `createLogger`/`log`, and `User` type are all already imported in `users.ts`. This is a pure addition — no existing code changes.

### `pendingCount = 0` is the correct placeholder

The `payment_requests` table does not exist until Story 4.1. Story 2.1's layout hardcodes `initialPendingCount = 0`. Story 4.2 ("Inbox & Pending Request Display") will replace this with a real DB query — at that point, the layout will call a `getPendingCount(userId)` service function. The `useRequestStore` is wired up now so that the SSE events from Story 2.3 (`REQUEST_RECEIVED`, `REQUEST_RESOLVED`) have somewhere to land, and Story 2.2 can display the badge (showing nothing when count is 0).

### `Providers.tsx` is designed for Story 2.3 extension

Story 2.3 will add the SSE hook. `Providers.tsx` should have a clearly marked comment where `useSSE` will be imported and mounted:
```tsx
// Story 2.3: import { useSSE } from '@/hooks/use-sse' and call useSSE() here
// This hook opens an EventSource to /api/sse and dispatches BALANCE_UPDATED /
// REQUEST_RECEIVED / REQUEST_RESOLVED events to the Zustand stores above.
```
This prevents Story 2.3 from having to reverse-engineer where to insert the hook call.

### The middleware deprecation warning — known, ignore

The dev server shows: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` This is a Next.js 16 deprecation notice about the file naming convention — it does not affect functionality and is out of scope for this story. Do not attempt to rename `middleware.ts` to address it.

### `db/index.ts` schema import — no change needed in this story

`src/db/index.ts` currently imports `* as schema from './schema/users'`. This is sufficient for `getUserById` since `src/lib/users.ts` imports the `users` table object and `db` client directly — it does not rely on the schema registry object on the Drizzle instance. The deferred-work note ("update to a barrel import when a second schema file is added") applies to Stories 3.1 and 4.1 when new schema files are created — not this story.

### Architecture boundary: service layer, not raw DB in the layout

The layout calls `getUserById(userId)` (service function in `src/lib/`) — it does NOT import from `src/db/` directly. Architecture boundary: "DB access only happens inside `src/lib/` functions — route handlers never import from `src/db/`". Server Components follow the same rule.

### Existing `(protected)/layout.tsx` shape (read before editing)

Current file (as of baseline commit `39ce4ed`):
```tsx
import { getAuthUser } from '@/lib/auth'
import LogoutButton from './LogoutButton'

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await getAuthUser()

  return (
    <>
      <header className="flex items-center justify-between gap-4 border-b p-4">
        <span className="font-semibold">C1Pay</span>
        <LogoutButton />
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4">{children}</main>
    </>
  )
}
```
Changes: (1) capture `userId` from `getAuthUser()`, (2) add `getUserById` call, (3) wrap return in `<Providers>`.

## Project Structure Notes

**Files to CREATE:**
- `src/store/auth.ts` — `useAuthStore`
- `src/store/balance.ts` — `useBalanceStore`
- `src/store/requests.ts` — `useRequestStore`
- `src/app/(protected)/Providers.tsx` — `'use client'` store-seeder
- `tests/unit/store/balance.test.ts`
- `tests/unit/store/requests.test.ts`
- `tests/unit/store/auth.test.ts`

**Files to MODIFY:**
- `src/lib/users.ts` — add `getUserById(id: number): Promise<User>`
- `src/app/(protected)/layout.tsx` — capture userId, fetch balance via getUserById, hardcode pendingCount=0, wrap children in `<Providers>`

**Files to NOT touch in this story:**
- `src/app/(protected)/page.tsx` — Story 2.2 overwrites this with the real home screen
- `src/middleware.ts` — no change
- `src/db/index.ts` — no schema addition needed until 3.1/4.1
- Any SSE files — Story 2.3 scope

**File structure after this story:**
```
src/
├── store/                              ← NEW directory
│   ├── auth.ts                         ← NEW: useAuthStore { user, setUser, clearUser }
│   ├── balance.ts                      ← NEW: useBalanceStore { balanceCents, setBalance }
│   └── requests.ts                     ← NEW: useRequestStore { pendingCount, setPendingCount }
├── app/
│   └── (protected)/
│       ├── layout.tsx                  ← MODIFIED: fetches balance, wraps in <Providers>
│       ├── Providers.tsx               ← NEW: 'use client', seeds balance + pendingCount stores
│       ├── LogoutButton.tsx            ← UNCHANGED
│       └── page.tsx                    ← UNCHANGED (Story 2.2 will overwrite)
├── lib/
│   └── users.ts                        ← MODIFIED: adds getUserById()
tests/
└── unit/
    └── store/                          ← NEW directory
        ├── auth.test.ts                ← NEW
        ├── balance.test.ts             ← NEW
        └── requests.test.ts            ← NEW
```

### References

- [Source: epics.md#Story 2.1] — acceptance criteria and scope (lines 343–362)
- [Source: epics.md#Epic 2] — epic goal: "After login, users see their current balance and pending request count. The SSE connection is live and the client state architecture is fully in place." (lines 335–340)
- [Source: architecture.md#Frontend Architecture — State management: Zustand] — store naming, double-curried create pattern, store domains (lines 220–226)
- [Source: architecture.md#Frontend Architecture — Rendering strategy: Server Components by default] — Providers.tsx is the 'use client' boundary for stores and SSE (lines 231–237)
- [Source: architecture.md#Clarifications Added During Validation] — explicit description of Providers.tsx pattern: "receives initial balance and pending count as props... seeds the Zustand stores... mounts useSSE" (lines 674–681)
- [Source: architecture.md#Project Structure] — `src/store/` directory, all three store file names, `src/app/(protected)/Providers.tsx` location (lines 547–549, 478)
- [Source: architecture.md#Zustand update rules] — use named actions, `getState()` for imperative access (lines 391–394)
- [Source: architecture.md#Service boundary] — layout calls service functions, not DB directly (lines 592–594)
- [Source: architecture.md#Naming Patterns — TypeScript/Code] — `use{Domain}Store` naming convention (line 301)
- [Source: architecture.md#Enforcement Guidelines] — no `console.log`, use `createLogger`; monetary values as integer cents (lines 427–442)
- [Source: 1-5-route-protection-and-logout.md#Dev Notes] — `(protected)/layout.tsx` is "deliberately minimal — no Zustand/SSE/data-fetching (Story 2.1's scope)" (line 58), Story 2.1 extends this file
- [Source: 1-5-route-protection-and-logout.md#Previous Story Intelligence] — `--legacy-peer-deps` flag required for all npm installs (line 167)
- [Source: deferred-work.md#code review of 1-2] — `db/index.ts` schema import update deferred to Stories 3.1/4.1 (line 14)
- [Source: src/lib/users.ts] — `createLogger`, `db`, `users`, `eq`, `AppError`, `User` already imported — `getUserById` fits cleanly
- [Source: src/app/(protected)/layout.tsx] — current shape, `getAuthUser()` return value was discarded (void call), needs destructuring

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- ESLint `react-hooks/refs` flagged `!seeded.current` during render. Refactored `Providers.tsx` to use `useRef<true | null>(null)` with `seeded.current == null` check — the lint rule's own suggested null-initialization pattern. Behavior is identical (runs once on mount), no hydration flash.

### Completion Notes List

- Installed Zustand v5.0.14 via `npm install zustand --legacy-peer-deps`. Appears in `dependencies` in `package.json`.
- Created `src/store/auth.ts`: exports `useAuthStore` with `{ user: AuthUser | null, setUser, clearUser }`. `AuthUser` is `{ id, username }` — no password hash. Uses double-curried `create<AuthState>()()` v5 pattern. Not seeded from layout (deferred to Story 2.3/post-login).
- Created `src/store/balance.ts`: exports `useBalanceStore` with `{ balanceCents: 0, setBalance }`.
- Created `src/store/requests.ts`: exports `useRequestStore` with `{ pendingCount: 0, setPendingCount }`.
- Added `getUserById(id: number): Promise<User>` to `src/lib/users.ts`: queries by id, `log.warn` + throws `AppError('User not found', 'USER_NOT_FOUND', 404)` if empty. Follows same pattern as `findByUsername`.
- Created `src/app/(protected)/Providers.tsx`: `'use client'`, seeds balance and request stores synchronously on first render via `useRef<true | null>(null)` guard. No DOM wrapper. Story 2.3 comment in place for `useSSE`.
- Extended `src/app/(protected)/layout.tsx`: destructures `userId` from `getAuthUser()`, calls `getUserById(userId)`, hardcodes `initialPendingCount = 0` (placeholder until Story 4.2), wraps children in `<Providers>`.
- Created 3 unit test files in `tests/unit/store/`: `auth.test.ts`, `balance.test.ts`, `requests.test.ts`. 6 tests total, all pass. No mocks needed — Zustand stores are plain JS objects.
- All 23 unit tests pass. ESLint clean on all changed files. TypeScript errors are pre-existing in `tests/unit/lib/users.test.ts` (unrelated).

### File List

- `src/store/auth.ts` (created)
- `src/store/balance.ts` (created)
- `src/store/requests.ts` (created)
- `src/app/(protected)/Providers.tsx` (created)
- `src/lib/users.ts` (modified — added `getUserById`)
- `src/app/(protected)/layout.tsx` (modified — captures userId, fetches balance, wraps in Providers)
- `tests/unit/store/auth.test.ts` (created)
- `tests/unit/store/balance.test.ts` (created)
- `tests/unit/store/requests.test.ts` (created)
- `package.json` (modified — zustand added to dependencies)
- `package-lock.json` (modified)

## Change Log

- Implemented Story 2.1 — Zustand v5 stores (auth, balance, requests), getUserById service, Providers client component, extended protected layout with server-side data fetch; 6 new unit tests (Date: 2026-06-09)
