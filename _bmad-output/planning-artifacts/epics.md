---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-epic-1', 'step-03-epic-2']
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

---

## Epic 1: Foundation & Authentication

**Goal:** Users can register, log in, and log out securely. All routes are protected. The test pyramid infrastructure is in place and proven.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR40
**NFRs relevant:** NFR4, NFR5, NFR6, NFR7, NFR9

---

### Story 1.1: Project Scaffold & Infrastructure

As a developer,
I want a configured Next.js project with test pyramid infrastructure,
So that I can begin implementing features with the correct tooling and test structure from the first commit.

**Acceptance Criteria:**

**Given** the repo is cloned, **When** `npm run dev` is executed, **Then** the default Next.js app runs on localhost:3000 without errors

**Given** the project is initialized, **When** `src/lib/logger.ts` is imported, **Then** it provides `logger.info()`, `logger.error()`, and `logger.warn()` methods that prefix output with `[LEVEL] [context] message`

**Given** the project is initialized, **When** `src/lib/errors.ts` is inspected, **Then** it exports an `AppError` class with `message`, `code`, and `status` properties and an `errorResponse(message, code, status)` helper

**Given** the test pyramid is configured, **When** `npm run test:unit` is run, **Then** Vitest runs only tests in `tests/unit/` with no DB or network access

**Given** the test pyramid is configured, **When** `npm run test:integration` is run, **Then** Vitest runs tests in `tests/integration/` using a real test database

**Given** the test pyramid is configured, **When** `npm run test:e2e` is run, **Then** Playwright runs tests in `tests/e2e/`

**Given** the project is initialized, **When** `.env.example` is inspected, **Then** it documents `DATABASE_URL` and `JWT_SECRET` with placeholder values and inline comments describing each variable

**Given** any server-side module is written, **Then** it imports from `logger.ts` — no raw `console.log` in server code

---

### Story 1.2: Database Foundation

As a developer,
I want a configured Drizzle ORM client with the users schema and migration workflow,
So that the database layer is ready for user data to be persisted in the next story.

**Acceptance Criteria:**

**Given** `src/db/index.ts` exists, **When** imported, **Then** it exports a singleton Drizzle client connected to `DATABASE_URL` — no other module instantiates a second client

**Given** `src/db/schema/users.ts` exists, **Then** it defines a `users` table with: `id` (serial PK), `username` (text, unique, not null), `password_hash` (text, not null), `balance_cents` (integer, not null, default 0), `created_at` (timestamp with timezone, default now())

**Given** `drizzle.config.ts` exists, **When** `drizzle-kit generate` is run, **Then** it produces a versioned SQL migration file in `src/db/migrations/`

**Given** a migration file exists, **When** `drizzle-kit migrate` is run, **Then** the `users` table is created in the PostgreSQL database

**Given** the migration is applied, **When** a duplicate username is inserted, **Then** the database enforces the unique constraint and rejects the insert

---

### Story 1.3: User Registration

As a new user,
I want to register an account with a unique username and password,
So that I can access the application with a starting balance.

**Acceptance Criteria:**

**Given** the `/register` page, **When** a user submits a valid username, password, and matching confirm password, **Then** `POST /api/auth/register` is called and on success the user is redirected to `/login`

**Given** the `/register` page, **When** the password and confirm password fields do not match, **Then** a client-side validation error is shown before submission and the form is not submitted

**Given** `POST /api/auth/register` receives a valid username and password, **When** executed, **Then** `createUser()` in `src/lib/users.ts` creates the user in the database with `balance_cents` of `100000` ($1,000.00)

**Given** a registration request, **When** `createUser()` runs, **Then** the password is hashed with bcryptjs at work factor 12 — plaintext password is never stored or logged

**Given** a registration request with a username that already exists, **When** executed, **Then** it returns `409 { "error": "Username already taken", "code": "USERNAME_TAKEN" }`

**Given** a registration request with missing or empty username or password, **When** Zod validation runs, **Then** it returns `400 { "error": "Validation failed", "code": "VALIDATION_ERROR" }`

**Given** a unit test for `createUser()`, **When** run, **Then** it verifies correct bcrypt hashing without a real database

**Given** an integration test for registration, **When** run, **Then** it verifies a user is created in the real database with a hashed password and `balance_cents = 100000`

_Note: confirm password is UI-only — `POST /api/auth/register` receives a single `password` field; the match check is client-side only._

---

### Story 1.4: User Login & Session

As a registered user,
I want to log in with my username and password,
So that I receive a session cookie granting access to protected routes.

**Acceptance Criteria:**

**Given** the `/login` page, **When** valid credentials are submitted, **Then** `POST /api/auth/login` is called and on success the user is redirected to `/` (home)

**Given** `POST /api/auth/login` receives valid credentials, **When** executed, **Then** it returns a `Set-Cookie` header setting an `HttpOnly`, `SameSite=Strict`, `Path=/` cookie containing a signed JWT

**Given** the JWT is issued, **Then** its payload contains only `userId`, it is signed with `JWT_SECRET` via `jose`, and carries a 1-day expiry

**Given** invalid credentials are submitted, **When** executed, **Then** it returns `401 { "error": "Invalid username or password", "code": "INVALID_CREDENTIALS" }` — same response for wrong password and unknown username (no username enumeration)

**Given** a unit test for `src/lib/auth.ts`, **When** run, **Then** `signJwt()` produces a token with correct claims and `verifyJwt()` rejects expired or tampered tokens

**Given** an integration test for login, **When** run, **Then** it verifies credentials are validated against a real database user and a cookie is set on success

---

### Story 1.5: Route Protection & Logout

As the system,
I want all protected routes to enforce JWT authentication,
So that unauthenticated users are redirected to login and authenticated users can end their session cleanly.

**Acceptance Criteria:**

**Given** `middleware.ts` is configured, **When** an unauthenticated request hits any `/(protected)` route, **Then** the user is redirected to `/login`

**Given** `middleware.ts` is configured, **When** a request carries a valid JWT cookie, **Then** it passes through to the protected route without redirect

**Given** `middleware.ts` is configured, **When** a request carries an expired JWT cookie, **Then** the user is redirected to `/login`

**Given** a logout button in the protected layout, **When** clicked, **Then** `POST /api/auth/logout` is called, the JWT cookie is cleared (expired via `Set-Cookie`), and the user is redirected to `/login`

**Given** an unauthenticated request to any `/api/` route other than `/api/auth/*`, **Then** it returns `401 { "error": "Unauthorized", "code": "UNAUTHORIZED" }`

**Given** an e2e test for the full auth flow, **When** run, **Then** it covers: register → login → access protected page → logout → redirect to `/login` → protected page no longer accessible

---

## Epic 2: Home Screen & Real-Time Foundation

**Goal:** After login, users see their current balance and pending request count. The SSE connection is live and the client state architecture is fully in place.

**FRs covered:** FR7, FR25, FR29
**NFRs relevant:** NFR1, NFR2
**UX-DRs relevant:** UX-DR1, UX-DR6, UX-DR11

---

### Story 2.1: Protected Layout & Zustand Foundation

As a developer,
I want Zustand stores initialized with server-fetched data and a client wrapper that mounts the SSE hook,
So that all protected pages share a single source of truth for balance, pending request count, and auth state.

**Acceptance Criteria:**

**Given** `src/store/auth.ts` exists, **When** imported, **Then** it exports `useAuthStore` with `{ user, setUser, clearUser }` state and actions

**Given** `src/store/balance.ts` exists, **When** imported, **Then** it exports `useBalanceStore` with `{ balanceCents, setBalance }` state and actions

**Given** `src/store/requests.ts` exists, **When** imported, **Then** it exports `useRequestStore` with `{ pendingCount, setPendingCount }` state and actions

**Given** `/(protected)/layout.tsx` is a Server Component, **When** rendered for an authenticated user, **Then** it calls `getAuthUser()` to extract the userId from the JWT cookie, fetches the user's `balance_cents` and pending request count directly from the database, and passes them as props to `Providers.tsx`

**Given** `Providers.tsx` is a `'use client'` component, **When** mounted, **Then** it seeds `useBalanceStore` with `initialBalance` and `useRequestStore` with `initialPendingCount` received from the layout

**Given** a unit test for each Zustand store, **When** run, **Then** it verifies each store's actions update state correctly without any database or network dependencies

---

### Story 2.2: Home Screen UI

As an authenticated user,
I want to see my current balance and quick-access actions on the home screen,
So that I can orient myself immediately after login and act without navigating away.

**Acceptance Criteria:**

**Given** the home page `/`, **When** rendered, **Then** it displays the authenticated user's current balance as the hero element — prominently positioned and clearly labelled — reading from `useBalanceStore`

**Given** `src/components/ui/AmountDisplay.tsx` exists, **When** passed an integer cents value, **Then** it renders the formatted currency string (e.g., `100000` → `$1,000.00`); this component is used consistently wherever a monetary amount is displayed

**Given** the home page, **When** rendered, **Then** it displays a "Send" button and a "Request" button as large, immediately accessible primary CTAs

**Given** the home page, **When** rendered, **Then** it displays an inbox badge showing the pending incoming request count from `useRequestStore`; the badge is not shown when the count is zero

**Given** a unit test for `AmountDisplay`, **When** run, **Then** it verifies correct cent-to-currency formatting for representative values including zero, round dollars, and dollars with cents

---

### Story 2.3: SSE Connection & Real-Time Updates

As an authenticated user,
I want my balance and inbox badge to update in real time without any page action,
So that changes initiated by other users are immediately visible to me.

**Acceptance Criteria:**

**Given** `src/lib/sse-emitter.ts` exists, **When** imported, **Then** it exports `emit(userId, event)`, `register(userId, writer)`, and `deregister(userId)` functions backed by a `Map<number, WritableStreamDefaultWriter>`

**Given** `GET /api/sse`, **When** called by an authenticated user, **Then** it registers a `WritableStreamDefaultWriter` in the emitter map and holds the connection open with a `text/event-stream` response

**Given** `GET /api/sse`, **When** the client disconnects, **Then** the writer is deregistered from the emitter map

**Given** `src/hooks/use-sse.ts` is mounted inside `Providers.tsx`, **When** a `BALANCE_UPDATED` event arrives, **Then** it calls `useBalanceStore.setBalance()` with the new `balance` value

**Given** `useSSE` receives a `REQUEST_RECEIVED` or `REQUEST_RESOLVED` event, **When** dispatched, **Then** it calls `useRequestStore.setPendingCount()` with the updated count

**Given** the SSE connection drops due to network interruption, **When** connectivity is restored, **Then** the browser's `EventSource` reconnects automatically without user action (FR29)

**Given** an e2e test for the SSE infrastructure, **When** run, **Then** it verifies the connection opens on page load, and reconnects after being dropped

_Note: `emit()` is not called by any money-movement handler until Epic 3. This story proves the infrastructure is correctly wired — live balance and badge updates are the payoff in Epics 3 and 4._
