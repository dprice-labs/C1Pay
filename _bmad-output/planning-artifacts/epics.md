---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics']
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
---

# C1Pay - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for C1Pay, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: A new user can register an account with a unique username and password
FR2: A registered user can authenticate with their username and password
FR3: An authenticated user can log out and end their session
FR4: The system enforces authenticated access to all protected routes — unauthenticated requests are rejected
FR5: User passwords are stored using a one-way cryptographic hash — plaintext passwords are never persisted or logged
FR6: A new user account is assigned a fixed starting balance at registration
FR7: An authenticated user can view their current balance
FR8: The system prevents a user from initiating any payment that would exceed their available balance
FR9: All balance changes are applied atomically — no partial updates are possible under concurrent operations
FR10: An authenticated user can search for another registered user by username
FR11: An authenticated user can send money to another user by specifying an amount and an optional note
FR12: A sent payment transfers funds immediately with no pending state
FR13: Sender and recipient balances update atomically upon a completed send
FR14: A completed send is recorded in the transaction history of both the sender and recipient
FR15: An authenticated user can request money from another registered user by specifying an amount and an optional note
FR16: A submitted payment request appears in the recipient's inbox in a pending state
FR17: A recipient can pay a pending request, transferring funds immediately
FR18: A recipient can decline a pending request without transferring funds
FR19: A requester can cancel their own pending request at any time before it is resolved
FR20: A resolved request (paid, declined, or cancelled) is removed from the recipient's active inbox
FR21: The outcome of a resolved request is recorded in both parties' transaction history
FR22: The system prevents a recipient from paying a request when their balance is insufficient
FR23: An authenticated user can view a chronological list of all their transactions — sends, received payments, paid requests, and declined requests
FR24: Each transaction record displays the counterparty, amount, direction, type, optional note, and timestamp
FR25: An authenticated user can view the count of their pending incoming payment requests
FR26: An authenticated user's balance updates in real time when funds are sent to them
FR27: An authenticated user's inbox updates in real time when a new payment request is received
FR28: An authenticated user's inbox and balance update in real time when a request they sent is resolved
FR29: The real-time connection re-establishes automatically after a network interruption
FR30: The application is usable at mobile, tablet, and desktop viewport sizes without loss of functionality
FR31: The application meets WCAG AA accessibility standards — including semantic HTML structure, ARIA roles and labels, keyboard navigation, focus management, and colour contrast ratios
FR32: A user can complete all core flows (register, log in, send, request, pay, decline, cancel) using keyboard navigation alone
FR33: An administrator can create multiple test user accounts in a single batch operation
FR34: An administrator can assign a specified starting balance to all accounts during batch setup
FR35: An administrator can reset account balances and clear transaction and request history for all test accounts
FR36: The batch administration process is idempotent — repeated execution produces the same result without duplicating or corrupting data
FR37: The system has unit tests that verify the behaviour of individual components in isolation, without database or network dependencies
FR38: The system has integration tests that verify behaviour across component boundaries, including real database operations and transaction integrity
FR39: The system has end-to-end tests that verify complete user flows from the browser through to the database
FR40: Tests are named and organised by level so that the testing strategy is legible to a reader without additional explanation
FR41 (Phase 2): A reader can access a decision record for each major architectural choice made in the codebase
FR42 (Phase 2): Each decision record documents the options considered, the decision made, and the rationale
FR43 (Phase 2): A reader can access a concept document for each software engineering practice demonstrated in the codebase
FR44 (Phase 2): Each concept document explains the practice in context and links to at least one authoritative external resource

### NonFunctional Requirements

NFR1: Real-time balance and inbox updates reach connected clients within 1 second of the triggering event under local network conditions
NFR2: Page loads and route transitions complete within 2 seconds under local development
NFR3: No N+1 query patterns — database queries do not scale linearly with result set size
NFR4: User passwords are hashed using bcrypt with a minimum work factor of 12
NFR5: JWT tokens carry an explicit expiry; expired tokens are rejected on all protected routes
NFR6: JWT token payloads contain no sensitive data beyond the user identifier
NFR7: All protected routes reject unauthenticated requests with a 401 response — no silent failures
NFR8: No real financial data of any kind is stored, transmitted, or referenced anywhere in the system
NFR9: No duplication of business logic — each piece of logic exists in exactly one location in the codebase
NFR10: Unit tests cover all business logic functions; integration tests cover all database operations; e2e tests cover all user-facing flows
NFR11: Each module is independently readable — a developer can understand a module without cross-referencing unrelated files
NFR12: No dead code, unused imports, or commented-out blocks committed to the codebase
NFR13: The application passes WCAG 2.1 AA automated checks — zero automated violations
NFR14: All interactive elements are operable via keyboard with visible focus indicators
NFR15: All non-text content has appropriate text alternatives
NFR16: Colour contrast meets WCAG AA minimums: 4.5:1 for normal text, 3:1 for large text and UI components

### Additional Requirements

- **Starter template**: Project must be initialised with `npx create-next-app@16 c1pay --typescript --app --eslint --tailwind --src-dir --import-alias "@/*"` (first implementation story)
- **Test pyramid setup**: Install and configure Vitest + Playwright; establish three-level pyramid directory structure (`tests/unit/`, `tests/integration/`, `tests/e2e/`) (second story)
- **Domain schema files**: Drizzle schema split into domain-scoped files under `src/db/schema/` (users.ts, transactions.ts, requests.ts)
- **Migration workflow**: `drizzle-kit generate` + `drizzle-kit migrate` for versioned, committed migration files
- **Zod validation**: All route handler inputs validated with Zod schemas; schemas serve dual purpose (runtime validation + TypeScript type inference)
- **Row-level locking**: `SELECT ... FOR UPDATE` raw SQL inside Drizzle transaction blocks at all balance debit/credit boundaries
- **Singleton Drizzle client**: Single instance exported from `src/db/index.ts`
- **JWT in httpOnly cookie**: `HttpOnly`, `SameSite=Strict`, `Path=/` — no localStorage for tokens
- **`jose` library**: For JWT signing/verification (edge runtime compatible for middleware.ts)
- **`bcryptjs`**: Pure-JS bcrypt at work factor 12 (no native dependencies)
- **Single JWT, 1-day expiry**: No refresh token for Phase 1 (deliberate tradeoff; ADR required)
- **`middleware.ts` route protection**: Single enforcement point; redirects unauthenticated requests to /login
- **In-memory SSE emitter**: `src/lib/sse-emitter.ts` — `Map<userId, WritableStreamDefaultWriter>` for fan-out
- **`{ error, code }` error shape**: All API error responses use `{ "error": "...", "code": "SCREAMING_SNAKE_CASE" }`
- **Zustand stores**: `src/store/auth.ts`, `src/store/balance.ts`, `src/store/requests.ts`
- **Server Components by default**: `'use client'` applied only where interactivity or browser APIs required
- **Integer cents**: All monetary values stored, transmitted, and held in state as integer cents (never float)
- **`src/lib/logger.ts`**: Labeled console logger (`[INFO] [context] message`); no raw console.log in server code
- **`.env.local` + `.env.example`**: Secrets gitignored; .env.example committed with placeholders and comments
- **`Providers.tsx` Client Component**: Seeds Zustand stores from Server Component initial data; mounts `useSSE` hook
- **`src/hooks/use-sse.ts`**: Opens `EventSource` to `/api/sse`; dispatches to Zustand stores on events
- **Service layer boundary**: Business logic only in `src/lib/`; route handlers handle HTTP concerns only; `scripts/seed.ts` calls services directly
- **Request status enum**: PostgreSQL enum `request_status` with values `PENDING`, `PAID`, `DECLINED`, `CANCELLED`
- **AppError class**: `src/lib/errors.ts` with typed errors; route handlers catch and convert to HTTP responses
- **HTTP status code table**: 200 (GET/action with result), 201 (POST create), 204 (action no return), 400 (validation), 401 (unauth), 403 (forbidden), 404 (not found), 409 (conflict), 500 (unexpected)
- **SSE event envelope**: Typed union `BALANCE_UPDATED | REQUEST_RECEIVED | REQUEST_RESOLVED` with integer cents in all monetary fields

### UX Design Requirements

UX-DR1: Balance is the hero element on the home screen — displayed prominently with clear visual hierarchy; primary action buttons (Send, Request) are large and immediately accessible; inbox badge count is always visible
UX-DR2: Send/Request flow follows a 3-step funnel: recipient selection → amount + optional note → confirm; no dead ends; intent unambiguous at every step
UX-DR3: All request states (PENDING, PAID, DECLINED, CANCELLED) rendered with explicit labelled status badges — text label plus subtle colour; never colour alone
UX-DR4: Transaction history rows display counterparty, direction indicator (sent/received), amount, type, optional note, and timestamp in a scannable, dense layout
UX-DR5: Entity naming in the UI matches the data model exactly — "transaction", "request", "balance" — no euphemistic or abstracted naming
UX-DR6: SSE balance updates must be visually animated — a brief highlight or count-up animation draws the eye to the number as it changes, making the SSE delivery moment unmissable across two screens
UX-DR7: Balance gate — when the Pay button is disabled due to insufficient balance, the reason is stated explicitly in the UI (e.g., "Insufficient balance — you have $X, this request is for $Y"); never just a grey disabled state
UX-DR8: All flows designed keyboard-first; every interactive element reachable and operable via keyboard with a visible focus indicator; tab order is logical and predictable
UX-DR9: Error messages are explicit and specific — identifying the exact reason for failure with enough context for the user to act; no generic "something went wrong" messages
UX-DR10: The `AmountDisplay` shared component converts integer cents to formatted currency at render time; used consistently wherever a monetary amount is displayed
UX-DR11: Inbox badge on home screen and navigation updates in real time via SSE (`REQUEST_RECEIVED`, `REQUEST_RESOLVED` events); the change is visually noticeable, not subtle
UX-DR12: Request state machine is surfaced visually on request objects — a compact event log or state indicator shows the transition history (pending → paid/declined/cancelled) as a teaching artifact for the 4-state lifecycle

### FR Coverage Map

FR1: Epic 1 — Register with unique username + password
FR2: Epic 1 — Authenticate with credentials
FR3: Epic 1 — Log out, end session
FR4: Epic 1 — Route protection enforcement
FR5: Epic 1 — Password stored as cryptographic hash
FR6: Epic 1 — Starting balance assigned at registration
FR7: Epic 2 — View current balance (home screen)
FR25: Epic 2 — Pending request count badge (home screen)
FR29: Epic 2 — SSE auto-reconnect after network interruption
FR8: Epic 3 — Balance gate on send
FR9: Epic 3 — Atomic balance changes
FR10: Epic 3 — Username search
FR11: Epic 3 — Send money (amount + optional note)
FR12: Epic 3 — Send transfers immediately
FR13: Epic 3 — Sender + recipient balances update atomically
FR14: Epic 3 — Send recorded in both transaction histories
FR23: Epic 3 — Chronological transaction history
FR24: Epic 3 — Transaction row displays full detail
FR26: Epic 3 — Recipient balance updates in real time (SSE emit wired into sendMoney)
FR15: Epic 4 — Request money from another user
FR16: Epic 4 — Request appears in recipient's inbox as PENDING
FR17: Epic 4 — Recipient can pay a pending request
FR18: Epic 4 — Recipient can decline a pending request
FR19: Epic 4 — Requester can cancel their own pending request
FR20: Epic 4 — Resolved requests removed from active inbox
FR21: Epic 4 — Request outcome recorded in both parties' history
FR22: Epic 4 — Balance gate on Pay button
FR27: Epic 4 — Inbox updates in real time when request received
FR28: Epic 4 — Inbox + balance update when sent request resolved
FR33: Epic 5 — Batch create test accounts
FR34: Epic 5 — Assign starting balance in batch
FR35: Epic 5 — Reset balances + clear history
FR36: Epic 5 — Idempotent batch process
FR30: Epic 6 — Responsive at mobile/tablet/desktop
FR31: Epic 6 — WCAG AA — semantic HTML, ARIA, keyboard, contrast
FR32: Epic 6 — All core flows completable via keyboard alone
FR37: Epics 1+ — Unit test infrastructure (Epic 1); tests written alongside features
FR38: Epics 1+ — Integration test infrastructure (Epic 1); tests written alongside features
FR39: Epics 1+ — E2e test infrastructure (Epic 1); tests written alongside features
FR40: Epic 1 — Tests named and organised by pyramid level
FR41: Epic 7 — Decision records for major architectural choices (Phase 2)
FR42: Epic 7 — Each decision record documents options + rationale (Phase 2)
FR43: Epic 7 — Concept docs for each demonstrated practice (Phase 2)
FR44: Epic 7 — Concept docs cite authoritative external resources (Phase 2)

## Epic List

### Epic 1: Foundation & Authentication
Users can register, log in, and log out securely. All routes are protected. The test pyramid infrastructure is in place and proven.
**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR40 (test pyramid structure)

### Epic 2: Home Screen & Real-Time Foundation
After login, users see their current balance and pending request count. The SSE connection is live and the client state architecture is fully in place.
**FRs covered:** FR7, FR25, FR29

### Epic 3: Send Money & Transaction History
Users can find other users, send money, and view their full transaction history. The recipient's balance updates in real time — the SSE infrastructure from Epic 2 comes alive.
**FRs covered:** FR8, FR9, FR10, FR11, FR12, FR13, FR14, FR23, FR24, FR26

### Epic 4: Request Flow & State Machine
Users can request money, manage their inbox (pay/decline), cancel their own outgoing requests, and see all state transitions clearly. Inbox and balance update in real time.
**FRs covered:** FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22, FR27, FR28

### Epic 5: Batch Administration
A facilitator can create and reset test accounts via a single CLI command. Training session prep takes under two minutes with no UI required.
**FRs covered:** FR33, FR34, FR35, FR36

### Epic 6: Accessibility & Responsive Design
The application meets WCAG AA at all viewport sizes and is fully keyboard operable — surfaced as an explicit, demonstrated teaching artifact throughout the codebase.
**FRs covered:** FR30, FR31, FR32

### Epic 7 (Phase 2): Learning Layer
Every architectural decision and practice demonstrated in the codebase is documented with decision records and concept docs — the codebase becomes a complete self-teaching artifact.
**FRs covered:** FR41, FR42, FR43, FR44
