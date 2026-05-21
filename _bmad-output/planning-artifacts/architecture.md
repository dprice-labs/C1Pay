---
stepsCompleted: [1, 2, 3]
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
