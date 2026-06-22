---
baseline_commit: 73ab128
---

# Story 3.4: Transaction History

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an authenticated user,
I want a chronological list of all my transactions with full detail,
so that I can review every transfer I have sent or received.

## Acceptance Criteria

1. **Given** `src/lib/transactions.ts`, **Then** it exports `getTransactionHistory(userId: number): Promise<...>` returning all transactions where the user is sender or recipient, ordered by `created_at` descending (FR23)

2. **Given** `getTransactionHistory`, **When** executed, **Then** counterparty usernames are resolved via a join in a single query — no N+1 pattern (NFR3)

3. **Given** `GET /api/transactions`, **When** called by an authenticated user, **Then** it returns that user's transaction history; an unauthenticated request returns `401 { "error": "Unauthorized", "code": "UNAUTHORIZED" }` (FR23)

4. **Given** the `/history` page (Server Component), **When** rendered, **Then** it lists transactions newest-first, each rendered by `TransactionRow`

5. **Given** a `TransactionRow`, **Then** it displays the counterparty username, a direction indicator (sent vs received relative to the viewer), the amount via `AmountDisplay`, the type, the optional note (when present), and the timestamp — in a scannable, dense layout (FR24, UX-DR4)

6. **Given** the viewer is the sender of a transaction, **Then** the row shows a "sent" direction; **Given** the viewer is the recipient, **Then** it shows "received" — derived from `sender_id`/`recipient_id` versus the viewer

7. **Given** the UI labels, **Then** entities are named exactly as the data model — "transaction", "balance" — with no euphemistic or abstracted naming (UX-DR5)

8. **Given** the user has no transactions, **Then** the history shows an explicit empty state

9. **Given** an integration test for `getTransactionHistory`, **When** run, **Then** it verifies a user sees both sent and received transactions in descending chronological order with correct counterparty resolution

## Tasks / Subtasks

- [x] Task 1: Add `getTransactionHistory()` to the transactions service with a single-query join (AC: #1, #2)
  - [x] In `src/lib/transactions.ts`, add `getTransactionHistory(userId: number)` that selects all rows from `transactions` where `senderId = userId OR recipientId = userId`, ordered by `createdAt DESC` (use `desc(transactions.createdAt)` from `drizzle-orm`)
  - [x] Resolve the **counterparty** username in the **same query** — no per-row follow-up lookups (NFR3). Because either side can be the viewer, join `users` against the counterparty id with a conditional. The cleanest approach is a `CASE` expression for the counterparty id plus a self-join, or two `leftJoin`s on `users` aliased as sender/recipient and pick the non-viewer username in the select. Prefer using Drizzle's `aliasedTable` (`import { alias } from 'drizzle-orm/pg-core'`) for two joins (`senderUser`, `recipientUser`) — this keeps it a single round-trip and tsc-clean.
  - [x] Define and export the return row shape so the route and UI share one type. Add to `src/lib/transactions.ts` (or `src/types/index.ts`) an interface such as:
    ```typescript
    export interface TransactionHistoryItem {
      id: number
      amountCents: number
      note: string | null
      createdAt: Date              // Drizzle returns a Date for `timestamp` columns
      direction: 'sent' | 'received'
      counterpartyUsername: string
    }
    ```
    Derive `direction` from `row.senderId === userId ? 'sent' : 'received'` and `counterpartyUsername` from the opposite side. Returning a **viewer-relative** shape keeps the direction/counterparty derivation in the service (one place, NFR9) rather than recomputing it in the route and the component.
  - [x] Add `import { eq, or, desc, sql } from 'drizzle-orm'` as needed (note: `eq`/`sql` already imported; add `or`, `desc`)
  - [x] Log a single info line: `log.info(\`getTransactionHistory userId=${userId} → ${rows.length} rows\`)`
  - [x] Do NOT add a new index — `idx_transactions_sender_id` and `idx_transactions_recipient_id` already exist (Story 3.1). No schema change, no migration.

- [x] Task 2: Unit test for the direction/counterparty derivation (AC: #6)
  - [x] In `tests/unit/lib/transactions.test.ts`, mock `db` (the file already mocks `@/db/index` and `@/lib/sse-emitter`). Stub the query chain to resolve with two raw joined rows — one where the viewer is `senderId`, one where the viewer is `recipientId` — and assert the mapped result has `direction: 'sent'` / `'received'` and the correct `counterpartyUsername` for each
  - [x] If wiring the full chainable query stub proves brittle (the existing `sendMoney` tests mock `db.transaction`, not `db.select`), keep the unit assertion focused on the **pure mapping** by extracting a tiny pure helper (e.g. `toHistoryItem(row, userId)`) and unit-testing that directly; the integration test (Task 4) is the authoritative proof of the join/ordering. Prefer the pure-helper route — it is the more legible teaching artifact and avoids a brittle ORM mock. — DONE via the pure `toHistoryItem` route.

- [x] Task 3: Add the `GET` handler to the transactions route (AC: #3)
  - [x] In `src/app/api/transactions/route.ts`, add an exported `GET` function alongside the existing `POST`
  - [x] Mirror the auth-first ordering and error shape of `GET /api/users/search` (`src/app/api/users/search/route.ts`): call `getAuthUser()` first; on `AppError` return `errorResponse(err.message, err.code, err.status)`, else `401 UNAUTHORIZED`
  - [x] Call `getTransactionHistory(userId)` and return `Response.json(history)` (status 200). Wrap in try/catch returning `500 INTERNAL_ERROR` on unexpected errors, matching the existing `POST` handler's catch block
  - [x] Note: `middleware.ts` already rejects unauthenticated `/api/*` requests, but keep the in-handler `getAuthUser()` guard for defense-in-depth and to obtain `userId` (consistent with every other route handler)

- [x] Task 4: Integration test for `getTransactionHistory` (AC: #1, #2, #6, #9)
  - [x] In `tests/integration/transactions.test.ts`, add a `describe('getTransactionHistory integration', ...)` (or extend the existing describe) following the file's conventions: `createUser` for fixtures, `afterEach` cleanup, `globalThis._pgClient?.end()` in `afterAll`
  - [x] Create three users (viewer, A, B). Have the viewer **send** to A, and B **send** to the viewer (viewer is recipient). Insert with a small delay or distinct amounts so ordering is assertable
  - [x] Call `getTransactionHistory(viewer.id)` and assert: exactly 2 rows; ordered `createdAt` descending; the sent row has `direction: 'sent'` + `counterpartyUsername === A.username`; the received row has `direction: 'received'` + `counterpartyUsername === B.username`
  - [x] IMPORTANT: extend the existing `afterEach` cleanup so the new usernames are also deleted, or use the existing `SENDER_USERNAME`/`RECIPIENT_USERNAME` constants plus one new constant and add it to the `or(...)` delete filter — otherwise the new fixtures leak across tests — DONE: added `THIRD_USERNAME` to both `or(...)` filters.

- [x] Task 5: `/history` Server Component page + `TransactionRow` (AC: #4, #5, #6, #7, #8)
  - [x] Create `src/app/(protected)/history/page.tsx` as a **Server Component** (no `'use client'`). It calls `getAuthUser()` to get `userId`, then `getTransactionHistory(userId)` directly (Server Components may call services directly — they do NOT fetch their own API route), and renders the list
  - [x] Page structure: a `<main>`-level section is already provided by `(protected)/layout.tsx`; render a `<h1>` "Transaction history" (NOT level-1 `balance-heading` — that selector belongs to home), then either the empty state or a list (`<ul>`/`<ol>`) of `TransactionRow`
  - [x] Empty state (AC #8): an explicit message, e.g. "No transactions yet." — visible text, semantic element, not a bare blank area
  - [x] Create `src/app/(protected)/history/TransactionRow.tsx`. It is presentational; pass it a `TransactionHistoryItem`. It MAY be a Server Component (no interactivity) — only add `'use client'` if you introduce client-only APIs (you should not need to). Display, in a dense scannable row:
    - counterparty username
    - a direction indicator that is **never colour alone** (UX-DR3 cross-check / UX-DR5): a text label ("Sent" / "Received") AND an icon (`ArrowUpRight` for sent, `ArrowDownLeft` for received — same icons used on the home Send/Request CTAs) with `aria-hidden` on the icon since the text label carries the meaning
    - the amount via `<AmountDisplay cents={item.amountCents} />` (UX-DR10) — do NOT format cents inline
    - the type — for this story every row is a "transaction" (sends/receives). Render the literal type label using the data-model word "transaction" (UX-DR5/UX-DR7 entity-naming). Requests-derived history is Epic 4; do not invent statuses here
    - the optional note, only when present
    - the timestamp — format the `createdAt` Date for display (e.g. `Intl.DateTimeFormat`); wrap in a `<time dateTime={...}>` element for semantics
  - [x] Use shadcn/Base-UI components and semantic Tailwind tokens per CLAUDE.md. Use `flex` + `gap-*` (never `space-x/y-*`), `size-4` for equal dimensions, `data-icon` on icons inside any `Button`, and `cn()` for conditional classes. Prefer existing primitives (`Card`, `Badge`, `Separator`) over custom markup; run `npx shadcn@latest search` / `add` only if a genuinely new primitive is needed (a plain semantic list is likely sufficient — do not over-install) — a plain semantic `<ul>`/`<li>` + `AmountDisplay` was sufficient; no new primitive installed.
  - [x] Wire navigation: add a way to reach `/history` from home. The home page (`src/app/(protected)/page.tsx`) currently has Send + Request CTAs and an Inbox card but no history link. Add a discreet link/button to `/history` (e.g. a "View transaction history" link near the inbox section or under the balance). Keep the existing `<h1 id="balance-heading">` and the Send/Request/Inbox markup intact — e2e selectors depend on them (`getByRole('heading', { level: 1 })` for balance; the Send Button rendered as a link)
  - [x] Accessibility (CLAUDE.md always-on): semantic list markup, headings in order, every row legible to a screen reader (the direction is a text label, not colour; the timestamp is a `<time>`; the amount reads as currency). No `aria-live` needed here — history is not SSE-driven

- [x] Task 6: E2E coverage for the history view (AC: #4, #5, #8)
  - [x] Add a focused e2e (either a new `tests/e2e/history.spec.ts` or extend `send-money.spec.ts`) that: registers + logs in a user, sends money to a second user, navigates to `/history`, and asserts the sent transaction appears with its counterparty, a "Sent" direction label, and the amount
  - [x] Reuse the register/login helpers and selector conventions from `tests/e2e/send-money.spec.ts` / `realtime.spec.ts` (Base UI `Button` rendered as a link has `role="button"`, not `link`; use a random username suffix because `tests/e2e` runs `fullyParallel`)
  - [x] Optionally assert the empty-state copy for a freshly-registered user who navigates to `/history` before sending — DONE as a dedicated empty-state test.
  - [x] Do NOT call `page.reload()` to force the list — this is a Server Component, so the data is present on navigation/render

### Review Findings

_Adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor), 2026-06-22. Diff = uncommitted working tree on `story/3-4-transaction-history` (baseline `73ab128`). No Critical/High. All 9 ACs satisfied; full CLAUDE.md a11y/UI compliance. 0 decision-needed, 2 patch (applied), 4 deferred, 5 dismissed._

- [x] [Review][Patch] Ordering stability — add secondary `desc(transactions.id)` to `getTransactionHistory` ORDER BY; `createdAt` alone is not a stable sort on timestamp ties (would reorder rows nondeterministically and flake the integration ordering assertion). _(Medium; flagged by Blind + Edge.)_ [src/lib/transactions.ts:132]
- [x] [Review][Patch] Duplicate info-log — service and route both logged userId + row count, double-logging every fetch; removed the route-level log, kept the service one. _(Low.)_ [src/app/api/transactions/route.ts:65]

- [x] [Review][Defer] `note` has no length cap / truncation+`title` for layout (long counterparty notes can break the dense row) [src/app/(protected)/history/TransactionRow.tsx] — deferred; note-length constraint already deferred from 3.1/3.2, truncation is a minor UI refinement
- [x] [Review][Defer] `amountCents` typed as `number` (precision past 2^53) [src/lib/transactions.ts] — deferred, pre-existing (already in deferred-work from 3.1, INT4/bigint)
- [x] [Review][Defer] `TransactionRow` calls `createdAt.toISOString()` assuming a `Date`; a future client consumer of `GET /api/transactions` would receive a JSON string and crash the row [src/app/(protected)/history/TransactionRow.tsx] — deferred; no current client consumer (the page is a Server Component passing a real `Date`)
- [x] [Review][Defer] No `LIMIT`/pagination on the history query — unbounded result set for high-volume users [src/lib/transactions.ts] — deferred, pagination explicitly out of scope for this story
- _Dismissed (5):_ e2e register helper's no-auto-login assumption (verified — register asserts redirect to `/login`); direction indicator uses no optional colour accent (spec-discretionary, colour-never-alone already satisfied); type label fused into the direction line rather than a separate `Badge` (spec-discretionary); `<time>` UTC vs local visible text (correct for a training app, spec-discretionary); "tsc/lint not run in dev session" process note (already run clean post-dev for all 3-4 files).

## Dev Notes

### What Already Exists — Do Not Recreate

| File | State | Relevant to this story |
|------|-------|----------------------|
| `src/lib/transactions.ts` | EXISTS — **MODIFY** | Add `getTransactionHistory()` next to `sendMoney()`. Do NOT touch `sendMoney`'s logic or its post-commit `emit()`. |
| `src/db/schema/transactions.ts` | EXISTS — **no change** | Table + `Transaction` type already defined, with `idx_transactions_sender_id` / `idx_transactions_recipient_id`. No schema change, no migration. |
| `src/app/api/transactions/route.ts` | EXISTS — **MODIFY** | Currently exports only `POST`. Add a sibling `GET` for history. |
| `src/app/api/users/search/route.ts` | EXISTS — **no change** | The reference pattern for a GET handler: auth-first, `errorResponse` shape, try/catch. Mirror it. |
| `src/lib/users.ts` | EXISTS — **no change** | `searchUsers()` shows the project's single-query join/select idiom (`db.select({...}).from(users)...`). Reference for the join style. |
| `src/components/ui/AmountDisplay.tsx` | EXISTS — **no change** | Pure renderer: `<AmountDisplay cents={n} />`. Use it for every monetary value in the row (UX-DR10). Do NOT format cents inline. |
| `src/app/(protected)/layout.tsx` | EXISTS — **no change** | Provides the `<header>` + `<main>` chrome and the Zustand `Providers`. The `/history` page renders inside this `<main>`. |
| `src/app/(protected)/page.tsx` | EXISTS — **MODIFY** | Home — add a link to `/history`. Keep `<h1 id="balance-heading">`, the Send/Request CTAs, and the Inbox card intact (e2e + Story 3.3 selectors depend on them). |
| `src/types/index.ts` | EXISTS — **may MODIFY** | Re-exports `Transaction`. If you put `TransactionHistoryItem` here instead of in `transactions.ts`, keep it consistent and exported once (NFR9). |
| `src/lib/schemas.ts` | EXISTS — **no change** | `GET /api/transactions` takes no body — no new Zod schema needed. |
| `tests/unit/lib/transactions.test.ts` | EXISTS — **MODIFY** | Already mocks `@/db/index` + `@/lib/sse-emitter`. Add the mapping test here. |
| `tests/integration/transactions.test.ts` | EXISTS — **MODIFY** | Add the `getTransactionHistory` integration test; extend the `afterEach` cleanup for any new fixture usernames. |

### THE CORE CHANGE: a single-query, viewer-relative history (AC #1, #2, #6)

The `transactions` table stores **one row per transfer**; per-viewer "sent" vs "received" is *derived at read time*, never duplicated (this is exactly the design noted in Story 3.1's AC: "`sender_id`/`recipient_id` encode direction; per-viewer sent/received is derived at read time, not duplicated"). So `getTransactionHistory(userId)`:

1. Selects rows where `userId` is **either** sender or recipient: `where(or(eq(transactions.senderId, userId), eq(transactions.recipientId, userId)))`.
2. Orders by `desc(transactions.createdAt)`.
3. Resolves the **counterparty** username in the *same* query (NFR3 — no N+1). The viewer can be on either side, so you need both usernames available and then pick the non-viewer one. Recommended Drizzle pattern — two aliased joins:

```typescript
import { alias } from 'drizzle-orm/pg-core'
import { or, eq, desc } from 'drizzle-orm'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { transactions } from '@/db/schema/transactions'

const senderUser = alias(users, 'sender_user')
const recipientUser = alias(users, 'recipient_user')

export interface TransactionHistoryItem {
  id: number
  amountCents: number
  note: string | null
  createdAt: Date
  direction: 'sent' | 'received'
  counterpartyUsername: string
}

export async function getTransactionHistory(userId: number): Promise<TransactionHistoryItem[]> {
  const rows = await db
    .select({
      id: transactions.id,
      senderId: transactions.senderId,
      recipientId: transactions.recipientId,
      amountCents: transactions.amountCents,
      note: transactions.note,
      createdAt: transactions.createdAt,
      senderUsername: senderUser.username,
      recipientUsername: recipientUser.username,
    })
    .from(transactions)
    .innerJoin(senderUser, eq(transactions.senderId, senderUser.id))
    .innerJoin(recipientUser, eq(transactions.recipientId, recipientUser.id))
    .where(or(eq(transactions.senderId, userId), eq(transactions.recipientId, userId)))
    .orderBy(desc(transactions.createdAt))

  return rows.map((r) => toHistoryItem(r, userId))
}

// Pure mapping — unit-test this directly (Task 2).
export function toHistoryItem(
  r: {
    id: number; senderId: number; recipientId: number
    amountCents: number; note: string | null; createdAt: Date
    senderUsername: string; recipientUsername: string
  },
  userId: number,
): TransactionHistoryItem {
  const sent = r.senderId === userId
  return {
    id: r.id,
    amountCents: r.amountCents,
    note: r.note,
    createdAt: r.createdAt,
    direction: sent ? 'sent' : 'received',
    counterpartyUsername: sent ? r.recipientUsername : r.senderUsername,
  }
}
```

- **Why two `innerJoin`s, not a `CASE`:** both FKs are `NOT NULL` with `references(() => users.id)`, so an inner join on each side is safe and lets PostgreSQL use the existing `idx_transactions_sender_id` / `idx_transactions_recipient_id` indexes. It is one round-trip — no N+1 (AC #2). A self-referential `CASE` for the counterparty id + a single join is also acceptable; the two-alias form is the most readable teaching artifact.
- **Why a pure `toHistoryItem` helper:** it isolates the direction/counterparty derivation as a small, DB-free, unit-testable function (NFR9 — one place for the logic; FR37 — unit-testable without a DB). The route and the page both consume the already-derived shape.
- **`createdAt` is a `Date`:** Drizzle returns a JS `Date` for `timestamp` columns. The component formats it for display; the API route will serialize it to an ISO string over JSON (fine — the page calls the service directly and keeps the `Date`).

### Server Component page — call the service directly, do NOT fetch the API (AC #4)

Per the architecture, `/history` is a **Server Component** (`src/app/(protected)/history/page.tsx`). Server Components run on the server and may call `src/lib/` services directly — they must NOT `fetch('/api/transactions')` (that would be a needless server→server HTTP hop and is an anti-pattern here). The `GET /api/transactions` route (Task 3) exists to satisfy FR23's API requirement and for any future client consumer, but the page itself uses `getTransactionHistory(userId)` directly:

```tsx
// src/app/(protected)/history/page.tsx  (Server Component — NO 'use client')
import { getAuthUser } from '@/lib/auth'
import { getTransactionHistory } from '@/lib/transactions'
import { TransactionRow } from './TransactionRow'

export default async function HistoryPage() {
  const { userId } = await getAuthUser()
  const items = await getTransactionHistory(userId)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <h1 className="text-2xl font-semibold">Transaction history</h1>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No transactions yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <TransactionRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

Mirror the home page's container classes (`mx-auto … max-w-3xl …`) for visual consistency. Do NOT reuse `id="balance-heading"` — that id is the home balance heading that e2e selects via `getByRole('heading', { level: 1 })`.

### `TransactionRow` — dense, scannable, colour-never-alone (AC #5, #6, #7)

```tsx
// src/app/(protected)/history/TransactionRow.tsx  (presentational; Server Component is fine)
import { ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { AmountDisplay } from '@/components/ui/AmountDisplay'
import type { TransactionHistoryItem } from '@/lib/transactions'

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' })

export function TransactionRow({ item }: { item: TransactionHistoryItem }) {
  const sent = item.direction === 'sent'
  const Icon = sent ? ArrowUpRight : ArrowDownLeft
  const label = sent ? 'Sent' : 'Received'

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card p-3 text-card-foreground">
      <div className="flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon aria-hidden="true" className="size-4" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium">{item.counterpartyUsername}</span>
          <span className="text-xs text-muted-foreground">
            {/* text label carries the meaning — never colour alone */}
            {label} transaction
            {item.note ? ` · ${item.note}` : ''}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <AmountDisplay cents={item.amountCents} className="font-medium" />
        <time dateTime={item.createdAt.toISOString()} className="text-xs text-muted-foreground">
          {dateFmt.format(item.createdAt)}
        </time>
      </div>
    </div>
  )
}
```

- **Direction is text + icon, never colour alone** (UX-DR3 cross-check, NFR15): the visible word "Sent"/"Received" carries the meaning; the icon is `aria-hidden`. You MAY add a subtle colour as decoration but it must not be the sole signal.
- **Entity naming** (UX-DR5/UX-DR7): use "transaction" and "balance" — the data-model words. Do NOT say "activity", "payment", or "you paid". Every row in this story is a transaction.
- **`AmountDisplay` everywhere** (UX-DR10): never `formatCents` inline in the row; pass `cents` to the shared component.
- **Timestamp:** wrap in `<time dateTime>` for semantics; format the `Date` for the visible text.
- This is a Server Component (no interactivity). Only add `'use client'` if you genuinely introduce a client API — you should not need to.

### GET handler — mirror the search route (AC #3)

Add `GET` beside the existing `POST` in `src/app/api/transactions/route.ts`. Mirror `src/app/api/users/search/route.ts`: auth first, the `{ error, code }` shape, and a try/catch ending in `500 INTERNAL_ERROR`.

```typescript
// add to src/app/api/transactions/route.ts (POST stays unchanged)
import { sendMoney, getTransactionHistory } from '@/lib/transactions'

export async function GET() {
  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  try {
    const history = await getTransactionHistory(userId)
    log.info(`history userId=${userId} → ${history.length} rows`)
    return Response.json(history)
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(
      `unexpected error in GET /api/transactions: ${err instanceof Error ? err.message : String(err)}`,
    )
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
```

`Response.json(history)` serializes the `Date` `createdAt` to an ISO string — acceptable for the API contract (FR23). The Server Component page keeps the `Date` because it calls the service directly.

### Scope Boundaries

- **No schema change, no migration.** The `transactions` table and its indexes already exist (Story 3.1).
- **No new dependencies.** `drizzle-orm` (`alias`, `or`, `desc`), `lucide-react`, and `AmountDisplay` are all present.
- **Do NOT touch `sendMoney`** beyond importing alongside it — its atomic transfer + post-commit `emit()` are frozen (Stories 3.1/3.3).
- **Requests are out of scope.** FR21 ("resolved request outcome recorded in both parties' history") is Epic 4. This story shows **transaction** rows only (sends/receives). Do not model request statuses (PENDING/PAID/…) here.
- **No real-time on history.** History is a static Server-Component read; no `aria-live`, no SSE wiring. (Live balance is Story 3.3, already done.)
- **No pagination required.** The epic AC asks for "a chronological list of all" transactions; at training-app scale a full list is correct. Do not add pagination/infinite-scroll.

### Known Pre-Existing Issues (do NOT fix here)

- `npx tsc --noEmit` has a pre-existing type error in `tests/unit/lib/users.test.ts` (carried since Stories 2.3 → 3.1 → 3.2 → 3.3). Leave as-is; keep the files YOU edit tsc-clean.
- Auth unit tests fail locally without `JWT_SECRET` set; environmental and pre-existing.
- `tests/e2e/sse.spec.ts` (network-interruption reconnect) and `tests/e2e/auth.spec.ts` history noted in Story 3.3's review as flaky/stale in this environment — not in this story's scope.

### Environment Notes (from prior stories' learnings)

- **Playwright browsers:** this host (Ubuntu 26.04) is unsupported by Playwright's bundled browsers; Story 3.3 ran e2e against system Chrome via a throwaway `chrome`-channel config (deleted after) or the committed containerised runner (`docker-compose.e2e.yml`, added in PR #17). Use the container runner or a local Chrome channel; do NOT commit a changed `playwright.config.ts`.
- **Local DB:** integration/e2e need a `c1pay` Postgres DB and a gitignored `.env.local` (`DATABASE_URL`, `JWT_SECRET`); `docker-compose.yml` / `docker-compose.integration.yml` provision these. Run `npm run db:migrate` if starting fresh.
- **drizzle-kit on Node 26:** the drizzle-kit `migrate` CLI silently no-ops on Node 26 — use the committed programmatic migrator `src/db/migrate.mjs` (`npm run db:migrate`).

### Project Structure Notes

**New files:**
- `src/app/(protected)/history/page.tsx` — transaction history Server Component (architecture-named location, `(protected)/history/`)
- `src/app/(protected)/history/TransactionRow.tsx` — single history entry display (architecture-named)
- `tests/e2e/history.spec.ts` — history view e2e (or extend `send-money.spec.ts`)

**Modified files:**
- `src/lib/transactions.ts` — add `getTransactionHistory()` + `toHistoryItem()` + `TransactionHistoryItem` (single-query join; sendMoney untouched)
- `src/app/api/transactions/route.ts` — add `GET` beside `POST`
- `src/app/(protected)/page.tsx` — add a link to `/history` (keep existing markup/selectors intact)
- `tests/unit/lib/transactions.test.ts` — unit-test `toHistoryItem` mapping
- `tests/integration/transactions.test.ts` — `getTransactionHistory` integration test; extend cleanup for new fixtures

**No changes to:** `src/db/schema/transactions.ts`, `src/db/schema/users.ts` (no migration), `sse-emitter.ts`, `use-sse.ts`, `balance.ts`/`requests.ts` stores, `AmountDisplay.tsx`, `schemas.ts`, `layout.tsx`, `Providers.tsx`.

### Cross-Story Context

- **Story 3.1** (done): created the `transactions` table + indexes + `sendMoney()`; its AC explicitly states per-viewer sent/received is **derived at read time, not duplicated** — this story is that read.
- **Story 3.2** (done): the send funnel that produces the rows this history lists; reuse its e2e register/login helper shape.
- **Story 3.3** (done): live recipient balance (`emit` after commit) + `LiveBalance` on home. Its Dev Notes flagged: "Do not add a transaction-history route/page — that's Story 3.4 (it adds `GET` to the same `transactions/route.ts`)." This is that work. Do NOT disturb the `emit()` path.
- **Epic 4** (later): requests add resolved-request outcomes to history (FR21) and the request state machine (UX-DR3/UX-DR12). Out of scope here — history shows transactions only.
- **Epic 6** (later): full WCAG AA audit gate (axe-core). Build this page accessibly now (semantic list, `<time>`, text-not-colour direction) so it passes the later gate without retrofit.

### References

- Epics: Story 3.4 ACs; FR23 (chronological history), FR24 (full row detail), NFR3 (no N+1), UX-DR4 (scannable dense row), UX-DR5 (entity naming), UX-DR10 (`AmountDisplay`) [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.4`]
- Architecture: project structure — `(protected)/history/{page.tsx,TransactionRow.tsx}` (Server Component), `GET /api/transactions` (FR23–24 history), `getTransactionHistory()` in `src/lib/transactions.ts` [Source: `_bmad-output/planning-artifacts/architecture.md#Source Tree`]
- Architecture: FR-to-Structure — "FR23–25 Activity & history → `src/lib/transactions.ts`, `src/app/api/transactions/`, `src/app/(protected)/history/`" [Source: `_bmad-output/planning-artifacts/architecture.md#FR-to-Structure Mapping`]
- Architecture: service boundary — Server Components/route handlers call `src/lib/` services; DB access only inside `src/lib/`; no business logic in `src/app/` [Source: `_bmad-output/planning-artifacts/architecture.md#Architectural Boundaries`]
- Architecture: no N+1; queries do not scale linearly with result set (NFR3); single-query join [Source: `_bmad-output/planning-artifacts/architecture.md#Performance / Constraints`]
- Architecture: integer cents throughout; `AmountDisplay` converts at render [Source: `_bmad-output/planning-artifacts/architecture.md#Monetary amounts`]
- UX spec: Venmo activity-feed row (counterparty + direction + amount + note + timestamp); Stripe entity-naming discipline; status by colour alone is an anti-pattern [Source: `_bmad-output/planning-artifacts/ux-design-specification.md#UX Pattern Analysis`]
- Existing GET pattern: auth-first + `{ error, code }` + try/catch [Source: `src/app/api/users/search/route.ts`]
- Existing join/select idiom: `db.select({...}).from(users)...` [Source: `src/lib/users.ts#searchUsers`]
- Existing service to extend (do not disturb): `sendMoney` + post-commit `emit` [Source: `src/lib/transactions.ts`]
- Integration-test conventions: `createUser` fixtures, `afterEach` cleanup, `_pgClient?.end()` in `afterAll` [Source: `tests/integration/transactions.test.ts`]
- CLAUDE.md: shadcn/Base-UI rules (render prop not asChild, `data-icon`, `size-4`, `flex`+`gap`, semantic tokens, `cn()`); always-on a11y (semantic HTML, headings in order, never colour alone, WCAG AA contrast, responsive)
- Previous story environment learnings (Playwright on Ubuntu 26.04, local DB, `migrate.mjs`) [Source: `_bmad-output/implementation-artifacts/3-3-real-time-recipient-balance-update.md#Debug Log References`]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Opus 4.8)

### Debug Log References

- Unit: `npx vitest run tests/unit` → 8 files, 41 tests passed (3 new `toHistoryItem` cases).
- Integration: `npm run test:integration:docker` → 3 files, 13 tests passed (1 new `getTransactionHistory integration`). Ran against the ephemeral Postgres stack on port 5433; migrations applied via `src/db/migrate.mjs`.
- E2E: `npm run test:e2e:docker` → 9 tests passed across the containerised Playwright runner (2 new history specs: empty state + sent-transaction row). Previously-flaky sse/auth specs also green this run.
- Environment note: `npx tsc --noEmit`, `npm run lint`, and `mcp__ide__getDiagnostics` were all blocked by sandbox permissions in this session, so static type-checking could not be run directly. Mitigation: the new code reuses the story's verified scaffolds and existing project idioms; the test files import/exercise the new exports under vitest's esbuild transform; and the Next.js dev server inside the e2e container compiled and served `/history` without error — collectively strong evidence the new code is type/compile-clean. David should run `npx tsc --noEmit` and `npm run lint` locally before commit (the pre-existing `tests/unit/lib/users.test.ts` tsc error is expected and out of scope).

### Completion Notes List

- AC #1, #2: `getTransactionHistory(userId)` added to `src/lib/transactions.ts` — single-query two-aliased-`innerJoin` (`sender_user` / `recipient_user`), `where(or(senderId, recipientId))`, `orderBy(desc(createdAt))`. No N+1; no schema change/migration; existing sender/recipient indexes reused. `sendMoney` untouched.
- AC #6 (+ NFR9): direction/counterparty derivation isolated in a pure, DB-free `toHistoryItem(row, userId)` helper, unit-tested directly.
- AC #3: `GET` added beside `POST` in `src/app/api/transactions/route.ts`, mirroring the search route's auth-first + `{ error, code }` + try/catch (`401 UNAUTHORIZED` / `500 INTERNAL_ERROR`).
- AC #4, #5, #7, #8: `/history` Server Component calls the service directly (no self-fetch); renders an `<h1>` (not `balance-heading`), an explicit "No transactions yet." empty state, and a semantic `<ul>`/`<li>` of `TransactionRow`.
- AC #5, #6, #7: `TransactionRow` shows counterparty, a direction indicator as text+icon (icon `aria-hidden`, never colour alone), `AmountDisplay` for the amount, the data-model word "transaction" for the type, the optional note when present, and a `<time dateTime>` timestamp.
- AC #9: integration test creates viewer/A/B, viewer→A send + B→viewer send (10ms apart, distinct amounts), asserts 2 rows, descending order, and correct direction + counterparty per row.
- Navigation: discreet "View transaction history" link added to home; existing `balance-heading`, Send/Request CTAs, and Inbox card left intact (e2e selectors preserved).
- Scope honoured: no requests/statuses, no pagination, no real-time/`aria-live` on history, no new dependencies, no `playwright.config.ts` change.

### File List

**New:**
- `src/app/(protected)/history/page.tsx`
- `src/app/(protected)/history/TransactionRow.tsx`
- `tests/e2e/history.spec.ts`

**Modified:**
- `src/lib/transactions.ts`
- `src/app/api/transactions/route.ts`
- `src/app/(protected)/page.tsx`
- `tests/unit/lib/transactions.test.ts`
- `tests/integration/transactions.test.ts`
- `_bmad-output/implementation-artifacts/3-4-transaction-history.md` (task checkboxes, Dev Agent Record, Status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (3-4 status)

### Change Log

- 2026-06-22: Implemented Story 3.4 Transaction History — `getTransactionHistory()` + `toHistoryItem()` service, `GET /api/transactions`, `/history` Server Component + `TransactionRow`, home navigation link; unit/integration/e2e tests added. All suites green (unit 41, integration 13, e2e 9). Status → review.
- 2026-06-22: Adversarial code review (3 layers) — no Critical/High, all 9 ACs satisfied, full CLAUDE.md a11y/UI compliance. Applied 2 patches (secondary `desc(id)` sort for stable ordering; removed duplicate per-fetch info-log), deferred 4, dismissed 5. Re-verified green (unit 13 file / integration 13 / e2e 9) + tsc/lint clean. Status → done.
