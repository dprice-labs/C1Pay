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
## Deferred from: code review of 4-1-requests-schema-and-create-request (2026-06-22)

- **Recipient existence unvalidated — FK violation → raw 500:** `createRequest` inserts without verifying `recipientId` references a real user; the DB FK constraint rejects it with an unhandled error, surfacing as a generic 500 rather than a clean 404/400. Pre-existing pattern (same gap in transactions route); UI prevents it via `UserSearchInput`. Resolve when doing a service-layer error-handling hardening pass.
- **`parseDollarsToCents` IEEE-754 float precision:** `Math.round(parseFloat(str) * 100)` can produce off-by-one cents for certain edge inputs. Pre-existing (inlined verbatim from send flow per spec). Resolve if a shared `src/lib/money.ts` is created to home this helper.
- **No DB `CHECK (amount_cents > 0)` constraint:** application-layer guard exists but no DB-level defence-in-depth. Consistent with existing `transactions` table schema pattern. Add in a schema-hardening pass if defence-in-depth becomes a requirement.
- **No rate limiting / duplicate PENDING requests on double-submit:** client disables button during flight but no server-side idempotency key or per-pair rate limit. Pre-existing architectural absence across all routes. Address at infrastructure level.
- **Wizard state lost on hard refresh:** React component state cleared on reload; user must restart 3-step flow. Same behaviour as send flow. Acceptable UX at training-app scale.
- **`resolvedAt` / status transitions not yet settable:** `PAID`, `DECLINED`, `CANCELLED` enum values exist but no service sets them. Explicitly deferred to Stories 4.3 / 4.4.
- **No e2e test for request flow:** inbox page not yet available until Story 4.2; golden-path e2e test deferred to after Story 4.2 ships.
- **No route-level test for `400 VALIDATION_ERROR` body (AC8):** route correctly returns 400 + VALIDATION_ERROR code, but no automated test exercises the HTTP layer. Route-level tests are not in this project's current test pyramid (unit + service integration only). Address in an API-testing pass or Epic 6.

## Deferred from: code review of 3-4-transaction-history (2026-06-22)

- **`note` has no length cap or row truncation** (`src/app/(protected)/history/TransactionRow.tsx`): the counterparty-supplied `note` renders verbatim (React-escaped, so not XSS) with no `max-length` upstream and no truncation/`title` in the row, so a very long note can break the dense layout. Note-length constraint was already deferred from the 3.1/3.2 reviews; add a `line-clamp`/`truncate` + `title` when notes become a hardened user-facing surface.
- **`amountCents` typed as `number`** (`src/lib/transactions.ts` `TransactionHistoryItem`): values past `Number.MAX_SAFE_INTEGER` (~$90T) lose precision. Already deferred from the 3.1 review (INT4 max / `bigint` migration). Unreachable at training-app scale.
- **`TransactionRow` assumes `createdAt` is a `Date`** (`src/app/(protected)/history/TransactionRow.tsx`): it calls `createdAt.toISOString()` directly. The page is a Server Component that passes a real `Date`, so this is correct today — but a future client consumer of `GET /api/transactions` (which JSON-serialises the Date to a string) would crash the row. Coerce defensively (`new Date(createdAt)`) when/if a client consumer is added.
- **No `LIMIT`/pagination on `getTransactionHistory`** (`src/lib/transactions.ts`): the query returns the user's full history unbounded — slow query + large payload for high-volume users. Pagination was explicitly out of scope for Story 3.4; add keyset/`LIMIT` pagination when history volume warrants it.

## Deferred from: code review of 6-4-automated-wcag-aa-audit-gate (2026-06-23)

- ~~**Gate audits only the initial/empty DOM**~~ — **RESOLVED (2026-06-24):** added `'send page combobox has zero violations when expanded'` test to `tests/e2e/accessibility.spec.ts`; registers a target account, types a search query, waits for listbox options, then runs the axe audit against the populated DOM.
- **Empty-state-only coverage** (`tests/e2e/accessibility.spec.ts`): `/send` is audited unfunded and `/history` with no transactions, so the funded-balance markup and populated transaction-row markup are never scanned. Data-dependent; needs a seeded account. Pairs with the batch-admin seed work (Epic 5).
- ~~**Combobox ARIA incomplete**~~ — **RESOLVED by Story 6.1 (2026-06-24):** `role="combobox"` and `aria-expanded` were added to `UserSearchInput.tsx` in the Story 6.1 full-ARIA pass.
- ~~**Component hardcodes global ids**~~ — **RESOLVED (2026-06-24):** `UserSearchInput.tsx` now uses `useId()` for all three ids (`input`, `listbox`, `option-N`), eliminating the latent duplicate-id collision.
- ~~**Test-infra: unmigrated DB → false timeout**~~ — **RESOLVED (2026-06-24):** added `tests/e2e/global-setup.ts` (wired via `playwright.config.ts`) that runs `npm run db:migrate` before any e2e spec starts; migration failures now surface immediately rather than cascading into timeouts.
- ~~**No account teardown**~~ — **RESOLVED (2026-06-24):** added `tests/e2e/global-teardown.ts` that deletes all `e2e_%` accounts after the suite completes, covering the full e2e suite (not just the a11y spec).

## Deferred from: code review of 4-2-inbox-and-pending-request-display (2026-06-24)

- **`dateFmt` hardcoded to `en-US`** (`src/app/(protected)/inbox/RequestCard.tsx:6`): pre-existing project-wide pattern from `TransactionRow`; all users see US date format regardless of browser locale. Address in a locale/i18n pass.
- **SSE `REQUEST_RECEIVED` event never emitted from `createRequest`** (`src/lib/requests.ts`): badge count on home page never updates in real time when a new request arrives. Story 4.5 scope.
- **No `error.tsx` boundary for `/inbox` route**: unhandled DB error in `InboxPage` produces a Next.js crash page. Consistent with `history/page.tsx` pattern; add in a server-component error-boundary pass (see also 2-1 deferred note).
- **SSE `pendingCount` stale on reconnect** (`src/hooks/use-sse.ts`): no server-authoritative count re-sync when SSE reconnects; count can drift stale-low. Pre-existing SSE behavior from story 2.3; deferred to story 4.5 reconciliation.
- **`RequestCard` hardcodes "PENDING" string**: component only receives PENDING items by contract; hardcoding is by design. Revisit if the component is reused for non-PENDING states in future stories.

## Deferred from: code review of 6-1-semantic-structure-aria-and-contrast-baseline (2026-06-24) — ALL RESOLVED in same session

- ~~**h1 loses `data-slot="card-title"`**~~ — **RESOLVED (2026-06-24):** auth headings changed from `CardTitle` to raw `<h1>` at the use-site per spec; `CardTitle` component itself unchanged.
- ~~**C1Pay brand `<span>` has no link or navigation semantics**~~ — **RESOLVED (2026-06-24):** brand mark converted to an `<a href="/">` home link in `src/app/(protected)/layout.tsx`.
- ~~**`<button>` inside `<li role="option">` invalid ARIA content model**~~ — **RESOLVED (2026-06-24):** `UserSearchInput` options changed to plain `<li role="option">` with click handler — no nested `<button>`.
- ~~**`tabIndex={0}` on option `<button>` adds spurious tab stop**~~ — **RESOLVED (2026-06-24):** removed with the `<button>` element above; tab focus now stays in the combobox input.
- ~~**Escape key not handled in `handleKeyDown`**~~ — **RESOLVED (2026-06-24):** Escape now sets `isOpen(false)` and clears `activeIndex` in `UserSearchInput.handleKeyDown`.
- ~~**Duplicate `aria-label="Main"` landmark if any child page adds a competing nav**~~ — **RESOLVED (2026-06-24):** audited all protected routes in Story 6.1; no competing nav landmark exists.

## Deferred from: code review of 6-2-keyboard-first-navigation (2026-06-25)

_All three items below were fixed in the same review pass (not deferred) at user direction; verified by the full containerised e2e suite (20/20 green)._

- ~~`playwright.config.ts` `workers: 3` is a CI flakiness mitigation, not a root-cause fix — a single `next dev` server serializes requests under load.~~ — **RESOLVED (2026-06-25):** CI now serves a production build (`next build && next start`); `next start` handles concurrency, so the artificial worker cap was removed. Required fixing a pre-existing latent build error in `src/app/api/requests/route.ts` (`log.error` called with 2 args) that `next dev` never type-checked.
- ~~`src/components/ui/button.tsx` (`Button`) wraps Base UI `ButtonPrimitive` without `forwardRef`, forcing the step-3 Back button to be wrapped in a `<div ref>` + `querySelector('button')?.focus()`.~~ — **RESOLVED (2026-06-25):** Base UI `Button` is a `ForwardRefExoticComponent`; `ref` flows through the wrapper's `{...props}` (same as `Input`). Wrapper `<div>` removed in both `send/page.tsx` and `request/page.tsx`; Back button takes `ref={step3BackRef}` directly.
- ~~`tests/e2e/global-teardown.ts` deletes `payment_requests` and `transactions` before `users` in three separate non-transactional statements.~~ — **RESOLVED (2026-06-25):** the three deletes now run inside `sql.begin()` (atomic); a NOTE comment instructs future stories to add new FK-child cleanup before the users delete.
