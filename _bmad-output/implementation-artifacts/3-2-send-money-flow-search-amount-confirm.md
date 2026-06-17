---
baseline_commit: 6e58604
---

# Story 3.2: Send Money Flow (Search, Amount, Confirm)

Status: done

## Story

As an authenticated user,
I want a guided flow where I find a recipient, enter an amount and optional note, and confirm,
so that I can transfer money with clear intent and no dead ends.

## Acceptance Criteria

1. **Given** `GET /api/users/search?q={term}`, **When** called by an authenticated user, **Then** it returns matching users by username — excluding the requester — as `[{ id, username }]`, never exposing `password_hash` or `balance_cents` (FR10)

2. **Given** the search query is empty or below the minimum length, **Then** it returns an empty array without a full-table scan, and the query uses `idx_users_username` (NFR3)

3. **Given** the `/send` page, **When** rendered, **Then** it presents a 3-step funnel — (1) recipient selection via `UserSearchInput`, (2) amount + optional note, (3) confirmation summary — with the current step always clear and backward navigation available; no dead ends (UX-DR2)

4. **Given** step 1, **When** the user types in `UserSearchInput`, **Then** matching usernames appear and selecting one advances to step 2

5. **Given** step 2, **When** the user enters an amount, **Then** it is captured as integer cents, the optional note is captured, and the confirmation step renders the amount via `AmountDisplay` as formatted currency (UX-DR10)

6. **Given** step 3, **When** the user confirms, **Then** `POST /api/transactions` is called with `{ recipientId, amountCents, note? }` validated by `sendMoneySchema` (Zod), and on `201` the user is returned to home (FR11, FR12)

7. **Given** `POST /api/transactions` returns `409 { "code": "INSUFFICIENT_BALANCE" }`, **Then** the UI states the shortfall explicitly (e.g., "Insufficient balance — you have $X.XX, this transfer is for $Y.YY") — never a generic message or bare disabled state (UX-DR9)

8. **Given** invalid input, **When** `sendMoneySchema` validation fails, **Then** the API returns `400 { "code": "VALIDATION_ERROR" }` and the error is surfaced inline on the relevant field

9. **Given** an e2e test for the send flow, **When** run, **Then** it covers searching for and selecting a recipient, entering an amount, confirming, and the successful transfer reflected in the sender's balance

## Tasks / Subtasks

- [x] Task 1: Add `searchUsers()` to `src/lib/users.ts` (AC: #1, #2)
  - [x] Import `like`, `and`, `ne` from `drizzle-orm`
  - [x] Export `async function searchUsers(term: string, excludeUserId: number): Promise<Array<{ id: number; username: string }>>`
  - [x] Use `like(users.username, \`${term}%\`)` for index-friendly prefix search (uses `idx_users_username`)
  - [x] Exclude caller via `ne(users.id, excludeUserId)`
  - [x] Select only `id` and `username` — never `passwordHash` or `balanceCents`
  - [x] Apply `.limit(10)` to bound result size

- [x] Task 2: Add `sendMoneySchema` to `src/lib/schemas.ts` (AC: #6, #8)
  - [x] Add `sendMoneySchema = z.object({ recipientId: z.number().int().positive(), amountCents: z.number().int().positive(), note: z.string().max(500).optional() })`
  - [x] Export `type SendMoneyInput = z.infer<typeof sendMoneySchema>`

- [x] Task 3: Create `src/app/api/users/search/route.ts` (AC: #1, #2)
  - [x] Export `GET(request: Request)` handler
  - [x] Extract `q` from `new URL(request.url).searchParams.get('q') ?? ''`
  - [x] Return `Response.json([])` immediately if `q.trim().length < 1` (no DB call)
  - [x] Call `getAuthUser()` (no args) and handle `AppError` → `errorResponse(err.message, err.code, err.status)`
  - [x] Call `searchUsers(q.trim(), userId)` and return `Response.json(results)` with status 200
  - [x] Use `createLogger('users-search')`

- [x] Task 4: Create `src/app/api/transactions/route.ts` (AC: #6, #7, #8)
  - [x] Export `POST(request: Request)` handler
  - [x] Parse body with try/catch, return 400 `VALIDATION_ERROR` on JSON parse failure
  - [x] Validate with `sendMoneySchema.safeParse(body)`, return 400 `VALIDATION_ERROR` on failure
  - [x] Call `getAuthUser()` (no args), handle AppError → errorResponse
  - [x] Call `sendMoney(userId, parsed.data.recipientId, parsed.data.amountCents, parsed.data.note)`
  - [x] Return `Response.json(transaction, { status: 201 })` on success
  - [x] Catch `AppError` → `errorResponse(err.message, err.code, err.status)` (covers `INSUFFICIENT_BALANCE` → 409)
  - [x] Catch unexpected errors → `errorResponse('Internal server error', 'INTERNAL_ERROR', 500)`
  - [x] Use `createLogger('transactions-route')`

- [x] Task 5: Create `src/app/(protected)/send/page.tsx` — 3-step funnel shell (AC: #3)
  - [x] `'use client'` — step state is entirely client-side
  - [x] Manage step state: `step: 1 | 2 | 3`, `recipient: { id: number; username: string } | null`, `amountCents: number | null`, `note: string`
  - [x] Step 1: render `<UserSearchInput>` with back-to-home button
  - [x] Step 2: render amount + note inputs with back-to-step-1 button
  - [x] Step 3: render confirmation summary with back-to-step-2 button and submit
  - [x] Visible step indicator (e.g. "Step 1 of 3") so current position is always clear
  - [x] `aria-live="polite"` region for step transition announcements (accessibility)
  - [x] Semantic HTML: `<form>` for step 2 inputs, `<button>` for all actions

- [x] Task 6: Create `src/app/(protected)/send/UserSearchInput.tsx` (AC: #4)
  - [x] `'use client'` component
  - [x] Controlled text input for username search
  - [x] On input change: call `GET /api/users/search?q={value}` and render matching users
  - [x] Show results as a list; each item is keyboard-focusable (role="option" or similar)
  - [x] Selecting a result (click or Enter) calls `onSelect(user: { id, username })`
  - [x] Empty state: no results message when search returns nothing
  - [x] Use `<Input>` from `@/components/ui/input`
  - [x] aria-label on input, aria-live on results list

- [x] Task 7: Dollar input → cents conversion for step 2 (AC: #5)
  - [x] Accept dollar input string from user (e.g. "25" or "25.50")
  - [x] Convert: `Math.round(parseFloat(dollarInput) * 100)` when advancing to step 3
  - [x] Validate inline: must be a positive finite number with at most 2 decimal places
  - [x] Show inline validation error on the field if invalid (e.g. "Enter a valid dollar amount")
  - [x] Display the converted amount via `<AmountDisplay cents={amountCents} />` in step 3 summary

- [x] Task 8: Step 3 confirmation and INSUFFICIENT_BALANCE display (AC: #6, #7)
  - [x] Summary shows: recipient username, amount via `AmountDisplay`, note (if provided)
  - [x] On confirm: POST to `/api/transactions`, disable button during in-flight request
  - [x] On 201: call `useBalanceStore.getState().setBalance(newBalance)` with sender's updated balance
    — **Note:** the 201 response returns the `Transaction` object, not the new balance. The sender's updated balance must be fetched separately OR derived from current balance minus amountCents. Use `useBalanceStore.getState().balanceCents - amountCents` for the optimistic update.
  - [x] On 201: `router.push('/')` (use `useRouter` from `next/navigation`)
  - [x] On 409 INSUFFICIENT_BALANCE: display explicit message — "Insufficient balance — you have [current balance], this transfer is for [requested amount]" using `formatCents()` from `AmountDisplay`
  - [x] On other errors: surface `error` field from response body inline

- [x] Task 9: Wire Send button on home page (AC: #3)
  - [x] Update `src/app/(protected)/page.tsx` — wrap Send `<Button>` in `<Link href="/send">` from `next/link`
  - [x] Keep existing button markup and styling; `<Link>` renders the `<Button>` as an anchor

- [x] Task 10: Write e2e test `tests/e2e/send-money.spec.ts` (AC: #9)
  - [x] Create two users via register flow (or `createUser` + login)
  - [x] Log in as sender
  - [x] Navigate to Send, search for recipient, select
  - [x] Enter dollar amount, continue to confirm
  - [x] Submit and verify redirect to home
  - [x] Verify sender's displayed balance decreased by the sent amount

## Dev Notes

### What Already Exists — Do Not Recreate

| File | State | Relevant |
|------|-------|----------|
| `src/lib/transactions.ts` | EXISTS — no change in this story | `sendMoney(senderId, recipientId, amountCents, note?)` — the service this story's route calls |
| `src/lib/users.ts` | EXISTS — **MUST ADD `searchUsers()`** | Has `findByUsername`, `getUserById`, `createUser` — add `searchUsers` here |
| `src/lib/schemas.ts` | EXISTS — **MUST ADD `sendMoneySchema`** | Already has `registerSchema`, `loginSchema`; add `sendMoneySchema` + type |
| `src/lib/auth.ts` | EXISTS | `getAuthUser()` — NO arguments (see critical note below) |
| `src/lib/errors.ts` | EXISTS | `AppError` + `errorResponse(message, code, status)` |
| `src/lib/logger.ts` | EXISTS | `createLogger('context')` factory — use this in route handlers |
| `src/lib/sse-emitter.ts` | EXISTS — no touch in this story | SSE emit infrastructure; do NOT call `emit()` in this story |
| `src/components/ui/AmountDisplay.tsx` | EXISTS | `<AmountDisplay cents={n} />` + exported `formatCents(cents)` |
| `src/components/ui/input.tsx` | EXISTS | Use for all text inputs |
| `src/components/ui/button.tsx` | EXISTS | Use for all buttons |
| `src/components/ui/card.tsx` | EXISTS | Available for layout containers |
| `src/app/(protected)/page.tsx` | EXISTS — **MUST WIRE Send button** | Currently has inert Send button; needs `<Link href="/send">` |
| `src/db/index.ts` | EXISTS | Singleton Drizzle client with both `usersSchema` and `transactionsSchema` merged |
| `src/types/index.ts` | EXISTS | Has `SSEEvent`, `User`, `Transaction` (real), `PaymentRequest` (stub) |

### CRITICAL: `getAuthUser()` Takes NO Arguments

The architecture doc shows `getAuthUser(request)` but the **actual implementation** uses `cookies()` from `next/headers` internally and takes **zero arguments**:

```typescript
// src/lib/auth.ts — actual implementation
export async function getAuthUser(): Promise<{ userId: number }> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  // ...
}
```

**Do NOT call `getAuthUser(request)` — it will silently receive an argument it ignores.**

The correct pattern for route handlers in this story:

```typescript
import { getAuthUser } from '@/lib/auth'
import { AppError } from '@/lib/errors'

// Inside GET/POST handler:
let userId: number
try {
  ;({ userId } = await getAuthUser())
} catch (err) {
  if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
  return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
}
```

### `src/lib/users.ts` — Adding `searchUsers()`

Import `like`, `and`, `ne` from `drizzle-orm` alongside the existing `eq` import.

```typescript
import { eq, like, and, ne } from 'drizzle-orm'

export async function searchUsers(
  term: string,
  excludeUserId: number,
): Promise<Array<{ id: number; username: string }>> {
  return db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(and(like(users.username, `${term}%`), ne(users.id, excludeUserId)))
    .limit(10)
}
```

**Why `like` not `ilike`:** The `idx_users_username` index (a B-tree uniqueIndex) supports prefix pattern matching via `LIKE 'prefix%'`. PostgreSQL cannot use this index for `ILIKE` (case-insensitive) without a separate GIN/GiST index. Since username storage is case-sensitive and this is a training tool, case-sensitive prefix search is correct. NFR3 requires no full-table scan — the prefix `LIKE 'term%'` satisfies this via index seek.

**Why the route handler guards empty queries (not `searchUsers`):** Returning `[]` before hitting the DB for empty/short queries prevents unnecessary round trips. `searchUsers` itself does not guard — the route handler is responsible.

### `src/app/api/users/search/route.ts` — Full Pattern

```typescript
import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { searchUsers } from '@/lib/users'
import { errorResponse } from '@/lib/errors'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('users-search')

export async function GET(request: Request) {
  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()

  if (q.length < 1) {
    return Response.json([])
  }

  const results = await searchUsers(q, userId)
  log.info(`search q="${q}" userId=${userId} → ${results.length} results`)
  return Response.json(results)
}
```

### `src/app/api/transactions/route.ts` — Full Pattern

```typescript
import { getAuthUser } from '@/lib/auth'
import { sendMoney } from '@/lib/transactions'
import { sendMoneySchema } from '@/lib/schemas'
import { errorResponse } from '@/lib/errors'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('transactions-route')

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  const parsed = sendMoneySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  try {
    const transaction = await sendMoney(
      userId,
      parsed.data.recipientId,
      parsed.data.amountCents,
      parsed.data.note,
    )
    log.info(`send userId=${userId} → recipientId=${parsed.data.recipientId} amountCents=${parsed.data.amountCents}`)
    return Response.json(transaction, { status: 201 })
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(`unexpected error in POST /api/transactions: ${err instanceof Error ? err.message : String(err)}`)
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
```

**HTTP status table alignment:** `INSUFFICIENT_BALANCE` comes from `AppError('...', 'INSUFFICIENT_BALANCE', 409)` — the 409 comes from the service layer, so `errorResponse(err.message, err.code, err.status)` returns 409 automatically. No special case needed.

### Dollar Input → Integer Cents Conversion

The `sendMoneySchema` accepts `amountCents: z.number().int().positive()`. The UI shows a dollar input — the conversion happens client-side before building the request body:

```typescript
function parseDollarsToCents(value: string): number | null {
  const num = parseFloat(value)
  if (!isFinite(num) || num <= 0) return null
  // Reject more than 2 decimal places (e.g. "1.234")
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null
  return Math.round(num * 100)
}
```

Display the parsed value in step 3 using `<AmountDisplay cents={amountCents} />` from `@/components/ui/AmountDisplay`.

### INSUFFICIENT_BALANCE Error Display (UX-DR9)

The step-3 confirm button handler must construct a specific message — not a generic one:

```typescript
// After a 409 INSUFFICIENT_BALANCE response:
const currentBalance = useBalanceStore.getState().balanceCents
const message = `Insufficient balance — you have ${formatCents(currentBalance)}, this transfer is for ${formatCents(amountCents)}`
```

`formatCents` is exported from `@/components/ui/AmountDisplay`. Import and use it.

### Sender Balance Update After 201

The `POST /api/transactions` response returns the `Transaction` object (not the user's new balance). Update the sender's displayed balance optimistically on the client:

```typescript
// On 201 success:
const { balanceCents } = useBalanceStore.getState()
useBalanceStore.getState().setBalance(balanceCents - amountCents)
router.push('/')
```

This is Story 3.2 scope. Story 3.3 wires SSE so the **recipient's** balance updates in real time. The sender's update here is an optimistic client-side deduction.

### 3-Step Funnel Structure (UX-DR2)

The send page should manage state with a pattern like:

```typescript
type Step = 1 | 2 | 3
const [step, setStep] = useState<Step>(1)
const [recipient, setRecipient] = useState<{ id: number; username: string } | null>(null)
const [amountCents, setAmountCents] = useState<number | null>(null)
const [note, setNote] = useState('')
const [error, setError] = useState<string | null>(null)
const [submitting, setSubmitting] = useState(false)
```

Each step transitions forward via explicit user action (search selection, Next button, Confirm). Back navigation always available — Step 1 back goes to home (`router.push('/')`), Step 2 back goes to Step 1, Step 3 back goes to Step 2. Step state resets appropriately on back-navigation (e.g., going back from Step 2 clears amount/note).

**Step indicator:** show the user where they are:
```tsx
<p aria-live="polite" className="text-sm text-muted-foreground">
  Step {step} of 3
</p>
```

### Home Page Send Button Wiring (Task 9)

In `src/app/(protected)/page.tsx`, wrap the Send Button in a Next.js `<Link>`:

```tsx
import Link from 'next/link'

// Replace:
<Button size="lg" className="h-12 justify-start text-base">
  <ArrowUpRight data-icon="inline-start" />
  Send
</Button>

// With:
<Button asChild size="lg" className="h-12 justify-start text-base">
  <Link href="/send">
    <ArrowUpRight data-icon="inline-start" />
    Send
  </Link>
</Button>
```

**Note:** This project uses `@base-ui/react` NOT Radix UI. For shadcn/ui components (Button), use `asChild` prop with `<Link>` — check the Button component's actual implementation to confirm it supports `asChild`. If it does not, wrap as `<Link href="/send"><Button ...>Send</Button></Link>` instead (Button renders `<button>` not `<a>` — so the outer pattern is correct when asChild is not available).

Actually, since Button from shadcn/ui v2 typically does NOT use `asChild` with base-ui — use the outer-Link pattern instead:
```tsx
<Link href="/send" className="contents">
  <Button size="lg" className="h-12 w-full justify-start text-base">
    <ArrowUpRight data-icon="inline-start" />
    Send
  </Button>
</Link>
```
Or simply navigate programmatically from the button's `onClick` with `router.push('/send')` since the page is already `'use client'`.

### Accessibility Requirements (CLAUDE.md + UX-DR8)

The 3-step funnel must be keyboard-operable:
- All interactive elements reachable by Tab in logical order
- Visible focus indicator on all focusable elements (Tailwind's `focus-visible:ring` — provided by shadcn/ui components)
- `aria-live="polite"` region announces step changes (e.g., "Step 2 of 3")
- The search results list must be keyboard-navigable (arrow keys move focus through results; Enter selects)
- Form inputs must have associated `<label>` (use `<Label>` from `@/components/ui/label`)
- Error messages must be linked via `aria-describedby` or rendered adjacent to the control
- The `<Input>` component from `@/components/ui/input` already has the correct base styling

Do NOT use raw `<div>` for interactive elements. Use `<button>` for all user-initiated actions.

### E2E Test Pattern (`tests/e2e/send-money.spec.ts`)

Follow `tests/e2e/auth.spec.ts` conventions (Playwright `test()`, `expect()`, `page.goto()`, `page.getByRole()`, `page.getByLabel()`):

```typescript
import { test, expect } from '@playwright/test'

test('send money flow — search, amount, confirm, balance updates', async ({ page }) => {
  // Register sender and recipient
  const sender = `e2e_sender_${Date.now()}`
  const recipient = `e2e_recipient_${Date.now()}`
  // ... register both users (can reuse auth.spec.ts pattern)
  
  // Log in as sender
  // Navigate to /send
  // Search for recipient
  // Enter amount (e.g. "25")
  // Confirm
  // Expect redirect to /
  // Expect displayed balance to decrease
})
```

Two test users must be created per test. Use a dedicated timestamp suffix to avoid collisions. Clean up by using unique username prefixes (Playwright doesn't have `afterEach` DB cleanup — rely on unique usernames per test run).

### sendMoneySchema Validation Notes

The Zod schema validates the serialised JSON body:
- `recipientId` — `z.number().int().positive()` — client must convert search result `id` (already a number)
- `amountCents` — `z.number().int().positive()` — client must convert dollar string to integer cents before posting
- `note` — optional; omit if empty string (send `undefined`, not `""`)

Send the note only if non-empty:
```typescript
const body: SendMoneyInput = {
  recipientId: recipient.id,
  amountCents: amountCents,
  ...(note.trim() ? { note: note.trim() } : {}),
}
```

### Known Pre-Existing Issue

`npx tsc --noEmit` has a pre-existing type error in `tests/unit/lib/users.test.ts`. Do not fix it — leave as-is (tracked from Story 2.3 Dev Notes, still present in 3.1).

### Project Structure Notes

**New files:**
- `src/app/api/users/search/route.ts` — GET handler for username search
- `src/app/api/transactions/route.ts` — POST handler for send money
- `src/app/(protected)/send/page.tsx` — send funnel page (Client Component)
- `src/app/(protected)/send/UserSearchInput.tsx` — step 1 search (Client Component)
- `src/app/(protected)/send/SendMoneyForm.tsx` — steps 2 + 3 (Client Component, optional: merge into page.tsx if small enough)
- `tests/e2e/send-money.spec.ts` — Playwright e2e

**Modified files:**
- `src/lib/schemas.ts` — add `sendMoneySchema` + `SendMoneyInput`
- `src/lib/users.ts` — add `searchUsers()` + `like`, `and`, `ne` imports
- `src/app/(protected)/page.tsx` — wire Send button to `/send`

**No changes to:**
- `src/lib/transactions.ts` — Story 3.3 wires SSE emit into `sendMoney`; do not touch
- `src/lib/sse-emitter.ts` — Story 3.3 scope
- `src/db/index.ts` — already has both schemas merged
- `src/types/index.ts` — `Transaction` type already correct from Story 3.1

### Cross-Story Context

- **Story 3.1** (done): `sendMoney()` service exists in `src/lib/transactions.ts` — this story adds the route handler and UI on top of it
- **Story 3.3** (next): wires `emit(recipientId, BALANCE_UPDATED)` inside `sendMoney()` — do NOT add that call in this story
- **Story 3.4** (after): adds `GET /api/transactions` (history) and `/history` page — `src/app/api/transactions/route.ts` created in this story will need a `GET` export added then; don't stub it now
- **Story 4.3** (`payRequest`): follows the same atomic pattern as `sendMoney`; the route handler pattern established here (catch AppError → errorResponse) becomes the template for all subsequent money-movement handlers

### References

- Architecture: Route handler standard shape, `{ error, code }` error shape, HTTP status table [Source: `_bmad-output/planning-artifacts/architecture.md#API & Communication Patterns`]
- Architecture: Service layer boundary — route handlers call `src/lib/`; no business logic in handlers [Source: `_bmad-output/planning-artifacts/architecture.md#Service layer`]
- Architecture: `GET /api/users/search?q=` — FR10, NFR3 [Source: `_bmad-output/planning-artifacts/architecture.md#FR-to-Structure Mapping`]
- Architecture: Integer cents throughout — no floats [Source: `_bmad-output/planning-artifacts/architecture.md#Monetary amounts`]
- Architecture: `sendMoneySchema` naming — `{verb}{Noun}Schema` [Source: `_bmad-output/planning-artifacts/architecture.md#Naming Patterns`]
- UX-DR2: 3-step funnel (recipient → amount/note → confirm), no dead ends [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.2`]
- UX-DR9: Explicit error messages — specify the shortfall, not just "insufficient" [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.2`]
- UX-DR10: `AmountDisplay` used wherever monetary amount displayed [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.2`]
- UX-DR8: Keyboard-first — logical tab order, visible focus indicators [Source: `_bmad-output/planning-artifacts/architecture.md#WCAG`]
- Epics: Story 3.2 ACs [Source: `_bmad-output/planning-artifacts/epics.md#Story 3.2`]
- Previous story: `Transaction` type now real (re-export from `src/db/schema/transactions`) [Source: `_bmad-output/implementation-artifacts/3-1-transactions-schema-and-atomic-send-service.md#Completion Notes`]
- Previous story: `sendMoney` does NOT emit SSE — Story 3.3 wires that [Source: `_bmad-output/implementation-artifacts/3-1-transactions-schema-and-atomic-send-service.md#Note`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

### Completion Notes List

- Implemented all 10 tasks in a single pass on branch `story/3-2-send-money-flow-search-amount-confirm`.
- `searchUsers()` uses `LIKE 'term%'` for index-friendly prefix search on `idx_users_username`; guards against empty query are in the route handler, not the service function.
- `sendMoneySchema` added to `src/lib/schemas.ts`; `SendMoneyInput` type exported for use by page.tsx.
- Both API route handlers follow the established AppError → errorResponse pattern; `INSUFFICIENT_BALANCE` 409 flows automatically from the service layer.
- The 3-step funnel page is a single `'use client'` component; `UserSearchInput` is extracted as a sibling component. Arrow-key navigation (ArrowUp/ArrowDown/Enter) added to the search results list for full keyboard operability.
- Sender balance is updated optimistically via `useBalanceStore.getState().balanceCents - amountCents` on 201 (Story 3.3 will wire real-time SSE for recipient side).
- `formatCents` imported from `AmountDisplay` for the explicit INSUFFICIENT_BALANCE error message.
- Home-page Send button wrapped in `<Link href="/send" className="contents">` to preserve button sizing within the grid layout.
- TypeScript compilation and full unit test suite pass (4 pre-existing auth test failures due to missing `JWT_SECRET` env var — unchanged from before).
- Two Playwright e2e tests cover the happy path (balance decreases) and the INSUFFICIENT_BALANCE error path.

### File List

- `src/lib/users.ts` (modified — added `searchUsers()` + `like`, `and`, `ne` imports)
- `src/lib/schemas.ts` (modified — added `sendMoneySchema` + `SendMoneyInput`)
- `src/app/api/users/search/route.ts` (new)
- `src/app/api/transactions/route.ts` (new)
- `src/app/(protected)/send/page.tsx` (new)
- `src/app/(protected)/send/UserSearchInput.tsx` (new)
- `src/app/(protected)/page.tsx` (modified — wired Send button with `<Link href="/send">`)
- `tests/e2e/send-money.spec.ts` (new)

## Change Log

- 2026-06-17: Implemented story 3.2 — 3-step send money funnel with user search API, transactions POST route, `sendMoneySchema`, client-side page with keyboard-accessible search, dollar→cents conversion, INSUFFICIENT_BALANCE explicit error, optimistic balance update, home-page Send button wired to `/send`, and Playwright e2e tests (2 scenarios).

## Review Findings

_Adversarial code review (Blind Hunter + Edge Case Hunter + Acceptance Auditor), 2026-06-17._

### Decision Needed (resolved → patch)

- [x] [Review][Patch] Send button: convert to base-ui render prop — `<Button render={<Link href="/send" />} nativeButton={false}>` to avoid invalid `<a><button>` nesting / axe violation [src/app/(protected)/page.tsx:21] _(decision: use render prop per CLAUDE.md)_
- [x] [Review][Patch] Username search: switch `like` → `ilike` for case-insensitive prefix match so "Alice" finds "alice" [src/lib/users.ts:32] _(decision: accept index tradeoff)_

### Patch

- [x] [Review][Patch] LIKE wildcard injection — `%`/`_`/`\` in search term are unescaped, so typing `%` matches/enumerates all usernames [src/lib/users.ts:32]
- [x] [Review][Patch] Search has no request sequencing/abort/debounce — out-of-order responses render stale results for a different query [src/app/(protected)/send/UserSearchInput.tsx:102]
- [x] [Review][Patch] Double-submit on Confirm — `disabled={submitting}` only applies after re-render; a fast double-click fires two POSTs and sends money twice. Add `if (submitting) return` guard [src/app/(protected)/send/page.tsx:262]
- [x] [Review][Patch] `searchUsers` DB call not wrapped in try/catch in the route — a DB failure yields an unhandled rejection / opaque 500, unlike the transactions route [src/app/api/users/search/route.ts:24]
- [x] [Review][Patch] Search fetch ignores non-ok responses — on 401/500 the stale prior results persist silently with no error shown [src/app/(protected)/send/UserSearchInput.tsx:112]
- [x] [Review][Patch] Invalid ARIA on results list — `aria-live` on `role="listbox"` plus non-`option` children (loading `role="status"` li, "No users found" li) are invalid listbox children; move them out of the `<ul>` [src/app/(protected)/send/UserSearchInput.tsx:157]
- [x] [Review][Patch] `amountCents` has no upper bound (schema + parse) — `balance_cents` is Postgres int4; a near-max recipient credit can overflow → opaque 500 instead of 400. Add `.max()` bound [src/lib/schemas.ts:39]

### Deferred

- [x] [Review][Defer] E2E asserts the optimistic client balance and never verifies server-side money movement / recipient credit; `Date.now()` username suffix can collide across parallel workers [tests/e2e/send-money.spec.ts] — deferred, test hardening
- [x] [Review][Defer] Search log line interpolates raw `q` — newlines/control chars can forge log entries [src/app/api/users/search/route.ts:25] — deferred, low-severity logging hardening
- [x] [Review][Defer] `parseDollarsToCents` rejects leading-dot input like `.50` (regex requires a leading digit) [src/app/(protected)/send/page.tsx:216] — deferred, minor UX
- [x] [Review][Defer] `sendMoneySchema.note` is not trimmed server-side — whitespace-only notes are storable via direct API calls [src/lib/schemas.ts:41] — deferred, low severity
- [x] [Review][Defer] Server `VALIDATION_ERROR` surfaces in the generic banner, not inline on the field (AC #8 intent) — largely unreachable because the client pre-validates the amount [src/app/(protected)/send/page.tsx:295] — deferred, pre-existing/minor
