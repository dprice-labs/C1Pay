---
baseline_commit: 5e0ce02
---

# Story 1.5: Route Protection & Logout

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want all protected routes to enforce JWT authentication,
so that unauthenticated users are redirected to login and authenticated users can end their session cleanly.

## Acceptance Criteria

1. **Given** `middleware.ts` is configured, **When** an unauthenticated request hits any `/(protected)` route, **Then** the user is redirected to `/login`
2. **Given** `middleware.ts` is configured, **When** a request carries a valid JWT cookie, **Then** it passes through to the protected route without redirect
3. **Given** `middleware.ts` is configured, **When** a request carries an expired JWT cookie, **Then** the user is redirected to `/login`
4. **Given** a logout button in the protected layout, **When** clicked, **Then** `POST /api/auth/logout` is called, the JWT cookie is cleared (expired via `Set-Cookie`), and the user is redirected to `/login`
5. **Given** an unauthenticated request to any `/api/` route other than `/api/auth/*`, **Then** it returns `401 { "error": "Unauthorized", "code": "UNAUTHORIZED" }`
6. **Given** an e2e test for the full auth flow, **When** run, **Then** it covers: register → login → access protected page → logout → redirect to `/login` → protected page no longer accessible

## Tasks / Subtasks

- [x] Task 1: Create `src/middleware.ts` (AC: #1, #2, #3, #5)
  - [x] Read the JWT cookie from `request.cookies.get(COOKIE_NAME)` (NextRequest cookie API — NOT `cookies()` from `next/headers`, which is unavailable in middleware)
  - [x] Verify the token with `jose`'s `jwtVerify` directly (pinned to `algorithms: ['HS256']`, mirroring `verifyJwt`'s pattern in `src/lib/auth.ts`)
  - [x] If the path starts with `/api/` (and is NOT `/api/auth/*`) and auth fails → return a JSON 401 response `{ error: 'Unauthorized', code: 'UNAUTHORIZED' }` (status 401), matching `errorResponse`'s shape
  - [x] If the path is a page route and auth fails → `NextResponse.redirect(new URL('/login', request.url))`
  - [x] If auth succeeds → `NextResponse.next()`
  - [x] Configure `export const config = { matcher: [...] }` to cover all protected pages AND all non-auth `/api/*` routes, while excluding `/login`, `/register`, `/api/auth/*`, and Next.js internals/static assets

- [x] Task 2: Resolve the edge-runtime import question for `COOKIE_NAME` (AC: #1, #2, #3, #5)
  - [x] Try importing only `COOKIE_NAME` from `@/lib/auth` into `middleware.ts` first (architecture mandates "cookie name and JWT secret are shared constants — defined once, imported by both")
  - [x] Run `npm run dev`, hit a path matched by the middleware, and check the terminal/browser for edge-runtime warnings or errors (e.g. "A Node.js API is used... not supported in the Edge Runtime", referencing `bcryptjs` or `next/headers`)
  - [x] **If no warning appears:** keep the import — it's the architecturally-correct shared-constant approach
  - [ ] ~~**If a warning/error appears:** ... move `COOKIE_NAME` into `src/lib/auth-constants.ts` ...~~ — N/A, no warning appeared (see Completion Notes)
  - [x] Either way, do NOT import `getAuthUser`, `verifyPassword`, `signJwt`, or `verifyJwt` from `@/lib/auth` into `middleware.ts` — write a small inline edge-safe verification using `jose.jwtVerify` directly (mirrors but does not call `verifyJwt`, since that import would pull in the same Node-only chain)

- [x] Task 3: Create `src/app/api/auth/logout/route.ts` (AC: #4)
  - [x] `export async function POST()` — no request body to parse
  - [x] Build a `204` response and clear the cookie via `response.cookies.set({ name: COOKIE_NAME, value: '', httpOnly: true, sameSite: 'strict', path: '/', maxAge: 0, secure: process.env.NODE_ENV === 'production' })` — mirrors the `secure` flag pattern already patched into the login route
  - [x] Use `new NextResponse(null, { status: 204 })` as the base (architecture: "204 | Action with no return value (logout, cancel request)")
  - [x] No auth check needed inside the handler — middleware already guarantees a valid session reaches this route, and clearing an absent/invalid cookie is a safe no-op

- [x] Task 4: Replace `src/app/page.tsx` boilerplate with a minimal `(protected)/page.tsx` placeholder (AC: #4, #6)
  - [x] **Delete** `src/app/page.tsx` (the create-next-app boilerplate flagged in `deferred-work.md` from Story 1.1's review) — it currently resolves to route `/`
  - [x] **Create** `src/app/(protected)/page.tsx` — a minimal Server Component placeholder that ALSO resolves to route `/` (route groups don't appear in the URL). Two routes cannot resolve to the same path, so the old file must go before the new one is added
  - [x] Keep this placeholder deliberately minimal (e.g. an `<h1>` confirming the user is signed in) — Story 2.2 (Home Screen UI) will overwrite this same file with the real balance/CTA/inbox-badge layout. Do not attempt to build any of that here
  - [x] This also gives the e2e test (AC #6) a real protected page to navigate to and assert against

- [x] Task 5: Create `src/app/(protected)/layout.tsx` (AC: #4)
  - [x] Server Component (no `'use client'`) wrapping `{children}` with a minimal `<header>` containing the app name and a `<LogoutButton />`, plus a `<main>` for page content
  - [x] Call `await getAuthUser()` at the top as a defense-in-depth safety net (architecture: "`getAuthUser` throws a typed error if the cookie is missing or invalid as a safety net" — middleware is the primary guard, this is the secondary one already established as the pattern)
  - [x] Keep this layout minimal and presentational — do NOT add Zustand providers, SSE hooks, or data-fetching for balance/pending-count. That is **Story 2.1's** scope (`Providers.tsx`, `useBalanceStore`, `useRequestStore`); Story 2.1 will extend this exact file
  - [x] Use semantic HTML (`<header>`, `<main>`) and Tailwind `flex` + `gap-*` per CLAUDE.md — never `space-x-*`/`space-y-*`

- [x] Task 6: Create `src/app/(protected)/LogoutButton.tsx` — Client Component (AC: #4)
  - [x] `'use client'`, uses `useRouter` from `next/navigation` (App Router — same as `LoginForm`/`RegisterForm`)
  - [x] `isLoading` guard at top of the handler (same double-submit-prevention pattern as `LoginForm`)
  - [x] `onClick`: `await fetch('/api/auth/logout', { method: 'POST' })`, then `router.push('/login')` regardless of fetch outcome (a failed network call shouldn't trap the user in a session they can't leave — use `try`/`finally`)
  - [x] Use the shadcn `Button` component (`@/components/ui/button`) — run `npx shadcn@latest docs button` first per CLAUDE.md if any usage questions arise (the component is already installed; this is a reuse, not a new install)
  - [x] Button text: `"Sign out"` (loading: `"Signing out…"`), `disabled={isLoading}`
  - [x] No `aria-live` region needed here — logout either succeeds (navigates away) or the click is a no-op while loading; there's no error state to announce

- [x] Task 7: Write e2e test `tests/e2e/auth.spec.ts` (AC: #6)
  - [x] **NEW file** — `tests/e2e/` does not exist yet; this is the first Playwright spec in the project (architecture names it `auth.spec.ts`, "register → login → logout")
  - [x] Generate a unique username per run (e.g. `` `e2e_user_${Date.now()}` ``) — there is no test-data reset mechanism yet (Epic 5), so a colliding username would fail registration with `USERNAME_TAKEN`
  - [x] Flow to cover (single `test()` is fine — it's one continuous journey per AC #6):
    1. `page.goto('/register')`, fill `Username`/`Password`/`Confirm password` via `page.getByLabel(...)`, click "Create account" → expect redirect to `/login`
    2. Fill `Username`/`Password` on `/login`, click "Sign in" → expect redirect to `/` (the new protected placeholder page)
    3. Assert the protected page is visible (e.g. `page.getByRole('heading', { name: /signed in/i })`) — proves AC #2 (valid JWT passes through)
    4. Click "Sign out" → expect redirect to `/login`
    5. `page.goto('/')` directly → expect redirect back to `/login` — proves AC #1 (no cookie ⇒ redirect) and that logout actually cleared the session
  - [x] Use `page.getByLabel('Password', { exact: true })` on the register page to disambiguate "Password" from "Confirm password" (both match `/password/i`)
  - [x] Run via `npm run test:e2e` (already wired to `playwright test --pass-with-no-tests` in `package.json`; the `webServer` block in `playwright.config.ts` boots `next dev` automatically)

- [x] Task 8: Manually verify AC #3 (expired JWT) — no automated test required
  - [x] AC #3 (expired-cookie redirect) is impractical to cover in e2e without manipulating system time or minting a pre-expired token and injecting it as a cookie
  - [x] The unit-level equivalent is already covered: `tests/unit/lib/auth.test.ts` (Story 1.4) has a "rejects an expired token" test for `verifyJwt` — the same `jose` verification logic is what middleware will run
  - [ ] ~~If you want an explicit middleware-level check, add ONE unit test for `middleware.ts` ...~~ — skipped per the task's own guidance ("optional; do not block on it"); verified manually instead (see Completion Notes)

### Review Findings

- [x] [Review][Decision] AC #5 (401 JSON for unauthenticated `/api/*` requests) had no automated test coverage — only manually verified via `curl` during development. **Resolved:** add automated coverage now — added `tests/e2e/auth.spec.ts` test "unauthenticated request to a non-auth API route returns 401 JSON" using Playwright's `request` fixture against `GET /api/accounts`, asserting `401` + `{ error: 'Unauthorized', code: 'UNAUTHORIZED' }` [tests/e2e/auth.spec.ts:28]
- [x] [Review][Patch] Tighten the middleware `matcher` regex with path-segment anchors to prevent prefix collisions (e.g. a future `/login-history` or `/api/authorize` route silently bypassing auth) [src/middleware.ts:42] — fixed: each excluded segment now requires a trailing `/` or end-of-string boundary (and `favicon.ico`'s dot is now escaped)
- [x] [Review][Patch] Add logging to `middleware.ts` (mirroring `createLogger` use elsewhere) so that "no token", "invalid/expired token", and unexpected verification errors (e.g. missing `JWT_SECRET`) are distinguishable in production [src/middleware.ts:14-23] — fixed: added `createLogger('middleware')`; `jose` verification failures are logged at `warn` with their error code, unexpected errors (e.g. missing `JWT_SECRET`) are logged at `error` with the message, distinguishing config faults from normal auth failures
- [x] [Review][Patch] `logout` route logs `"Logout successful — session cookie cleared"` unconditionally, even when no session cookie was present (no-op logout) [src/app/api/auth/logout/route.ts:14] — fixed: route now checks for a present session cookie and logs a distinct "no session cookie present — cleared as a no-op" message when absent
- [x] [Review][Patch] `LogoutButton` never resets `isLoading` back to `false` — if `router.push('/login')` doesn't immediately unmount the component, the button remains permanently disabled [src/app/(protected)/LogoutButton.tsx:11-19] — fixed: added `setIsLoading(false)` in the `finally` block alongside the redirect
- [x] [Review][Defer] No `aria-live`/loading-state announcement during the brief logout transition [src/app/(protected)/LogoutButton.tsx:22-26] — deferred, pre-existing spec decision (Dev Notes explicitly call out "no aria-live region needed... there's no error state to announce"); revisit only if a future a11y audit (Epic 6) flags it
- [x] [Review][Defer] `e2e_user_${Date.now()}` username generation risks collisions if/when this suite grows to multiple parallel specs [tests/e2e/auth.spec.ts:4] — deferred, pre-existing pattern with no current collision risk (single test, nothing else runs in parallel against it yet); revisit when additional e2e specs are added

## Dev Notes

### `middleware.ts` — the central architectural decision for this story

- **Edge runtime, not Node.js.** `middleware.ts` runs at the edge (architecture line 192–195, 587). This is *why* `jose` was chosen over `jsonwebtoken` in Story 1.4 — `jose` uses Web Crypto API and works at the edge; `jsonwebtoken` does not.
- **`cookies()` from `next/headers` does NOT work in middleware** — that's a Server Component / Route Handler API. Middleware receives a `NextRequest` whose `.cookies.get(name)` returns `{ name, value } | undefined` directly (synchronous, no `await`). This is a different API surface than `getAuthUser()` uses — do not try to reuse `getAuthUser()` here.
- **Matcher must cover two distinct behaviors** (this is the crux of the story): page routes get an HTML redirect (AC #1, #3), but non-auth API routes get a JSON 401 (AC #5). A single matcher + in-function branch on `pathname.startsWith('/api/')` is the cleanest way to express this without two separate middleware-like configs (Next.js only supports one `middleware.ts`).
- A matcher along these lines satisfies both: `'/((?!_next/static|_next/image|favicon.ico|login|register|api/auth).*)'` — it matches `/`, `/(protected)/...` paths (route groups vanish from the URL, so `(protected)/page.tsx` is just `/`), and all `/api/*` except `/api/auth/*`, while excluding `/login`, `/register`, static assets, and `/api/auth/*`.

### Why `verifyJwt` from `auth.ts` should not be imported into middleware (even though it'd be more DRY)

`src/lib/auth.ts` currently has a single-file design that mixes edge-safe (`jose`-based `signJwt`/`verifyJwt`/`COOKIE_NAME`) and Node-only (`bcryptjs`-based `verifyPassword`, `next/headers`-based `getAuthUser`) concerns. Importing *anything* from that module into an edge-runtime file risks bundling the Node-only parts along with it — Next.js will emit a build/runtime warning (or hard error) about unsupported Node.js APIs in the Edge Runtime. Architecture line 588 explicitly separates these: "`src/lib/auth.ts` runs in Node.js runtime: bcryptjs hashing, JWT issuance". Task 2 walks through verifying this empirically and gives a fallback (extracting just `COOKIE_NAME` to a dependency-free module) if the warning appears. Either way, write a small inline `jose.jwtVerify` call in `middleware.ts` rather than importing `verifyJwt` — duplicating ~6 lines of crypto logic is far cheaper than an edge-bundle disaster.

### The `(protected)/page.tsx` route conflict — why deleting `src/app/page.tsx` is required, not optional

The architecture's target structure places the home page at `src/app/(protected)/page.tsx` (architecture line 482). Route groups — the parenthesized folder names — are stripped from the URL, so `(protected)/page.tsx` resolves to `/`, exactly the same path as the current `src/app/page.tsx` (still create-next-app boilerplate, flagged in `deferred-work.md` from Story 1.1's review: *"Replace in Epic 2"*). **Next.js cannot have two files resolve to the same route** — attempting to add `(protected)/page.tsx` while `app/page.tsx` still exists will fail the build with a duplicate-route error. So this story must delete the boilerplate file as a prerequisite, *not* as a stylistic improvement — and it conveniently also resolves that deferred-work item (the *redesign* of the home page, with balance/CTAs/badge, remains Story 2.2's job; this story's placeholder is intentionally minimal).

### `(protected)/layout.tsx` — minimal now, extended in Story 2.1

Story 2.1 ("Protected Layout & Zustand Foundation") is explicitly scoped to extend `(protected)/layout.tsx` into a Server Component that fetches `balance_cents`/pending-count and wraps children in `<Providers>` (Zustand + SSE). **This story creates that same file for the first time**, but only with the minimal shell needed to host AC #4's logout button: a `<header>` + `<LogoutButton>` + `<main>{children}</main>`. Do not pre-build any of Story 2.1's scope — adding `Providers.tsx`, Zustand stores, or SSE wiring here would be wasted work that Story 2.1's dev would have to reconcile against a story file that doesn't expect it to already exist.

### `getAuthUser()` in the layout is defense-in-depth, not redundant

Architecture line 408 states `getAuthUser` "throws a typed error if the cookie is missing or invalid as a safety net" even though middleware guarantees the cookie is present on protected routes. Calling it in `(protected)/layout.tsx` establishes this safety-net pattern at the point where Story 2.1 will need the `userId` anyway (to fetch `balance_cents` and pending-count) — so this story is also laying that groundwork correctly. If `getAuthUser()` throws here (it shouldn't, given middleware ran first), Next.js's error boundary will surface a 500 — acceptable, since reaching this state means middleware itself is broken, which is a deeper problem than this story can solve.

### Logout route: 204, no body, cookie-clear via `maxAge: 0`

- Architecture's HTTP table (line 364, 504) is explicit: logout returns `204` with no body — do not return `200 {}` or any JSON.
- Clearing an httpOnly cookie is done by re-issuing `Set-Cookie` with the same `name`/`path`/`sameSite` attributes as the original (so the browser matches and overwrites it) and `maxAge: 0` (or a past `expires`). `value: ''` is conventional but the expiry is what actually clears it.
- Match the `secure: process.env.NODE_ENV === 'production'` flag that was patched into the login route during its review (`src/app/api/auth/login/route.ts:53`) — using the same flag on both `Set-Cookie` calls keeps cookie attributes consistent across the session lifecycle.
- No `getAuthUser()` call needed in the handler body — by the time a request reaches this route, middleware has already verified the JWT (this route is not in the `/api/auth/*` exclusion's "skip auth" sense — wait, actually it IS under `/api/auth/*`. Re-read AC #5: unauthenticated requests to `/api/` routes *other than* `/api/auth/*` get 401. `/api/auth/logout` is itself under `/api/auth/*`, so middleware's matcher exclusion means **no auth check runs on this route at the middleware level either**. That's fine — logging out an already-logged-out session is an idempotent no-op (clearing an absent cookie does nothing harmful), so no explicit auth guard is needed inside the handler.

### LogoutButton — `try`/`finally`, not `try`/`catch`

Unlike `LoginForm`/`RegisterForm` (which show an error message on failure), logout has no meaningful error UX — if the network call fails, the user still wants to leave. Always navigate to `/login` in a `finally` block so a flaky network never traps the user in a session they're trying to end.

## Project Structure Notes

- **Files to CREATE:** `src/middleware.ts`, `src/app/api/auth/logout/route.ts`, `src/app/(protected)/layout.tsx`, `src/app/(protected)/LogoutButton.tsx`, `src/app/(protected)/page.tsx`, `tests/e2e/auth.spec.ts`
- **Files to DELETE:** `src/app/page.tsx` (boilerplate — superseded by `(protected)/page.tsx` at the same route `/`; see "route conflict" note above)
- **Files to MODIFY:** none — `auth.ts` stays as-is unless Task 2's edge-bundle check forces the `COOKIE_NAME` extraction (in which case: NEW `src/lib/auth-constants.ts`, MODIFY `src/lib/auth.ts` to re-export it)
- **Do NOT create in this story** (these are explicitly later stories' scope): `Providers.tsx`, any `src/store/*.ts` Zustand stores, `AmountDisplay.tsx`, any balance/inbox-count fetching — all Epic 2

### File structure after this story

```
src/
├── middleware.ts                        ← NEW
├── app/
│   ├── page.tsx                         ← DELETED (boilerplate; route conflict with below)
│   ├── (auth)/                          ← EXISTING (Stories 1.3, 1.4)
│   │   ├── login/
│   │   └── register/
│   ├── (protected)/                     ← NEW route group
│   │   ├── layout.tsx                   ← NEW: minimal shell (header + LogoutButton + main)
│   │   ├── LogoutButton.tsx             ← NEW: 'use client'
│   │   └── page.tsx                     ← NEW: minimal placeholder (Story 2.2 will overwrite)
│   └── api/
│       └── auth/
│           ├── login/                   ← EXISTING
│           ├── register/                ← EXISTING
│           └── logout/
│               └── route.ts             ← NEW: POST, 204, clears cookie
tests/
└── e2e/
    └── auth.spec.ts                     ← NEW: first Playwright spec in the project
```

## Previous Story Intelligence (from Story 1.4 — User Login & Session)

- **`COOKIE_NAME = 'session'`** is exported from `src/lib/auth.ts` specifically *for* this story's middleware to import (Story 1.4's dev notes literally say: "Story 1.5 (`middleware.ts`) imports this constant"). The shared-constant intent is real — Task 2 just walks through verifying it's safe to do directly.
- **`--legacy-peer-deps` on ALL `npm install`** — pre-existing `@playwright/test`/`next@16` peer-dep conflict (established Story 1.2). This story shouldn't need any new installs (middleware needs no new deps; `LogoutButton` reuses the already-installed `Button`), but if you do install anything, use the flag.
- **Cookie attributes must match exactly** between set and clear for the browser to overwrite rather than create a duplicate: `httpOnly`, `sameSite: 'strict'`, `path: '/'`, and the `secure` flag (`process.env.NODE_ENV === 'production'`, patched into login during Story 1.4's review — match it in logout too).
- **`createLogger('context')` pattern** for any logging — `const log = createLogger('logout')` etc. Never raw `console.log` (architecture anti-pattern, NFR-relevant).
- **`isLoading` guard + `aria-live` ARIA pattern** established in `LoginForm`/`RegisterForm` — reuse the loading-guard half for `LogoutButton` (the `aria-live` error-announcement half doesn't apply; logout has no error state to announce).
- **Route handler `request.json()` try/catch** doesn't apply here — `POST /api/auth/logout` takes no body.
- **Server Component shell + Client Component form** split (established `(auth)/login/page.tsx` + `LoginForm.tsx`) is mirrored here as `(protected)/layout.tsx` (Server) + `LogoutButton.tsx` (Client) — same separation rationale: Server Components can't use hooks (`useRouter`, `useState`).
- Story 1.4 review found and patched: missing `secure` cookie flag, unsafe `payload.userId` cast, unpinned JWT algorithm, missing error handling around auth calls. The current `src/lib/auth.ts` and login route (read during this story's research) already reflect all these patches — the code excerpts in this story's Dev Notes match the patched versions, not the originally-drafted ones.

## Git Intelligence Summary

Recent commits (`1003a02 feat: implement story 1.4`, `faac56e feat: refactor /register UI with shadcn components`) show the established pattern for each auth story: a `feat: implement story X.Y — <title>` commit containing route handler + UI + tests together, merged via PR. `--legacy-peer-deps` and shadcn component reuse (not reinstallation — `button`, `input`, `field`, `card` are already present) are consistent across both. No new shadcn components are anticipated for this story; `LogoutButton` reuses `Button` exactly as `LoginForm`/`RegisterForm` do.

## References

- [Source: epics.md#Story 1.5] — acceptance criteria and scope (lines 311–329)
- [Source: epics.md#Epic 1] — epic goal: "Users can register, log in, and log out securely. All routes are protected." (line 208)
- [Source: architecture.md#Authentication & Security, lines 192–195] — middleware route-protection decision and rationale
- [Source: architecture.md#Process Patterns, lines 405–408] — `getAuthUser()` safety-net pattern
- [Source: architecture.md#Format Patterns, line 364] — HTTP 204 for actions with no return value (logout, cancel)
- [Source: architecture.md#Project Structure, lines 467, 479–482, 503–504] — `middleware.ts`, `(protected)/` group, `(protected)/layout.tsx`, `(protected)/page.tsx`, `api/auth/logout/route.ts` target locations
- [Source: architecture.md#Architectural Boundaries, lines 587–589] — edge vs. Node.js runtime split between `middleware.ts` and `auth.ts`; shared `COOKIE_NAME`/secret constants
- [Source: architecture.md#Enforcement Guidelines / Anti-patterns, lines 427–442] — semantic tokens, `cn()`, `getAuthUser()` usage, no `console.log`
- [Source: 1-4-user-login-and-session.md#Dev Notes] — `COOKIE_NAME` export rationale ("Story 1.5 middleware.ts imports this constant"), cookie attribute patterns, `secure` flag patch
- [Source: 1-4-user-login-and-session.md#Review Findings] — `secure` flag patch, deferred "no logout/session invalidation — Story 1.5 scope" note
- [Source: deferred-work.md#code review of story-1.1] — `src/app/page.tsx` boilerplate flagged for replacement
- [Source: src/lib/auth.ts] — current (patched) `COOKIE_NAME`, `verifyJwt`, `getAuthUser` implementations read directly
- [Source: src/app/api/auth/login/route.ts] — current (patched) cookie-setting pattern with `secure` flag, read directly
- [Source: playwright.config.ts] — `testDir: './tests/e2e'`, `webServer` auto-boots `next dev`, `baseURL: 'http://localhost:3000'`
- [Source: CLAUDE.md] — semantic HTML, ARIA, shadcn component reuse, semantic Tailwind tokens

## Change Log

- 2026-06-08 — Implemented Story 1.5 (route protection & logout): `middleware.ts`, `POST /api/auth/logout`, `(protected)/{layout,page,LogoutButton}`, deleted boilerplate `app/page.tsx`, e2e `auth.spec.ts`. All ACs satisfied; status moved to `review`.
- 2026-06-08 — Code review follow-up: added an automated AC #5 e2e test (`tests/e2e/auth.spec.ts` — unauthenticated `GET /api/accounts` → `401 UNAUTHORIZED` JSON); anchored the `middleware.ts` matcher regex to path-segment boundaries to prevent prefix-collision auth bypasses; added `createLogger`-based logging to `middleware.ts` distinguishing rejected sessions from unexpected/config errors; fixed the `logout` route's audit log to reflect whether a session cookie was actually present; fixed `LogoutButton` to reset `isLoading` in its `finally` block. All 26 tests (17 unit + 7 integration + 2 e2e) pass; status moved to `done`.

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Ran `npm run dev`, hit `/` and a non-auth `/api/*` path with `curl` to confirm `middleware.ts` redirects (307 → `/login`) for pages and returns `401 { error: 'Unauthorized', code: 'UNAUTHORIZED' }` for APIs. No edge-runtime/Node.js-API warnings appeared in `.next/dev/logs/next-development.log` for the direct `COOKIE_NAME` import from `@/lib/auth` — only an unrelated Next.js 16 deprecation notice ("middleware" convention → "proxy"), which does not block functionality and is outside this story's scope (the story explicitly specifies `middleware.ts`/AC references).
- Manually verified AC #3 (expired JWT): minted an expired token with `jose`'s `SignJWT`/`setExpirationTime` (mirroring the Story 1.4 `auth.test.ts` pattern), sent it as the `session` cookie via `curl` — page route returned `307 → /login`, non-auth API route returned `401 UNAUTHORIZED`. Confirms the same `jwtVerify`/`algorithms: ['HS256']` logic already unit-tested in `tests/unit/lib/auth.test.ts` ("rejects an expired token") behaves correctly inside `middleware.ts`. Skipped the optional middleware-level unit test per Task 8's own guidance (non-trivial `NextRequest`/`NextResponse` mocking cost; "treat as optional; do not block on it").

### Completion Notes List

- **Task 2 outcome — `COOKIE_NAME` import is safe:** Importing `COOKIE_NAME` directly from `@/lib/auth` into `middleware.ts` produced no edge-runtime warnings or errors. Kept the direct import (architecturally correct shared-constant approach per the architecture doc); did not create `src/lib/auth-constants.ts`. `auth.ts` was left unmodified.
- **Middleware logic:** `hasValidSession()` reads `request.cookies.get(COOKIE_NAME)` and verifies with `jose.jwtVerify` pinned to `algorithms: ['HS256']` (mirrors but does not call `verifyJwt`, avoiding the Node-only bundle risk). Branches on `pathname.startsWith('/api/')` to return JSON 401 for APIs vs. redirect for pages; the `matcher` regex excludes `_next/static`, `_next/image`, `favicon.ico`, `login`, `register`, and `api/auth`.
- **Logout route:** `POST /api/auth/logout` returns `204` via `new NextResponse(null, { status: 204 })` and clears the `session` cookie with matching attributes (`httpOnly`, `sameSite: 'strict'`, `path: '/'`, `maxAge: 0`, `secure` flag mirroring the login route) so the browser overwrites rather than duplicates the cookie. No auth guard needed — `/api/auth/*` is excluded from the middleware matcher and clearing an absent cookie is a safe no-op.
- **Route conflict resolved:** Deleted the create-next-app boilerplate `src/app/page.tsx` and added `src/app/(protected)/page.tsx` (a minimal `<h1>You're signed in</h1>` Server Component) at the same `/` route — also closes the `deferred-work.md` item from Story 1.1's review. Story 2.2 will overwrite this placeholder.
- **Protected layout:** `src/app/(protected)/layout.tsx` is a Server Component calling `await getAuthUser()` as a defense-in-depth safety net, wrapping `{children}` in `<header>` (app name + `<LogoutButton />`) and `<main>`, using semantic HTML and `flex`/`gap-*`. Deliberately minimal — no Zustand/SSE/data-fetching (Story 2.1's scope).
- **LogoutButton:** Client Component using the shadcn `Button`, `isLoading` guard, and `try/finally` so `router.push('/login')` always runs regardless of fetch outcome — a flaky network never traps the user in a session.
- **E2E test:** `tests/e2e/auth.spec.ts` (first Playwright spec in the project) covers the full register → login → access protected page → logout → redirect → re-block journey with a unique `e2e_user_${Date.now()}` username, using `page.getByLabel('Password', { exact: true })` to disambiguate from "Confirm password". Passed on 2 separate runs (`npx playwright test`).
- **Verification:** `npm run test:unit` (17/17 passed), `npm run test:integration` (7/7 passed), `npx playwright test` (1/1 passed). `npm run lint` and `npx tsc --noEmit` show only pre-existing issues unrelated to this story (confirmed via `git stash` comparison: a rule-definition error in a `.claude/skills` template file, an unused eslint-disable in `src/db/index.ts`, and TS errors in `tests/unit/lib/users.test.ts`) — none touch files this story created or modified.

### File List

- **NEW:** `src/middleware.ts`
- **NEW:** `src/app/api/auth/logout/route.ts`
- **NEW:** `src/app/(protected)/layout.tsx`
- **NEW:** `src/app/(protected)/LogoutButton.tsx`
- **NEW:** `src/app/(protected)/page.tsx`
- **NEW:** `tests/e2e/auth.spec.ts`
- **DELETED:** `src/app/page.tsx`
