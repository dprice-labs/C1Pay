---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
completedAt: '2026-05-22'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-20.md'
workflowType: 'architecture'
project_name: 'C1Pay'
user_name: 'David'
date: '2026-05-21'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

44 FRs across 10 capability areas (40 Phase 1, 4 Phase 2 — learning layer). Core capability areas: user authentication, balance management, send money, request money, activity/history, real-time synchronisation, UI/accessibility, batch admin, and test coverage. The request flow contains a 4-state state machine (pending → paid | declined | cancelled) which is the primary domain logic artifact.

**Non-Functional Requirements:**

16 NFRs across 4 categories. Architecturally significant:
- SSE latency ≤ 1s for real-time updates (NFR1) — drives fan-out mechanism choice
- bcrypt work factor ≥ 12, JWT with explicit expiry (NFR4–NFR5) — drives auth implementation
- No N+1 queries (NFR3) — drives ORM query design and relationship loading strategy
- Zero duplication of business logic (NFR9) — drives module boundary and service layer design
- WCAG 2.1 AA automated checks (NFR13) — drives component implementation standards

**Scale & Complexity:**

- Primary domain: Full-stack web (Next.js App Router, PostgreSQL)
- Complexity level: Medium — two non-trivial technical concerns (atomic transactions, SSE fan-out) embedded in an otherwise well-understood CRUD + auth system
- Estimated architectural components: ~8 (auth, users, transactions, requests, SSE, batch admin, test infrastructure, learning layer)

### Technical Constraints & Dependencies

- **Stack is fixed:** Next.js · PostgreSQL · Drizzle ORM · JWT · Vitest — no substitutions
- **Local development only** — no deployment infrastructure, no CDN, no cloud services
- **Drizzle ORM boundary leak** — row-level locking (`SELECT ... FOR UPDATE`) requires raw SQL at the transaction boundary; Drizzle's query builder does not expose this directly
- **Phase 2 deferred** — learning layer (FR41–FR44) is post-Phase 1; architecture must accommodate it without requiring retrofitting
- **CLI-only batch admin** — no admin UI for MVP; batch script is a standalone process

### Cross-Cutting Concerns Identified

- **Authentication & route protection** — JWT validation via Next.js middleware (edge); affects every server component and API route
- **Real-time synchronisation** — SSE connection lifecycle and fan-out mechanism affect API route design, server-side event emission, and client-side state management
- **Atomic transaction integrity** — balance debit/credit and request state transitions must execute as single atomic DB operations; affects every money-movement handler
- **Module independence & DRY** — business logic must not be duplicated between route handlers, server components, and batch scripts; a service/domain layer is implied
- **Test infrastructure layout** — three-level pyramid (unit/integration/e2e) must be visible in directory structure without additional explanation

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application — Next.js App Router with PostgreSQL backend. Stack is fixed by the PRD; no technology preference discovery required.

### Starter Options Considered

Single viable option: `create-next-app` (Next.js official initializer). No alternative starters evaluated — the stack constraint eliminates alternatives.

### Selected Starter: create-next-app@16

**Rationale for Selection:**
Official Next.js initializer at the current stable version (16.2.6 as of May 2026). Produces an App Router project with TypeScript, ESLint, and Tailwind CSS — all aligned to C1Pay requirements. No viable alternative given the fixed stack.

**Initialization Command:**

```bash
npx create-next-app@16 c1pay \
  --typescript \
  --app \
  --eslint \
  --tailwind \
  --src-dir \
  --import-alias "@/*"
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
TypeScript with strict mode. All application code, route handlers, and configuration written in TypeScript. No plain JS files in application code.

**Styling Solution:**
Tailwind CSS v4 (bundled with Next.js 16). Demonstrates utility-first CSS as a named practice; responsive design implementation (FR30) naturally expressed through Tailwind breakpoint utilities. A concept doc will name and explain this approach (Phase 2).

**Build Tooling:**
Turbopack as the default dev server (Next.js 16 default). Production builds via `next build` (webpack). No configuration changes needed.

**Testing Framework:**
NOT included in starter. Official Next.js recommendation is Vitest (unit + integration) and Playwright (e2e). Post-scaffold setup required:
- Install: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `@playwright/test`
- Configure three-level pyramid directory structure: `tests/unit/`, `tests/integration/`, `tests/e2e/`
- Separate `vitest.config.ts` (unit + integration) and `playwright.config.ts` (e2e)
- **Constraint:** async Server Components cannot be unit tested with Vitest — they require Playwright e2e tests. This constrains which components can live at which pyramid level.
- This setup is a named architectural decision with its own decision record

**Code Organization:**
`src/` directory layout. App Router conventions govern routing (`src/app/`). Additional directories to be established in the architecture decisions step: `src/lib/` (domain/service logic), `src/db/` (Drizzle schema and client), `src/components/` (React components), `src/types/` (shared TypeScript types).

**Development Experience:**
- Hot reloading via Turbopack dev server
- TypeScript type checking via `tsc`
- ESLint for code quality enforcement (aligned to NFR12)
- Path aliases (`@/*`) for clean imports across the `src/` tree

**Note:** Project initialization using this command is the first implementation story. Vitest + Playwright setup and test pyramid directory structure is the second.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- JWT stored in httpOnly cookie — affects every route handler, middleware, and auth flow
- In-memory event emitter for SSE fan-out — shapes the transaction service and SSE route handler interface
- Raw SQL for row-level locking — affects every money-movement handler (Drizzle limitation)
- Server/Client component rendering boundary — affects every page implementation

**Important Decisions (Shape Architecture):**
- Zustand for global client state — affects all interactive client components
- Domain-split Drizzle schema files — affects the entire database layer
- Zod for validation — affects all route handler inputs and shared TypeScript types
- Route co-location component strategy — affects directory structure throughout
- `{ error, code }` error response shape — affects all route handlers and client error handling
- `drizzle-kit generate` + `drizzle-kit migrate` — defines the development database workflow

**Deferred Decisions (Post-MVP):**
- Token refresh strategy — deferred; single 1-day token used instead (see ADR)
- CI/CD pipeline — not applicable; local development only
- Observability beyond console logging — out of scope for MVP

---

### Data Architecture

**Schema organisation: domain files**
- Decision: Drizzle schema split into domain-scoped files under `src/db/schema/`
- Rationale: At C1Pay's scale (~5 tables), domain files keep each schema module independently readable — a developer can understand `transactions.ts` without opening `users.ts`. Cross-domain foreign key references are resolved via explicit imports.
- Affects: `src/db/schema/users.ts`, `src/db/schema/transactions.ts`, `src/db/schema/requests.ts`

**Migrations: drizzle-kit generate + migrate**
- Decision: `drizzle-kit generate` produces versioned SQL migration files; `drizzle-kit migrate` applies them.
- Rationale: Migration files committed to source control are a teaching artifact — a reader can follow the schema's evolution. `push` is faster for prototyping but produces no history.
- Affects: `drizzle.config.ts`, `src/db/migrations/`

**Validation: Zod**
- Decision: Zod for all input validation at route handler boundaries.
- Rationale: Dominant Next.js ecosystem choice; TypeScript inference from Zod schemas eliminates separate type/validation duplication — one schema serves both purposes. The shared-schema pattern (route validation + inferred TypeScript type from the same Zod definition) is a named teaching moment.
- Affects: All route handlers, shared types

**Row-level locking: raw SQL at transaction boundaries**
- Decision: `SELECT ... FOR UPDATE` issued as raw SQL inside Drizzle transaction blocks.
- Rationale: Drizzle's query builder does not expose row-level locking. Raw SQL is required at the balance debit/credit boundary. This is itself a named teaching moment about ORM abstraction limits.
- Affects: Send money handler, request pay handler

**Database connection: singleton Drizzle client**
- Decision: Single Drizzle client instance exported from `src/db/index.ts`, imported wherever database access is needed.
- Rationale: Prevents connection pool exhaustion in the Next.js dev server hot-reload environment.
- Affects: `src/db/index.ts`, all server-side modules that query the database

---

### Authentication & Security

**JWT storage: httpOnly cookie**
- Decision: JWT issued as a `Set-Cookie` response with `HttpOnly`, `SameSite=Strict`, `Path=/`.
- Rationale: httpOnly cookies are inaccessible to JavaScript, immune to XSS token theft — the correct demonstrated practice for auth token storage. localStorage is an anti-pattern for tokens and is not used.
- Affects: Login route handler, `middleware.ts`, all protected routes

**JWT library: jose**
- Decision: `jose` for JWT signing and verification.
- Rationale: `jose` uses the Web Crypto API and runs in the Next.js edge runtime where `middleware.ts` executes. `jsonwebtoken` is Node.js-only and incompatible with edge middleware.
- Affects: Auth utilities, `middleware.ts`

**Password hashing: bcryptjs, work factor 12**
- Decision: `bcryptjs` (pure JavaScript) at work factor 12.
- Rationale: Zero native dependencies — runs on any machine without build tooling. Work factor 12 meets the NFR and is appropriate for a training environment. Native `bcrypt` is faster but adds setup friction.
- Affects: Registration and login route handlers

**Token strategy: single token, 1-day expiry**
- Decision: Single JWT, 1-day expiry, no refresh token.
- Rationale: Simplifies auth implementation for a sandboxed training tool with no real financial exposure. A refresh token pattern adds meaningful complexity (rotation, server-side storage, refresh endpoint) that is out of scope for Phase 1.
- ⚠️ ADR required: This is a deliberate tradeoff away from production-quality session management. The ADR documents why the simpler approach was chosen and what a production implementation would look like.
- Affects: Login handler, JWT utility, session lifecycle

**Route protection: Next.js middleware.ts**
- Decision: A single `middleware.ts` at the project root intercepts all requests to protected paths, validates the JWT cookie, and redirects unauthenticated requests to `/login`.
- Rationale: Edge middleware provides a single enforcement point for auth — protected routes cannot be accessed without a valid token regardless of how they are reached.
- Affects: `middleware.ts`, all routes under `src/app/(protected)/`

---

### API & Communication Patterns

**API design: REST via Next.js Route Handlers**
- Decision: REST endpoints implemented as Next.js Route Handlers at `src/app/api/[resource]/route.ts`.
- Rationale: REST is the appropriate pattern for this payload complexity. Route Handlers integrate naturally with the App Router and are the teachable standard for Next.js API development.
- Affects: All API routes

**SSE fan-out: in-memory event emitter**
- Decision: A singleton module (`src/lib/sse-emitter.ts`) maintains a `Map<userId, WritableStreamDefaultWriter>`. Transaction handlers call `emit(userId, payload)` after a successful commit; the SSE route handler registers and deregisters writers on connection open/close.
- Rationale: Single-process local development makes in-memory fan-out the correct tool. It is zero-infrastructure, eliminates Postgres LISTEN/NOTIFY complexity, and the emitter-subscriber pattern is itself a named teaching artifact. Postgres LISTEN/NOTIFY would be the right choice for a horizontally-scaled deployment — that tradeoff is documented in the ADR.
- ⚠️ ADR required: Documents the in-memory choice, its single-process constraint, and the production path (Postgres LISTEN/NOTIFY or a message broker).
- Affects: `src/lib/sse-emitter.ts`, all money-movement handlers, `src/app/api/sse/route.ts`

**Error response shape: `{ error, code }`**
- Decision: All error responses use `{ "error": "Human-readable message", "code": "MACHINE_READABLE_CODE" }`.
- Rationale: A stable `code` field decouples client branching logic from error message text — clients can handle `INSUFFICIENT_BALANCE` without string-matching. Error codes are documented as a named set.
- Affects: All route handlers, client-side error handling

---

### Frontend Architecture

**State management: Zustand**
- Decision: Zustand for global client state (current user identity, live balance, pending request count, SSE connection status).
- Rationale: Zustand's minimal API avoids React Context re-render pitfalls at no meaningful complexity cost. Demonstrates a lightweight state management pattern that mid-to-senior readers will encounter in production codebases. The state surface is small enough that React Context would technically suffice — the Zustand choice is itself a named tradeoff worth noting.
- Affects: `src/store/`, all interactive client components

**Component strategy: App Router route co-location**
- Decision: Feature components co-located with their route in `src/app/`. Shared, reusable primitives in `src/components/ui/`.
- Rationale: Aligns with App Router conventions — the route directory is the natural home for components that serve only that route. Shared components are promoted to `src/components/ui/` when referenced from more than one route.
- Affects: All component files, directory structure

**Rendering strategy: Server Components by default**
- Decision: All pages and layouts default to React Server Components. `'use client'` is applied only where interactivity or browser APIs are required (SSE subscription, form state, Zustand access).
- Rationale: Server Components reduce client bundle size and make the server/client boundary a named, visible architectural decision — which is itself a teaching moment. The boundary is documented: auth, initial data load, and static content are server-rendered; payment forms, SSE-driven updates, and interactive actions are client-rendered.
- Affects: Every page and component file

---

### Infrastructure & Deployment

**Database: local PostgreSQL**
- Decision: PostgreSQL installed locally. Connection string provided via `DATABASE_URL` in `.env.local`.
- Rationale: Local PostgreSQL is the straightforward approach for this local-dev-only project.
- Affects: `.env.example`, `src/db/index.ts`, setup documentation

**Environment variables: `.env.local` + `.env.example`**
- Decision: Runtime secrets (`DATABASE_URL`, `JWT_SECRET`) live in `.env.local` (gitignored). `.env.example` is committed to the repository with placeholder values and inline comments documenting each variable's purpose.
- Rationale: `.env.example` is the contract between the repository and its operators — it documents what is required to run the project without exposing secrets. This is the standard production convention demonstrated at project scale.
- Affects: Root `.env.example`, all environment variable references

**Logging: labeled console logger (`src/lib/logger.ts`)**
- Decision: A thin utility wrapping `console` that prefixes output with level and context — e.g. `[INFO] [auth] JWT validated for userId 42`.
- Rationale: Raw `console.log` is unscannable at any volume. A named, importable logger demonstrates the pattern and makes log output readable during development and training sessions — without requiring an external logging library.
- Affects: `src/lib/logger.ts`, all server-side modules

**CI/CD: not applicable**
- Decision: No CI/CD pipeline for Phase 1.
- Rationale: Local development only. No deployment target exists for MVP.

---

### Decision Impact Analysis

**Implementation Sequence:**
1. Local PostgreSQL setup + `.env.local` configuration
2. Drizzle client singleton + domain schema files + Drizzle Kit migration workflow
3. Auth layer — bcryptjs registration/login, jose JWT issuance into httpOnly cookie, `middleware.ts` route protection
4. Core domain services — atomic send/request handlers with raw SQL locking, Zod input validation, `{ error, code }` responses
5. SSE infrastructure — `sse-emitter.ts` singleton, SSE route handler, emitter calls wired into transaction handlers
6. Zustand store + SSE client hook — client-side state wired to SSE stream
7. UI pages — Server Components for layout/initial data, Client Components at interactivity boundaries

**Cross-Component Dependencies:**
- Zod schemas are shared: defined once, used for route handler validation and inferred as TypeScript types in client components
- `sse-emitter.ts` is the coupling point between the transaction service layer and the SSE route handler — both depend on it; nothing else does
- Zustand store is populated by the SSE client hook and read by balance/inbox display components — SSE hook is the single writer
- `middleware.ts` depends on the JWT utility and cookie name constant — both must be stable before any protected route is tested
- `logger.ts` has no dependencies and can be implemented in story 1

## Implementation Patterns & Consistency Rules

### Naming Patterns

**Database (Drizzle + PostgreSQL):**
- Tables: plural snake_case — `users`, `transactions`, `payment_requests`
- Columns: snake_case — `user_id`, `created_at`, `sender_id`, `recipient_id`
- Foreign keys: `{table_singular}_id` — `user_id`, `sender_id`, `recipient_id`
- Indexes: `idx_{table}_{column}` — `idx_users_username`, `idx_transactions_sender_id`
- Enum types: SCREAMING_SNAKE_CASE values — `PENDING`, `PAID`, `DECLINED`, `CANCELLED`

**API Endpoints:**
- Resource paths: plural — `/api/users`, `/api/transactions`, `/api/requests`
- JSON field names: camelCase — `userId`, `createdAt`, `senderName`, `recipientId`
- Query parameters: camelCase — `?fromUserId=1`
- Error codes: SCREAMING_SNAKE_CASE — `INSUFFICIENT_BALANCE`, `USER_NOT_FOUND`, `USERNAME_TAKEN`

**TypeScript / Code:**
- Variables and functions: `camelCase`
- React components: `PascalCase`, files `PascalCase.tsx` — `SendMoneyForm.tsx`
- Utility/lib files: `kebab-case.ts` — `sse-emitter.ts`, `auth-utils.ts`
- Zod schemas: `{noun}Schema` for entity shapes, `{verb}{Noun}Schema` for input validation — `userSchema`, `sendMoneySchema`, `createRequestSchema`
- Zustand stores: `use{Domain}Store` — `useAuthStore`, `useBalanceStore`, `useRequestStore`
- SSE event types: SCREAMING_SNAKE_CASE — `BALANCE_UPDATED`, `REQUEST_RECEIVED`, `REQUEST_RESOLVED`

---

### Structure Patterns

**Service layer (`src/lib/`):**
- One file per domain: `src/lib/transactions.ts`, `src/lib/auth.ts`, `src/lib/requests.ts`, `src/lib/users.ts`
- Service functions contain all business logic; route handlers contain no business logic
- Service functions are plain async functions — no HTTP types, no `Request`/`Response`. The batch admin script calls them directly.
- Signature pattern: `async function sendMoney(senderId: number, recipientId: number, amountCents: number, note?: string): Promise<Transaction>`

**Route handlers (`src/app/api/`):**
- Handle HTTP concerns only: parse body, validate with Zod, call service, return response
- Standard shape:
  ```typescript
  export async function POST(request: Request) {
    const body = await request.json()
    const parsed = sendMoneySchema.safeParse(body)
    if (!parsed.success) return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
    const { userId } = await getAuthUser(request)
    const result = await sendMoney(userId, parsed.data.recipientId, parsed.data.amountCents, parsed.data.note)
    return Response.json(result, { status: 201 })
  }
  ```

**Zustand stores (`src/store/`):**
- One file per domain: `src/store/auth.ts`, `src/store/balance.ts`, `src/store/requests.ts`
- Export the hook directly: `export const useAuthStore = create<AuthState>()(…)`
- Stores are populated by SSE events and initial Server Component data; they are never the source of truth — the database is

**Zod schemas:**
- Co-located with their service file in `src/lib/` or extracted to `src/lib/schemas.ts` if shared across multiple services
- One Zod schema serves dual purpose: runtime validation in route handler + inferred TypeScript type via `z.infer<typeof schema>`

---

### Format Patterns

**Monetary amounts — integer cents throughout:**
- All monetary values stored, transmitted, and held in Zustand as integer cents
- `5000` = $50.00
- DB column type: `integer` (never `decimal`, never `float`)
- Display conversion at render time only: `(cents / 100).toFixed(2)`
- No floating-point arithmetic anywhere in the money path

**API response structure:**
- Success (single resource or action result): direct object, no wrapper
  ```json
  { "balance": 5000, "userId": 42 }
  ```
- Success (list): direct array, no pagination wrapper (Phase 1)
  ```json
  [{ "id": 1, "amount": 500, "note": "lunch" }, …]
  ```
- Error: always `{ "error": "Human-readable message", "code": "ERROR_CODE" }`

**HTTP status codes:**
| Status | When |
|--------|------|
| 200 | Successful GET, or action that returns a result |
| 201 | Resource created (POST that creates) |
| 204 | Action with no return value (logout, cancel request) |
| 400 | Validation failure, malformed request |
| 401 | No valid JWT / unauthenticated |
| 403 | Authenticated but not permitted (e.g. pay someone else's request) |
| 404 | Resource not found |
| 409 | Conflict (username already taken, request already resolved) |
| 500 | Unexpected server error |

**Timestamps:**
- All timestamps: ISO 8601 UTC strings in API responses — `"2026-05-22T10:30:00.000Z"`
- DB column type: `timestamp('created_at', { withTimezone: true }).defaultNow()`
- Never Unix epoch integers in the API

---

### Communication Patterns

**SSE event envelope:**
```typescript
type SSEEvent =
  | { type: 'BALANCE_UPDATED'; data: { balance: number } }
  | { type: 'REQUEST_RECEIVED'; data: { requestId: number; fromUsername: string; amountCents: number; note?: string } }
  | { type: 'REQUEST_RESOLVED'; data: { requestId: number; status: 'PAID' | 'DECLINED' | 'CANCELLED' } }
```
- All monetary fields in SSE payloads are integer cents
- SSE client hook (`useSSE`) dispatches received events to the appropriate Zustand store action

**Zustand update rules:**
- State updates always go through Zustand `set()` — never mutate state directly
- Stores expose named actions alongside state: `const { balance, setBalance } = useBalanceStore()`
- Selectors: use `shallow` from Zustand when selecting object slices to prevent unnecessary re-renders

**Request state machine:**
- PostgreSQL enum type: `request_status` with values `PENDING`, `PAID`, `DECLINED`, `CANCELLED`
- Transitions: `PENDING → PAID` (recipient pays), `PENDING → DECLINED` (recipient declines), `PENDING → CANCELLED` (requester cancels)
- No other transitions are valid; service functions enforce this

---

### Process Patterns

**Auth extraction in route handlers:**
- A shared utility `getAuthUser(request: Request): Promise<{ userId: number }>` reads and verifies the JWT cookie
- All protected route handlers call this at the top before any service call
- `middleware.ts` guarantees the cookie is present on protected routes — `getAuthUser` throws a typed error if the cookie is missing or invalid as a safety net

**Error handling:**
- Service functions throw typed errors: `throw new AppError('Insufficient balance', 'INSUFFICIENT_BALANCE', 400)`
- Route handlers catch `AppError` and convert to HTTP responses; unexpected errors become 500
- A shared `errorResponse(message, code, status)` helper constructs the `{ error, code }` JSON response

**Loading states:**
- `isLoading: boolean` in Zustand stores and local component state (not a status enum — the added states add complexity without benefit at this scale)
- Form submission loading is local component state; global data loading is Zustand store state

**Validation timing:**
- Client-side: immediate feedback on form inputs (Zod on the client using the same schema imported from `src/lib/`)
- Server-side: authoritative check at the route handler boundary before any service call is made — server never trusts client input

---

### Enforcement Guidelines

**All agents MUST:**
- Store and transmit monetary values as integer cents — no exceptions
- Put business logic in `src/lib/` service functions, not in route handlers
- Use the `{ error, code }` error shape for all error responses
- Follow the HTTP status code table above
- Use SCREAMING_SNAKE_CASE for SSE event types and error codes
- Co-locate feature components with their route; promote to `src/components/ui/` only when used in more than one route
- Use `getAuthUser()` in every protected route handler

**Anti-patterns (never do these):**
- Float or decimal for money amounts
- Business logic in route handlers
- `localStorage` for JWT or any auth token
- Direct Zustand state mutation
- `console.log` outside of `logger.ts`
- Validation only on client side — server must always re-validate

## Project Structure & Boundaries

### Complete Project Directory Structure

```
c1pay/
├── .env.example                        # committed — documents required env vars
├── .env.local                          # gitignored — actual secrets
├── .gitignore
├── README.md
├── drizzle.config.ts                   # Drizzle Kit config (DB URL, schema path, migrations path)
├── next.config.ts
├── package.json
├── playwright.config.ts                # e2e test config
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts                    # unit + integration test config
│
├── scripts/
│   └── seed.ts                         # FR33–36: batch admin — create/reset test accounts
│                                       # calls src/lib/ service functions directly, no HTTP
│
├── src/
│   ├── middleware.ts                   # JWT cookie validation, redirect unauthenticated requests
│   │
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx                  # root layout, font, metadata
│   │   │
│   │   ├── (auth)/                     # route group — unauthenticated pages, no layout wrapper
│   │   │   ├── login/
│   │   │   │   └── page.tsx            # FR2: login form (Server Component shell, Client form)
│   │   │   └── register/
│   │   │       └── page.tsx            # FR1: register form
│   │   │
│   │   ├── (protected)/                # route group — requires valid JWT (enforced by middleware)
│   │   │   ├── layout.tsx              # loads initial balance + request count via Server Component
│   │   │   │                           # mounts SSE client hook, wraps with Zustand providers
│   │   │   ├── page.tsx                # home: balance display, inbox badge, Send/Request CTAs
│   │   │   ├── send/
│   │   │   │   ├── page.tsx            # FR10–14: send money page
│   │   │   │   ├── UserSearchInput.tsx # FR10: username search (Client Component)
│   │   │   │   └── SendMoneyForm.tsx   # FR11–13: amount + note + confirm (Client Component)
│   │   │   ├── request/
│   │   │   │   ├── page.tsx            # FR15: create payment request page
│   │   │   │   └── CreateRequestForm.tsx
│   │   │   ├── inbox/
│   │   │   │   ├── page.tsx            # FR16, FR19, FR25: incoming + outgoing pending requests
│   │   │   │   └── RequestCard.tsx     # FR17–18: Pay / Decline actions (Client Component)
│   │   │   └── history/
│   │   │       ├── page.tsx            # FR23–24: transaction history (Server Component)
│   │   │       └── TransactionRow.tsx  # single history entry display
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── register/
│   │       │   │   └── route.ts        # POST — FR1, FR5: create user, hash password
│   │       │   ├── login/
│   │       │   │   └── route.ts        # POST — FR2: verify credentials, issue JWT cookie
│   │       │   └── logout/
│   │       │       └── route.ts        # POST — FR3: clear JWT cookie (204)
│   │       ├── users/
│   │       │   └── search/
│   │       │       └── route.ts        # GET ?username= — FR10: username lookup for send/request flows
│   │       ├── transactions/
│   │       │   └── route.ts            # GET (FR23–24: history), POST (FR11–14: send money)
│   │       ├── requests/
│   │       │   ├── route.ts            # GET (FR16: inbox), POST (FR15: create request)
│   │       │   └── [id]/
│   │       │       └── route.ts        # PATCH (FR17: pay, FR18: decline, FR19: cancel)
│   │       └── sse/
│   │           └── route.ts            # GET — FR26–29: SSE stream, registers writer in sse-emitter
│   │
│   ├── components/
│   │   └── ui/                         # shared primitives, used across ≥2 routes
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Badge.tsx               # inbox count badge
│   │       ├── AmountDisplay.tsx       # renders integer cents as formatted currency
│   │       └── ErrorMessage.tsx
│   │
│   ├── db/
│   │   ├── index.ts                    # singleton Drizzle client (DATABASE_URL from env)
│   │   ├── migrations/                 # generated by drizzle-kit generate, applied by drizzle-kit migrate
│   │   └── schema/
│   │       ├── users.ts                # users table: id, username, password_hash, balance_cents, created_at
│   │       ├── transactions.ts         # transactions table: id, sender_id, recipient_id, amount_cents, note, created_at
│   │       └── requests.ts             # payment_requests table: id, requester_id, recipient_id, amount_cents,
│   │                                   #   note, status (PENDING/PAID/DECLINED/CANCELLED), created_at, resolved_at
│   │
│   ├── lib/
│   │   ├── auth.ts                     # signJwt(), verifyJwt(), getAuthUser(), hashPassword(), verifyPassword()
│   │   ├── transactions.ts             # sendMoney(), getTransactionHistory() — atomic ops, raw SQL locking
│   │   ├── requests.ts                 # createRequest(), payRequest(), declineRequest(), cancelRequest()
│   │   ├── users.ts                    # findByUsername(), createUser(), getUserById()
│   │   ├── sse-emitter.ts              # Map<userId, WritableStreamDefaultWriter>, emit(), register(), deregister()
│   │   ├── errors.ts                   # AppError class, errorResponse() helper
│   │   ├── logger.ts                   # labeled console logger: logger.info(), logger.error(), logger.warn()
│   │   └── schemas.ts                  # Zod schemas: registerSchema, loginSchema, sendMoneySchema,
│   │                                   #   createRequestSchema, resolveRequestSchema
│   │
│   ├── store/
│   │   ├── auth.ts                     # useAuthStore: { user, setUser, clearUser }
│   │   ├── balance.ts                  # useBalanceStore: { balanceCents, setBalance }
│   │   └── requests.ts                 # useRequestStore: { pendingCount, setPendingCount }
│   │
│   └── types/
│       └── index.ts                    # shared TypeScript types: User, Transaction, PaymentRequest, SSEEvent
│
├── tests/
│   ├── unit/                           # FR37: isolated, no DB, no network
│   │   ├── lib/
│   │   │   ├── transactions.test.ts    # sendMoney() business logic, balance validation
│   │   │   ├── requests.test.ts        # state machine transitions, guard conditions
│   │   │   └── auth.test.ts            # JWT sign/verify, password hashing
│   │   └── store/
│   │       └── balance.test.ts         # Zustand store actions
│   │
│   ├── integration/                    # FR38: real DB, real Drizzle queries
│   │   ├── transactions.test.ts        # atomic balance transfer under concurrent writes
│   │   ├── requests.test.ts            # full request lifecycle in DB
│   │   └── auth.test.ts                # user creation, credential verification
│   │
│   └── e2e/                            # FR39: full browser flows via Playwright
│       ├── auth.spec.ts                # register → login → logout
│       ├── send-money.spec.ts          # send flow, balance update visible in UI
│       ├── requests.spec.ts            # request lifecycle: pay, decline, cancel
│       └── realtime.spec.ts            # SSE: balance and inbox update without page reload
│
└── public/
    └── favicon.ico
```

---

### Architectural Boundaries

**HTTP boundary — Client ↔ Route Handlers:**
- All client-server communication over JSON REST + SSE
- Route handlers in `src/app/api/` handle parse → validate → call service → respond
- No business logic crosses this boundary into the client

**Auth boundary — Edge ↔ Node.js:**
- `src/middleware.ts` runs at the edge: reads JWT cookie, validates signature, redirects on failure
- `src/lib/auth.ts` runs in Node.js runtime: bcryptjs hashing, JWT issuance (only at login/register)
- Cookie name and JWT secret are shared constants — defined once, imported by both

**Service boundary — Route Handlers ↔ `src/lib/`:**
- Route handlers call service functions; service functions never import from `src/app/`
- `scripts/seed.ts` also calls service functions directly — this is why services have no HTTP types
- DB access only happens inside `src/lib/` functions — route handlers never import from `src/db/`

**SSE boundary — Transaction Service ↔ Browser:**
- `src/lib/sse-emitter.ts` is the sole coupling point between transaction/request services and the SSE route
- After any money-movement commit, the service calls `emit(userId, event)` — it has no knowledge of HTTP or SSE internals
- `src/app/api/sse/route.ts` owns the connection lifecycle; `sse-emitter.ts` owns the fan-out registry

**Data boundary — `src/lib/` ↔ PostgreSQL:**
- All DB access through the singleton Drizzle client from `src/db/index.ts`
- Schema definitions in `src/db/schema/` are the single source of truth for table shape
- Raw SQL used only at row-level locking boundaries inside Drizzle transaction blocks

---

### FR-to-Structure Mapping

| FR Group | Capability | Primary Location |
|---|---|---|
| FR1–5 | Auth & identity | `src/lib/auth.ts`, `src/app/api/auth/`, `src/middleware.ts` |
| FR6–9 | Balance management | `src/db/schema/users.ts` (balance_cents), `src/lib/transactions.ts` |
| FR10–14 | Send money | `src/lib/transactions.ts`, `src/app/api/transactions/`, `src/app/(protected)/send/` |
| FR15–22 | Request flow + state machine | `src/lib/requests.ts`, `src/app/api/requests/`, `src/app/(protected)/request/`, `src/app/(protected)/inbox/` |
| FR23–25 | Activity & history | `src/lib/transactions.ts`, `src/app/api/transactions/`, `src/app/(protected)/history/` |
| FR26–29 | Real-time SSE | `src/lib/sse-emitter.ts`, `src/app/api/sse/`, `src/store/balance.ts`, `src/store/requests.ts` |
| FR30–32 | UI & accessibility | All page and component files; Tailwind responsive utilities |
| FR33–36 | Batch admin | `scripts/seed.ts` → `src/lib/users.ts` |
| FR37–40 | Test pyramid | `tests/unit/`, `tests/integration/`, `tests/e2e/` |

---

### Data Flow

**Send money flow:**
```
Client POST /api/transactions
  → route.ts: parse + Zod validate + getAuthUser()
  → transactions.sendMoney(): DB transaction (SELECT FOR UPDATE → debit → credit → insert)
  → sse-emitter.emit(recipientId, BALANCE_UPDATED)
  → sse/route.ts: pushes event to recipient's open SSE connection
  → recipient's useBalanceStore: updates balanceCents
  → AmountDisplay re-renders with new balance
```

**SSE connection lifecycle:**
```
(protected)/layout.tsx mounts → useSSE hook → GET /api/sse
  → sse/route.ts: registers WritableStreamDefaultWriter in sse-emitter Map
  → browser tab close / navigate away → ReadableStream cancel signal
  → sse/route.ts: deregisters writer from Map
```

## Architecture Validation Results

### Coherence Validation

**Decision Compatibility:** All technology choices are compatible. `jose` runs in the Next.js edge runtime used by `middleware.ts`; `bcryptjs` runs in the Node.js runtime used by auth route handlers — the runtimes are correctly matched to their tools. Zustand, Zod, and Tailwind all function as expected in Next.js App Router with TypeScript strict mode. No version conflicts identified.

**Pattern Consistency:** The service layer boundary is internally consistent — `src/lib/` functions have no HTTP types, which enables both route handlers and `scripts/seed.ts` to call them directly. Zod schemas serve dual purpose (validation + TypeScript inference) as designed. Integer cents is applied uniformly across DB schema, API responses, SSE events, and Zustand state.

**Structure Alignment:** The `(protected)` route group and `middleware.ts` are correctly aligned — middleware enforces the auth boundary before any protected route handler runs. The SSE emitter singleton is correctly scoped to a single module, keeping the coupling surface minimal.

---

### Requirements Coverage Validation

**Functional Requirements (Phase 1, FR1–FR40):** All 40 FRs have explicit architectural support and a named location in the project structure. FR9 (atomic balance operations) is covered by the Drizzle transaction + raw SQL locking decision. FR29 (SSE reconnection) is handled by the browser's native `EventSource` reconnection behaviour with no additional infrastructure required.

**Non-Functional Requirements:**
- NFR1 (SSE ≤ 1s): In-memory emitter delivers events synchronously after DB commit — well within target
- NFR3 (no N+1): Service layer boundary enforces query discipline; Drizzle explicit joins
- NFR4 (bcrypt ≥ 12): bcryptjs at work factor 12 — documented in auth decisions
- NFR5 (JWT explicit expiry): 1-day expiry with jose — documented in auth decisions
- NFR9 (DRY): Service layer + shared Zod schemas — zero logic duplication by design
- NFR12 (ESLint): Provided by `create-next-app` initializer
- NFR13 (WCAG AA): Component implementation standard; enforced at story level

---

### Clarifications Added During Validation

**`src/hooks/use-sse.ts` — added to structure:**
The SSE client hook lives at `src/hooks/use-sse.ts`. It opens an `EventSource` to `/api/sse`, parses incoming `SSEEvent` payloads, and dispatches to Zustand stores (`useBalanceStore.setBalance`, `useRequestStore.setPendingCount`). It is mounted once inside `Providers.tsx`.

**`(protected)/Providers.tsx` — added to structure:**
`(protected)/layout.tsx` is a Server Component — it cannot mount hooks or use Zustand. The solution is a `Providers.tsx` Client Component (`'use client'`) that receives initial balance and pending count as props from the Server Component layout, seeds the Zustand stores with those values, and mounts `useSSE`. The layout renders:
`<Providers initialBalance={balance} initialPendingCount={count}>{children}</Providers>`

---

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

---

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Clean service layer enables the batch admin script to share all domain logic with route handlers — DRY is architectural, not aspirational
- In-memory SSE emitter is correctly scoped to a single-process local dev environment; the production path (Postgres LISTEN/NOTIFY) is documented in the ADR
- Integer cents enforced at every layer eliminates an entire category of financial calculation bugs
- Zod schemas shared between server validation and TypeScript types eliminate the common drift between runtime validation and compile-time types
- Test pyramid directories are first-class structure, not an afterthought — FR37–40 have explicit file homes

**Areas for Future Enhancement:**
- Token refresh strategy — deliberately deferred (ADR documents the tradeoff and the production path)
- SSE fan-out would need Postgres LISTEN/NOTIFY for horizontal scaling beyond single process
- Logging could be upgraded to a structured library (e.g. pino) for production observability

---

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented in this file
- Use the implementation patterns section as the authoritative style guide
- Respect the service layer boundary — no business logic in route handlers
- Refer to the FR-to-structure mapping when determining where new code belongs

**First Implementation Story:**
```bash
npx create-next-app@16 c1pay \
  --typescript \
  --app \
  --eslint \
  --tailwind \
  --src-dir \
  --import-alias "@/*"
```
Second story: install and configure Vitest + Playwright, establish the three-level test pyramid directory structure (`tests/unit/`, `tests/integration/`, `tests/e2e/`).
