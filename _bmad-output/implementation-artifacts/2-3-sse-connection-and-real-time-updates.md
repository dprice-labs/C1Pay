---
baseline_commit: 678ea0c
---

# Story 2.3: SSE Connection & Real-Time Updates

Status: review

## Story

As an authenticated user,
I want my balance and inbox badge to update in real time without any page action,
so that changes initiated by other users are immediately visible to me.

## Acceptance Criteria

1. **Given** `src/lib/sse-emitter.ts` exists, **When** imported, **Then** it exports `emit(userId, event)`, `register(userId, writer)`, and `deregister(userId)` functions backed by a `Map<number, WritableStreamDefaultWriter>`

2. **Given** `GET /api/sse`, **When** called by an authenticated user, **Then** it registers a `WritableStreamDefaultWriter` in the emitter map and holds the connection open with a `text/event-stream` response

3. **Given** `GET /api/sse`, **When** the client disconnects, **Then** the writer is deregistered from the emitter map

4. **Given** `src/hooks/use-sse.ts` is mounted inside `Providers.tsx`, **When** a `BALANCE_UPDATED` event arrives, **Then** it calls `useBalanceStore.getState().setBalance()` with the new `balance` value

5. **Given** `useSSE` receives a `REQUEST_RECEIVED` or `REQUEST_RESOLVED` event, **When** dispatched, **Then** it calls `useRequestStore.getState().setPendingCount()` with the updated count

6. **Given** the SSE connection drops due to network interruption, **When** connectivity is restored, **Then** the browser's `EventSource` reconnects automatically without user action (FR29)

7. **Given** an e2e test for the SSE infrastructure, **When** run, **Then** it verifies the connection opens on page load, and reconnects after being dropped

_Note: `emit()` is not called by any money-movement handler until Epic 3. This story proves the infrastructure is correctly wired — live balance and badge updates are the payoff in Epics 3 and 4._

## Tasks / Subtasks

- [x] Task 1: Create `src/types/index.ts` with the `SSEEvent` discriminated union (AC: #1, #4, #5)
  - [x] Define `SSEEvent` as a discriminated union on `type` — exact shape from architecture (see Dev Notes)
  - [x] Also stub `User`, `Transaction`, `PaymentRequest` types (these are filled out in Epics 3–4; stubs prevent import errors)

- [x] Task 2: Create `src/lib/sse-emitter.ts` singleton emitter (AC: #1)
  - [x] Use `globalThis` pattern to survive Next.js HMR re-imports (see Dev Notes for exact pattern)
  - [x] Export `register(userId: number, writer: WritableStreamDefaultWriter): void`
  - [x] Export `deregister(userId: number): void`
  - [x] Export `emit(userId: number, event: SSEEvent): Promise<void>` — silently no-ops if userId not in Map; catches write errors and calls `deregister`
  - [x] Use `createLogger('sse-emitter')` — no raw `console.log`

- [x] Task 3: Create `src/app/api/sse/route.ts` SSE endpoint (AC: #2, #3)
  - [x] Export only `GET` handler — no `POST`, `runtime`, or other exports
  - [x] Call `getAuthUser()` first; wrap in try/catch and return `errorResponse` on `AppError`
  - [x] Create `TransformStream`, get writer, call `register(userId, writer)`
  - [x] Deregister on abort: `request.signal.addEventListener('abort', () => deregister(userId))`
  - [x] Return `new Response(readable, { headers: SSE_HEADERS })` (see Dev Notes for exact headers)
  - [x] Do NOT add `export const runtime = 'edge'` — must stay in Node.js runtime

- [x] Task 4: Create `src/hooks/use-sse.ts` client-side hook (AC: #4, #5, #6)
  - [x] `useEffect` with empty deps `[]` — opens `EventSource('/api/sse')` once on mount
  - [x] Listener for `BALANCE_UPDATED` → calls `useBalanceStore.getState().setBalance(data.balance)`
  - [x] Listener for `REQUEST_RECEIVED` → increments pending count by 1 (see Dev Notes)
  - [x] Listener for `REQUEST_RESOLVED` → decrements pending count by 1 (min 0) (see Dev Notes)
  - [x] Cleanup: `return () => source.close()`
  - [x] Use Zustand `.getState()` pattern — do NOT call store hook inside `useEffect`

- [x] Task 5: Wire `useSSE` into `src/app/(protected)/Providers.tsx` (AC: #4, #5)
  - [x] Remove the placeholder comment (lines 6–8)
  - [x] Add `import { useSSE } from '@/hooks/use-sse'`
  - [x] Call `useSSE()` inside the component body

- [x] Task 6: Write `tests/e2e/sse.spec.ts` e2e test (AC: #7)
  - [x] Test: connection to `/api/sse` is opened when the protected home page loads
  - [x] Test: EventSource auto-reconnects after the route is temporarily blocked/unblocked

## Dev Notes

### What Already Exists — Do Not Recreate

| File | State | Relevant to this story |
|------|-------|----------------------|
| `src/store/balance.ts` | EXISTS | `useBalanceStore` with `{ balanceCents, setBalance }` — seeded from Server Component in layout |
| `src/store/requests.ts` | EXISTS | `useRequestStore` with `{ pendingCount, setPendingCount }` — seeded from Server Component |
| `src/app/(protected)/Providers.tsx` | EXISTS — MODIFY | `'use client'` component that seeds stores; has placeholder comment on lines 6–8 for `useSSE` |
| `src/app/(protected)/layout.tsx` | EXISTS — no change | Server Component that seeds `Providers` with initial balance and count |
| `src/lib/auth.ts` | EXISTS | `getAuthUser()` reads JWT cookie → returns `{ userId: number }`, throws `AppError` on failure |
| `src/lib/errors.ts` | EXISTS | `AppError` class, `errorResponse(message, code, status)` helper |
| `src/lib/logger.ts` | EXISTS | `createLogger(context)` → `{ info, error, warn }` bound to context |
| `src/lib/sse-emitter.ts` | DOES NOT EXIST — create | |
| `src/app/api/sse/route.ts` | DOES NOT EXIST — create | |
| `src/hooks/use-sse.ts` | DOES NOT EXIST — create | |
| `src/types/index.ts` | DOES NOT EXIST — create | |

### SSE Emitter Singleton Pattern (Critical — read before writing)

Next.js HMR resets module scope on every file save, destroying the in-memory Map and severing live SSE connections. Use the `globalThis` pattern to survive reloads:

```typescript
// src/lib/sse-emitter.ts
import { createLogger } from '@/lib/logger'
import type { SSEEvent } from '@/types'

const log = createLogger('sse-emitter')

declare global {
  // eslint-disable-next-line no-var
  var __sseWriters: Map<number, WritableStreamDefaultWriter> | undefined
}

const writers: Map<number, WritableStreamDefaultWriter> =
  globalThis.__sseWriters ?? (globalThis.__sseWriters = new Map())

export function register(userId: number, writer: WritableStreamDefaultWriter): void {
  writers.set(userId, writer)
  log.info(`registered userId=${userId} (total=${writers.size})`)
}

export function deregister(userId: number): void {
  writers.delete(userId)
  log.info(`deregistered userId=${userId} (total=${writers.size})`)
}

export async function emit(userId: number, event: SSEEvent): Promise<void> {
  const writer = writers.get(userId)
  if (!writer) return
  try {
    const text = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
    await writer.write(new TextEncoder().encode(text))
  } catch {
    log.error(`write failed for userId=${userId} — deregistering`)
    deregister(userId)
  }
}
```

### SSE Route Handler (Critical)

```typescript
// src/app/api/sse/route.ts
import { getAuthUser } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { AppError } from '@/lib/errors'
import { register, deregister } from '@/lib/sse-emitter'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
}

export async function GET(request: Request) {
  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  register(userId, writer)
  request.signal.addEventListener('abort', () => deregister(userId))

  return new Response(readable, { headers: SSE_HEADERS })
}
```

Do NOT export `runtime = 'edge'`. The in-memory `Map` must live in the same Node.js process as the transaction handlers that call `emit()`.

### `useSSE` Hook — Zustand Outside-React Pattern

Calling a Zustand hook (`useBalanceStore()`) inside `useEffect` is forbidden by React's rules-of-hooks. Use `.getState()` instead, which is the Zustand API for accessing/mutating state outside the React rendering cycle:

```typescript
// src/hooks/use-sse.ts
import { useEffect } from 'react'
import { useBalanceStore } from '@/store/balance'
import { useRequestStore } from '@/store/requests'

export function useSSE(): void {
  useEffect(() => {
    const source = new EventSource('/api/sse')

    source.addEventListener('BALANCE_UPDATED', (e: MessageEvent) => {
      const { balance } = JSON.parse(e.data) as { balance: number }
      useBalanceStore.getState().setBalance(balance)
    })

    source.addEventListener('REQUEST_RECEIVED', () => {
      const { pendingCount } = useRequestStore.getState()
      useRequestStore.getState().setPendingCount(pendingCount + 1)
    })

    source.addEventListener('REQUEST_RESOLVED', () => {
      const { pendingCount } = useRequestStore.getState()
      useRequestStore.getState().setPendingCount(Math.max(0, pendingCount - 1))
    })

    return () => source.close()
  }, [])
}
```

**Why increment/decrement for request events:** The `REQUEST_RECEIVED` and `REQUEST_RESOLVED` event payloads do not carry `pendingCount` directly (see SSEEvent type below). The hook derives the new count by incrementing/decrementing the current Zustand state. This logic will be revisited in Story 4.5 when the events are actually emitted with server state — at that point the server could include the authoritative count in the payload if desired.

### `src/types/index.ts` — SSEEvent Type

```typescript
// src/types/index.ts
export type SSEEvent =
  | { type: 'BALANCE_UPDATED'; data: { balance: number } }
  | { type: 'REQUEST_RECEIVED'; data: { requestId: number; fromUsername: string; amountCents: number; note?: string } }
  | { type: 'REQUEST_RESOLVED'; data: { requestId: number; status: 'PAID' | 'DECLINED' | 'CANCELLED' } }

// Stub types filled out by Epics 3-4
export interface User {
  id: number
  username: string
  balanceCents: number
  createdAt: string
}

export interface Transaction {
  id: number
  senderId: number
  recipientId: number
  amountCents: number
  note: string | null
  createdAt: string
}

export interface PaymentRequest {
  id: number
  requesterId: number
  recipientId: number
  amountCents: number
  note: string | null
  status: 'PENDING' | 'PAID' | 'DECLINED' | 'CANCELLED'
  createdAt: string
  resolvedAt: string | null
}
```

All monetary fields are integer cents. Never use `decimal` or `float`.

### `Providers.tsx` Modification

Current file has a comment placeholder at lines 6–8:
```typescript
// Story 2.3: import { useSSE } from '@/hooks/use-sse' and call useSSE() here
// This hook opens an EventSource to /api/sse and dispatches BALANCE_UPDATED /
// REQUEST_RECEIVED / REQUEST_RESOLVED events to the Zustand stores above.
```

Replace the comment with:
```typescript
import { useSSE } from '@/hooks/use-sse'
```
And call `useSSE()` inside the component body (after the seeding block).

### EventSource Auto-Reconnect (FR29)

The browser's native `EventSource` automatically reconnects after a network interruption with exponential backoff. No additional code is required to satisfy FR29. Do not build a custom reconnect mechanism.

### Known Pre-Existing Issue

`npx tsc --noEmit` fails with a pre-existing type error in `tests/unit/lib/users.test.ts`. This is unrelated to Story 2.3. Do not fix it as part of this story — leave it as-is.

### Project Structure Notes

New files in this story:
- `src/types/index.ts` — architecture-specified location for shared TypeScript types
- `src/lib/sse-emitter.ts` — architecture-specified singleton
- `src/app/api/sse/route.ts` — architecture-specified SSE endpoint at `src/app/api/sse/`
- `src/hooks/use-sse.ts` — architecture-specified client hook location

Modified files:
- `src/app/(protected)/Providers.tsx` — add `useSSE()` call (replaces comment)

No other files should be touched. Do not add navigation links, send/request CTAs wiring, or UI changes — those are in later stories.

### References

- Architecture: SSE fan-out decision, in-memory emitter pattern, `Map<userId, WritableStreamDefaultWriter>` [Source: `_bmad-output/planning-artifacts/architecture.md#SSE fan-out`]
- Architecture: SSE event envelope type union [Source: `_bmad-output/planning-artifacts/architecture.md#Communication Patterns`]
- Architecture: Service boundary — route handler calls service, never import from `src/app/` [Source: `_bmad-output/planning-artifacts/architecture.md#Service boundary`]
- Architecture: No edge runtime for SSE — must be Node.js process [Source: `_bmad-output/planning-artifacts/architecture.md#SSE boundary`]
- Architecture: `createLogger()` usage pattern [Source: `_bmad-output/planning-artifacts/architecture.md#Logging`]
- Previous story completion: `tests/unit/lib/users.test.ts` has a pre-existing tsc error (do not fix) [Source: `_bmad-output/implementation-artifacts/2-2-home-screen-ui.md#Completion Notes`]
- Epics: Story 2.3 full ACs [Source: `_bmad-output/planning-artifacts/epics.md#Story 2.3`]

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

- Pre-existing tsc errors in `tests/unit/lib/users.test.ts` confirmed present and left untouched per Dev Notes.

### Completion Notes List

- Created `src/types/index.ts` with `SSEEvent` discriminated union (`BALANCE_UPDATED`, `REQUEST_RECEIVED`, `REQUEST_RESOLVED`) and stub types (`User`, `Transaction`, `PaymentRequest`) for Epics 3–4.
- Created `src/lib/sse-emitter.ts` using `globalThis.__sseWriters` singleton pattern to survive Next.js HMR. Exports `register`, `deregister`, `emit`. Uses `createLogger('sse-emitter')`.
- Created `src/app/api/sse/route.ts` with `GET` handler only; no edge runtime. Authenticates via `getAuthUser()`, registers writer, deregisters on `request.signal` abort, returns `text/event-stream` response.
- Created `src/hooks/use-sse.ts` with `useEffect([], [])` opening a single `EventSource('/api/sse')`. Uses `.getState()` Zustand pattern for all store mutations inside event listeners. Closes source on cleanup.
- Modified `src/app/(protected)/Providers.tsx`: replaced 3-line placeholder comment with `import { useSSE } from '@/hooks/use-sse'` and added `useSSE()` call after the seeding block.
- Created `tests/e2e/sse.spec.ts` with two tests: (1) verifies `/api/sse` request is made on protected page load; (2) verifies EventSource auto-reconnects after route is temporarily blocked via `page.route()` abort then `page.unrouteAll()`.
- All 28 unit tests and 7 integration tests pass. No new regressions.

### File List

- `src/types/index.ts` (new)
- `src/lib/sse-emitter.ts` (new)
- `src/app/api/sse/route.ts` (new)
- `src/hooks/use-sse.ts` (new)
- `src/app/(protected)/Providers.tsx` (modified)
- `tests/e2e/sse.spec.ts` (new)

## Change Log

- 2026-06-11: Implemented Story 2.3 — SSE infrastructure wired end-to-end: emitter singleton, GET /api/sse route, useSSE hook, Providers integration, e2e tests.
