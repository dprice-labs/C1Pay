# Deferred Work

## Deferred from: code review of story-1.1 (2026-06-01)

- `globals.css` `body` hard-codes `Arial` while `layout.tsx` loads the Geist font and exposes `--font-geist-sans`; Geist is downloaded but never applied at the body level. Resolve when building the real UI (Epic 2 — Home Screen UI).
- `src/app/page.tsx` is create-next-app boilerplate: default marketing content and external links using `target="_blank"` with no "opens in new window" affordance. Replace in Epic 2; accessibility pass in Epic 6.
- No helper to turn an `AppError` into an `errorResponse` — `AppError` ({message, code, status}) and `errorResponse` ({error, code}) are parallel, unconnected shapes that invite drift. Add a bridge (e.g. `errorResponse(err: AppError)`) when route handlers begin using both (Epic 3+).
- Test tooling fragility: `@playwright/test` is pinned to date-stamped alpha `^1.61.0-alpha-2026-06-01` (non-reproducible if the tag rotates); `playwright.config.ts` `webServer` relies on the default 60s timeout for `next dev` cold start. Harden during CI setup.

## Deferred from: code review of 1-2-database-foundation (2026-06-03)

- `balanceCents` is stored as 32-bit `integer` (max ~$21M); if high-value accounts are ever needed, a `bigint` migration would be required. Architectural decision — revisit at scale.
- `src/db/index.ts` imports only `./schema/users`; when a second schema file is added (Stories 3.1, 4.1), update to a barrel import or merged object.
- No `db:seed` or `db:reset` scripts; a developer needs to read Drizzle docs to reset the local schema. Add in a later story.
- `drizzle.config.ts` has no protection against `drizzle-kit push`; consider `strict: true` or a pre-push hook as a guard (defense-in-depth, not blocking).
- `drizzle-kit` is in `devDependencies`; `npm run db:migrate` will fail in environments where dev deps are pruned. If migration-on-start is needed in production, move `drizzle-kit` to `dependencies` or use a custom migration runner.
- `postgres()` constructor error on malformed `DATABASE_URL` propagates as an untyped module-load exception; acceptable for the current project context.

## Deferred from: code review of 1-3-user-registration (2026-06-03)

- No rate limiting on `POST /api/auth/register` — each unauthenticated request burns ~300ms bcrypt CPU; infrastructure-level throttle needed; out of scope for this story.
- `bcrypt.hash` runs before DB duplicate check in `createUser()` — maximizes CPU cost on duplicate-username flood; the alternative (pre-check + hash) introduces TOCTOU; DB unique constraint is the correct guard; accept the tradeoff.
- `vitest.config.ts` uses `loadEnv(mode, cwd, '')` (empty prefix) loading all `.env.local` vars including potential production secrets into the Vitest process — deliberate fix for test env; standard Next.js/Vite pattern; reassess if staging secrets ever appear in developer `.env.local`.
- No username character restrictions (NUL bytes, control characters, RTL Unicode override) — theoretical spoofing/log injection risk; product decision about allowed charset; revisit when building admin or display surfaces.
- Plaintext password persists in React `useState` if navigation after successful registration is interrupted — component unmount clears state; no route guards exist yet to cause this; theoretical risk only.

## Deferred from: code review of 1-4-user-login-and-session (2026-06-05)

- No logout/session invalidation — JWTs are stateless and live for 24h; no server-side revocation exists. Explicit sign-out route is Story 1.5 scope.
- `loginSchema` has no `max()` on password — bcrypt silently truncates at 72 bytes; a large body passes Zod and calls bcrypt; body-size limit and rate limiting are already deferred infrastructure concerns.
- `isLoading` double-submit race — two programmatic `form.submit()` calls fired before the first `setIsLoading(true)` re-render can both pass the guard and fire concurrent fetches. Not triggerable by normal user interaction.
- `getAuthUser` untested — relies on `cookies()` from `next/headers` which requires the Next.js request context; unit testing requires runtime mocking infrastructure not yet set up.
- `findByUsername` case sensitivity — `eq(users.username, username)` is a case-sensitive exact match; username case normalisation is a product-level decision, not a bug introduced by this story.
- `getAuthUser` swallows all JWT errors identically without logging cause — expired, tampered, and wrong-algorithm tokens all become `UNAUTHORIZED 401` with no forensic log entry; observability improvement deferred.
- `router.push('/')` executes before browser confirms cookie write — inherent property of cookie-based SPA navigation; cookies are set in the response headers and flushed by the browser before the navigated page fires its first request in practice.

## Deferred from: code review of 1-3-user-registration patch review (2026-06-04)

- `bcrypt.hash` is called outside `createUser`'s `try/catch`; a bcrypt failure (e.g. OOM) escapes the catch block without logging — route handler outer catch still returns 500. Pre-existing; fix when hardening error observability.
- `db-schema.test.ts` missing `globalThis._pgClient = undefined` in `afterAll` — pre-existing asymmetry with the `auth.test.ts` fix; address in a test-cleanup pass.
- `log.error` in `createUser` includes `error.message`, which the Postgres driver may format with query values containing the username or other PII; requires driver-level investigation.

## Deferred from: code review of 2-1-protected-layout-and-zustand-foundation (2026-06-09)

- No error boundary under `src/app/(protected)/` — unhandled `AppError` from `getAuthUser()` or `getUserById()` (DB unreachable, deleted user replaying JWT) produces a hard 500 with no `/login` redirect; needs an `error.tsx` boundary.
- `getUserById` returns full `User` type including `passwordHash` — only `balanceCents` is used today; a future refactor passing `user` to the client could accidentally serialize the hash. Consider a projected return type when building user-facing profile data.
- No unit tests for `getUserById` service function — warn+throw path is untested in isolation; add when doing a service-layer test hardening pass.

## Deferred from: code review of 1-5-route-protection-and-logout (2026-06-08)

- No `aria-live`/loading-state announcement during the brief logout transition (`LogoutButton.tsx`) — pre-existing, deliberate spec decision (Dev Notes explicitly reasoned "no aria-live region needed... there's no error state to announce"); revisit only if a future a11y audit (Epic 6) flags the loading-state transition specifically.
- `e2e_user_${Date.now()}` username generation in `tests/e2e/auth.spec.ts` risks collisions once the e2e suite grows to multiple specs running in parallel — pre-existing pattern, no current collision risk with a single test; switch to a more collision-resistant generator (e.g. worker index + random suffix) when additional e2e specs are added.

## Deferred from: code review of 2-3-sse-connection-and-real-time-updates (2026-06-16)

- Single writer per user: a second tab silently evicts the first tab's SSE connection (`src/lib/sse-emitter.ts`). Architectural decision per Map<userId, writer> spec; closing the old writer on replace is already better than the spec pattern. Revisit if multi-tab support is required.
- `pendingCount` can drift if SSE events are missed during a connection drop — no server-authoritative count sent on reconnect. Dev Notes explicitly defer reconciliation to Story 4.5.
- No `aria-live` regions for real-time balance and inbox badge updates from SSE events. Deferred to Epic 6 (Accessibility).
- Concurrent `emit()` calls for the same `userId` are not serialized; `WritableStreamDefaultWriter` requires sequenced writes. Low risk given current app design; revisit in Epic 3 when `emit()` is actively called from transaction handlers.
- No SSE heartbeat/comment ping — reverse proxies (nginx, AWS ALB) will silently kill idle SSE connections after ~60 s. Infrastructure concern outside Story 2.3 scope.
- `REQUEST_RECEIVED` event payload (requestId, fromUsername, amountCents, note) is silently discarded by the hook listener. Dev Notes explicitly defer payload use to Story 4.5.
- `globalThis.__sseWriters` holds stale writer references after Next.js dev hot-reload until first `emit()` fails and triggers deregister. Dev-only concern; harmless in production.

## Deferred from: code review of 3-1-transactions-schema-and-atomic-send-service (2026-06-16)

- Stale in-memory balance write: `sendMoney` reads balance with `FOR UPDATE`, then writes `senderRow.balance_cents - amountCents` from application memory. Correct under PostgreSQL READ COMMITTED (FOR UPDATE blocks concurrent writers for the transaction's duration), but a SQL expression (`SET balance_cents = balance_cents - $amount`) would be unconditionally safe. Revisit in a service-hardening pass.
- No guard against recipient balance exceeding PostgreSQL INT4 max (~2.1B cents). DB rejects atomically but without a clean `AppError`. Unreachable at training-app scale; revisit if scale changes.
- `amountCents` has no upper bound check in `sendMoney`. Out of story scope; `INSUFFICIENT_BALANCE` implicitly constrains viable amounts.
- Multi-hop deadlock possible with 3+ users in a chain (A→B, B→C, C→A). `ORDER BY id` prevents pairwise deadlock only. Architectural decision acknowledged in story notes; not a concern at training-app scale.
- `note` field in `transactions` table has no length constraint. No story requirement for max length; address if note becomes a user-facing field with display constraints.
- Concurrent sends test asserts exactly 1 success / 1 failure — flaky under SERIALIZABLE isolation. PostgreSQL defaults to READ COMMITTED; test is stable in the current environment.
- `afterEach` cleanup in integration tests is non-atomic (three sequential deletes, no wrapping transaction). Consistent with existing project integration test patterns.

## Deferred from: code review of story-3.2 (2026-06-17)

- E2E (`tests/e2e/send-money.spec.ts`) asserts the optimistic client balance and never verifies server-side money movement (sender debit + recipient credit); `Date.now()` username suffix can collide across parallel Playwright workers. Test hardening.
- `src/app/api/users/search/route.ts:25` — search log line interpolates raw `q`; newlines/control chars can forge log entries. Low-severity logging hardening.
- `src/app/(protected)/send/page.tsx:216` — `parseDollarsToCents` rejects leading-dot input like `.50` (regex requires a leading digit). Minor UX.
- `src/lib/schemas.ts:41` — `sendMoneySchema.note` is not trimmed server-side; whitespace-only notes are storable via direct API calls. Low severity.
- `src/app/(protected)/send/page.tsx:295` — server `VALIDATION_ERROR` surfaces in the generic banner rather than inline on the field (AC #8 intent); largely unreachable because the client pre-validates the amount. Minor.

## Deferred from: code review of 3-3-real-time-recipient-balance-update (2026-06-18)

- **Multi-instance SSE delivery:** `src/lib/sse-emitter.ts` keys live writers in a per-process `globalThis.__sseWriters` Map. This is the documented architecture (SSE fan-out — in-memory emitter) and is correct on a single instance, but on a multi-instance / Fluid-Compute deployment the recipient's `/api/sse` connection and the sender's `POST /api/transactions` can land on different instances, so `emit()` finds no local writer and silently no-ops — the recipient's balance never updates live in production. Story 3.3 is the first feature whose correctness depends on cross-user delivery. Resolve with an external pub/sub fan-out (e.g. Postgres `LISTEN/NOTIFY` or Redis) or a sticky-routing guarantee when the app moves beyond single-instance. Extends the related 2.3 note ("single writer per user").
- **Sender's other tabs/devices go stale:** the emit is recipient-only by AC #1; the sender's debit is the optimistic client write in the tab that performed the POST (`send/page.tsx`). A second logged-in tab/device for the sender receives no `BALANCE_UPDATED` and shows the pre-send balance until reload. Acceptable per the Story 3.3 design ("do not add a sender emit"); revisit if multi-tab/-device consistency for the sender becomes a requirement (a sender emit, or a server-authoritative balance on SSE reconnect, would close it).

## Deferred from: code review of 3-3-real-time-recipient-balance-update (2026-06-22, re-review)

- **Integer-overflow guard on `recipientBalanceCents`** (`src/lib/transactions.ts:45`): `balance_cents + amountCents` is computed in JS with only a `> 0` lower guard; on INT4/`MAX_SAFE_INTEGER` overflow the emitted value can diverge from the DB-stored value. Already noted in the 3.1 review; re-confirmed. Unreachable at training-app scale.
- **Concurrent same-`userId` emit serialization + double-abort race** (`src/lib/sse-emitter.ts:43-59`): emits to the same user aren't serialized (extends the 2.3 deferred note), and the new write-timeout `abort()`/`deregister()` path can race a concurrent emit's `write()` on the same shared writer (double-abort, racing deregister). Low probability per user; revisit if multi-tab or higher-concurrency send patterns appear.
- **`useSSE` permanent close after 3 errors amplified by the reaper** (`src/hooks/use-sse.ts:34`): the hook deliberately closes the stream after 3 consecutive errors (documented intentional FR29 deviation to avoid hammering `/api/sse` with 401s). The new server-side abort-on-timeout makes repeated aborts more likely, which can trip this and stop all live updates with no recovery short of reload. Pre-existing decision; revisit alongside the reconnect-resync question.
- **Integration test depth for AC #2** (`tests/integration/transactions.test.ts`): the test proves the emit fired with the right cents but does not independently re-query the DB to prove the row was committed at emit time, and relies on one `read()` returning one full SSE frame. Negative (no-emit-on-rollback) path is covered at the unit level. Optional hardening.
- **e2e `waitForResponse` proves registration, not active pull** (`tests/e2e/realtime.spec.ts`): resolves on response headers (server-side `register()` + `: connected` flush), not on the browser's `EventSource` actively reading. The "deterministic" framing is slightly overstated; the final `toHaveText` auto-retry masks the gap. Not a defect; could flake on a very slow CI worker.
- **`aria-live` region nested inside the `<h1>` balance heading** (`src/app/(protected)/LiveBalance.tsx:31-41`): a polite `aria-atomic` live region that is itself the content of a heading can cause verbose/odd screen-reader announcements (whole-heading re-read on each update). Needs a manual SR check — flag for the Epic 6 accessibility audit.
- **No migration lock in `migrate.mjs`** (`src/db/migrate.mjs`): the custom runner has no advisory lock; in the parallel-team / multi-CI-container plan, two simultaneous `db:migrate` runs against a shared DB could race. Architectural; revisit if migrations are ever run concurrently against the same database.
