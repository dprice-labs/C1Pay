---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
releaseMode: phased
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-05-14-142342.md'
  - 'README.md'
workflowType: 'prd'
briefCount: 0
researchCount: 0
brainstormingCount: 1
projectDocsCount: 1
classification:
  projectType: web_app
  domain: 'Fintech (Sandbox)'
  purposeClass: 'Reference Implementation / Developer Education'
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - C1Pay

**Author:** David
**Date:** 2026-05-20

## Executive Summary

C1Pay is a sandbox P2P payment web application built as a software engineering reference implementation. The app is fully functional — user registration, send/request money flows, real-time balance sync — but its primary output is not the product itself. It is the preserved reasoning behind it.

Mid-to-senior developers who already know software engineering principles lack access to a full-system artifact that shows those principles *applied, explained, and connected to why* at a readable scale. Production codebases optimize for shipping; the reasoning disappears. Tutorial projects are too simple to surface real tradeoffs. C1Pay occupies the deliberate middle: realistic enough to demonstrate non-trivial patterns, constrained enough to stay legible, and explicitly designed to keep the engineering judgment visible.

### What Makes This Special

**Reasoning is preserved, not just demonstrated.** Every significant architectural decision — SSE over WebSockets, username as the identity primitive, JWT session model, atomic transaction approach — is documented in ADR-style decision records with explicit rationale and citations to authoritative resources. Readers see the decision *and* the argument that produced it.

**Two-layer product.** The working application is the first layer. The second is a structured learning layer: decision files for architectural choices and concept docs that name each engineering principle in play, explain it in context, and link outward to further reading. Together they form a complete teaching artifact.

**Test pyramid as explicit strategy.** The test suite demonstrates the testing pyramid (unit → integration → e2e) as a deliberate pedagogical structure, not incidental coverage. Test naming and organization surface the strategy, making the testing rationale as legible as the code.

**Domain is the vehicle.** The P2P payment domain is chosen for its complexity profile: real enough to surface non-trivial engineering tradeoffs (transaction integrity, real-time sync, auth, state machines), simple enough (fully sandboxed — no real money, no KYC, no banking APIs) to keep the system readable end-to-end.

**DRY as a visible principle.** No duplication in code or tests — demonstrated and deliberate throughout.

### Project Classification

| Attribute | Value |
|---|---|
| **Project Type** | Web Application (Next.js) |
| **Domain** | Fintech (Sandbox) |
| **Purpose Class** | Reference Implementation / Developer Education |
| **Complexity** | Medium — non-trivial data integrity and stateful real-time layer; code clarity is a first-class architectural constraint |
| **Project Context** | Greenfield implementation (stack defined, architecture decided, no code written) |
| **Stack** | Next.js · PostgreSQL · Drizzle ORM · JWT · Vitest |

## Success Criteria

### User Success

A learner who studies C1Pay can:
- Explain what a given software engineering practice is (e.g., the test pyramid, DRY, separation of concerns) after reading the relevant section of the codebase
- Understand how to apply that practice in their own projects, using C1Pay as a worked example
- Follow the reasoning behind major architectural decisions through decision records — understanding the *principle* being applied, not just the technology chosen

Learner success is defined at the practice level, not the technology level. The goal is transferable understanding, not stack fluency.

### Business Success

The enterprise training team can:
- Deliver training sessions using C1Pay as a hands-on reference without supplemental materials
- Point trainees to specific areas of the codebase to illustrate specific practices
- Update the codebase as practices evolve without breaking the teaching structure
- Maintain a functioning application — one that behaves correctly as a payment simulator — so that bugs never become a distraction during training

### Technical Success

- All three levels of the test pyramid (unit → integration → e2e) are implemented, named, and organized to surface the testing strategy explicitly
- Every significant architectural decision has a corresponding decision record with rationale and citations
- Concept docs exist for each practice demonstrated, linking to authoritative external resources for deeper study
- No duplication in application code or test suite — DRY is demonstrably applied throughout
- The application functions correctly as a P2P payment simulator under normal usage

### Measurable Outcomes

| Outcome | Target |
|---|---|
| Decision records | One per significant architectural decision — covering auth model, real-time strategy, transaction integrity, ORM usage, and testing approach at minimum |
| Test pyramid coverage | All three levels present with explicit naming conventions that surface the strategy |
| Concept docs | One per practice demonstrated; each cites at least one authoritative external resource |
| Duplication | Zero duplicate logic in application code or tests |
| Training readiness | A training session can be run end-to-end using only the codebase and its documentation layer |

## User Journeys

### Journey 1: The Facilitator — Running a Training Session

**Persona:** Alex, a senior engineer on the training team, has run C1Pay sessions a dozen times. Today's audience is a cohort of mid-level backend developers who've heard of the test pyramid but have never seen it applied end-to-end in a real system.

**Before the session** — Alex runs the batch script to create test accounts and seed balances. Two minutes, no UI required. The environment is ready.

**Opening the demo** — Alex logs into C1Pay on the projector. Balance is visible on the home screen. Alex explains: "This is a real, working payment app. We're going to use it for about ten minutes, then we're going to spend the rest of the session inside the code."

**The demo** — Alex sends money to a second test account. The balance updates in real time on both screens. Then Alex requests money back — the request appears in the inbox, gets paid, disappears. Declined request next. Cancelled request after that. The state machine plays out visibly in the UI.

**The pivot** — "Now let's look at how that request state machine is actually implemented." The code is open. The session's real work begins.

**Resolution** — By the end, the cohort has seen the practice in action *and* read the code that implements it. The concept doc is open in another tab, citation followed. The principle sticks because they saw it twice — once running, once in source.

*Capabilities revealed: reliable demo environment, real-time UI, pre-session account seeding via batch process, concept docs linked from code.*

---

### Journey 2: App User — Sending Money (Happy Path)

**Persona:** During a demo, a trainee — Jordan — is handed login credentials for a test account with a seeded balance.

**Opening scene** — Jordan logs in. Home screen shows balance and a Send button. No pending requests. Clean state.

**Rising action** — Jordan clicks Send, searches for another test account by username, finds it immediately, enters an amount and a short note, hits Confirm.

**Climax** — The balance drops instantly. On the facilitator's screen showing the recipient account, the balance rises. No page reload. The SSE connection delivered the update in real time.

**Resolution** — Jordan sees the transaction in their history. The facilitator pauses: "Notice what just happened at the data layer. Let's find that in the code." The working feature is now the entry point into the implementation.

*Capabilities revealed: username search, send flow, instant balance update, SSE real-time sync, transaction history.*

---

### Journey 3: App User — Request Flow and State Machine

**Persona:** Same demo session. The facilitator uses two test accounts to walk through the full request lifecycle.

**Opening scene** — Account A requests money from Account B. A note is attached: "For lunch." The request appears immediately in Account B's inbox.

**Rising action** — The facilitator shows Account B's inbox: one pending request, Pay and Decline buttons. Clicks Pay. The balance transfers. Request leaves the inbox.

**The edge cases** — A new request is created. This time, Decline is clicked. Then a third request — cancelled by the requester before the recipient acts. Each transition is explicit: pending → paid, pending → declined, pending → cancelled.

**Resolution** — Four states demonstrated in under two minutes. "Now let's look at the status field on the requests table and the state machine that governs it." The UI made it concrete; the code makes it precise.

*Capabilities revealed: request creation, inbox display, Pay/Decline actions, requester cancellation, status state machine, balance-gated Pay button.*

---

### Journey 4: Developer Trainee — Following a Practice in the Codebase

**Persona:** Sam is a mid-level developer. They understand what unit tests are but have never seen a deliberate testing strategy applied across all three levels in a single codebase.

**Opening scene** — The facilitator opens the test directory. "Before we look at anything else — what do you notice about how the tests are organized?" Sam sees directories labelled by level. Something clicks.

**Rising action** — The facilitator walks through a unit test first: isolated, fast, no database. Then an integration test: a real database transaction, balance atomicity under concurrent writes. Then an e2e test: full flow from login to payment, testing the SSE update lands.

**Climax** — Sam reads the concept doc linked from the test directory. It names the practice, explains the rationale, and cites the source. Sam follows the citation. The principle now has a name, an example, and a pointer to the authoritative resource.

**Resolution** — Sam doesn't just know the tests pass. They know *why* the pyramid is shaped this way and what each level is protecting against. They can explain it. They'll apply it next sprint.

*Capabilities revealed: test pyramid structure, named test organization, concept docs with citations, coverage at all three levels.*

---

### Journey 5: Facilitator — Pre-Session Environment Setup (Batch Admin)

**Persona:** Alex, preparing for a new cohort. The previous session's test accounts need to be reset — balances zeroed and reseeded, transaction history cleared.

**Opening scene** — Alex runs the batch script from the command line. Parameters: number of test accounts, starting balance per account.

**Rising action** — Script creates or resets user accounts, seeds balances, clears transaction and request history. Idempotent — safe to run multiple times.

**Resolution** — Environment is clean and ready in under two minutes. No UI, no dashboard, no approval workflow. Adequate for the training cadence and operationally simple to maintain.

*Capabilities revealed: batch account creation, balance seeding, history reset — CLI/script only, no admin UI required for MVP.*

---

### Journey Requirements Summary

| Journey | Capabilities Required |
|---|---|
| Facilitator running session | Reliable app, real-time UI, concept docs, demo-stable environment |
| Send money (happy path) | Auth, username search, send flow, SSE balance sync, transaction history |
| Request flow + state machine | Request creation, inbox, Pay/Decline/Cancel, status transitions, balance gate |
| Trainee code study | Test pyramid structure, concept docs with citations, named test organization |
| Pre-session batch setup | CLI batch process: account creation, balance seeding, history reset |

## Domain-Specific Requirements

C1Pay operates in the fintech domain by vocabulary and design pattern — not by regulatory obligation. The sandboxed architecture eliminates the compliance surface that defines real fintech products.

### Security Context

Password hashing and JWT token integrity are both functional requirements and demonstrated practices. Specific measurable targets are defined in the Non-Functional Requirements section. No sensitive financial data — account numbers, card numbers, banking credentials — is stored, transmitted, or referenced anywhere in the system. All balances are internal ledger values.

### Data Integrity

- **Atomic transactions** — balance debits and credits execute as a single atomic database operation. Concurrent sends cannot produce inconsistent balance states. Row-level locking is applied at the transaction boundary.
- **No overdraft** — balance sufficiency is enforced at the application layer before any transaction is committed. The Pay action is disabled in the UI when balance is insufficient; a server-side check enforces this independently.

### Compliance

None applicable. C1Pay is not a financial product. It carries no KYC, AML, PCI-DSS, or regional regulatory obligations by design.

### Technical Constraints

- **Local development only** — no enterprise infrastructure, no deployment security requirements, no access control beyond application-level auth.
- **Environment reset capability** — the batch process must create, seed, and reset accounts idempotently. Training sessions depend on a clean, consistent starting state.

## Web Application Specific Requirements

### Project-Type Overview

C1Pay is a Next.js web application — a hybrid SSR/client-side app where rendering mode is chosen deliberately by route, not by default. That choice is itself a teaching moment: auth and initial page load use SSR; interactive payment screens use client-side rendering with SSE for real-time updates. The rendering strategy is a named decision with a corresponding record.

### Browser Support

Modern browsers only. Chrome, Firefox, and Safari at current versions. No legacy browser support. No polyfills for deprecated APIs. This is a local development and training environment — no IE, no compatibility shims.

| Browser | Support |
|---|---|
| Chrome | Current |
| Firefox | Current |
| Safari | Current |
| Legacy / IE | Not supported |

### Responsive Design

Responsive layout is a **demonstrated practice** — not incidental. The mobile-responsive implementation is intentional and named, with a concept doc explaining the approach (CSS strategy, breakpoints, component behavior at different viewports). The app works correctly on mobile viewport sizes. This is part of the learning layer, not just a functional checkbox.

### Accessibility

Accessibility is a **demonstrated practice** — implemented to WCAG AA and named in the learning layer with a concept doc. The implementation explicitly shows semantic HTML structure, ARIA roles and labels, keyboard navigation, focus management, and colour contrast compliance. A reader can study the approach and apply it. A decision record documents the accessibility strategy taken and why WCAG AA was chosen as the target level.

### Real-Time Behavior

SSE (Server-Sent Events) provides real-time balance and inbox updates — server-to-client only. This is a named architectural decision with a full decision record: why SSE was chosen over WebSockets (unidirectional data flow, simpler connection lifecycle, standard HTTP/2, built-in reconnection). The SSE implementation is itself a teaching artifact.

### Performance Targets

Local development environment — no uptime SLAs, no load targets. Performance considerations apply at the code quality level: no N+1 queries, no unnecessary re-renders, efficient SSE fan-out. Good patterns demonstrated; hard performance budgets not required for MVP.

### SEO

Not applicable. No public-facing pages, no marketing content, no search indexing.

### Implementation Considerations

- **Rendering strategy** — SSR for auth and initial load; client-side for interactive screens. Named decision with record.
- **Real-time connection lifecycle** — SSE connections must handle browser tab visibility changes and reconnection gracefully.
- **State management** — balance and inbox state kept in sync with server via SSE; no stale UI after a transaction completes.
- **Form validation** — client-side validation for send/request flows (amount, username); server-side validation is the authoritative check.

## Project Scoping & Phased Development

### Strategy & Philosophy

C1Pay ships in two phases that reflect a clear separation of concerns: first a fully working, well-tested application; then the explanation layer that makes it a complete teaching artifact. Phase 1 is shippable and useful on its own — a training facilitator can demo it and walk through the code. Phase 2 makes it self-explanatory, reducing the facilitator's burden and enabling self-directed study.

Testing is a first-class citizen in Phase 1, not deferred to Phase 2. The test pyramid structure and deliberate test naming are part of the working implementation — the teaching is embedded in how the tests are organised, not in separate documentation.

### Phase 1 — Working App

**Goal:** A fully functional P2P payment simulator with a production-quality test suite and implemented best practices. Ready for training sessions.

**Core User Journeys Supported:**
- Facilitator running a demo session
- App user sending money (happy path)
- App user navigating the request flow and state machine
- Developer trainee reading the test suite
- Facilitator running pre-session batch setup

**Must-Have Capabilities:**

*Application Layer:*
- User accounts (username + password, bcrypt hashing, JWT auth)
- Fixed seeded starting balance
- Send money (username search, amount, optional note, instant transfer)
- Request money (username search, amount, optional note)
- Request inbox (Pay / Decline)
- Cancel outgoing pending requests
- Balance-gated Pay button (client + server enforcement)
- Transaction history (flat chronological list)
- Home screen (balance, inbox badge, Send/Request actions)
- Real-time sync via SSE (balance and inbox updates)
- Batch admin script (account creation, balance seeding, history reset — idempotent)

*Quality & Practice Layer:*
- Test suite covering all three pyramid levels (unit, integration, e2e)
- Deliberate test naming and organisation that surfaces the testing strategy
- Responsive layout (mobile-first, correct at all viewport sizes)
- Accessibility to WCAG AA (semantic HTML, ARIA, keyboard navigation, focus management, contrast)

**Nice-to-Have for Phase 1:**
- In-app notifications (badge + inbox sufficient; deferred to growth)
- Recent contacts list (username search adequate for Phase 1)
- Transaction filtering (flat list sufficient for Phase 1)

### Phase 2 — Learning Layer

**Goal:** Transform the working codebase into a complete self-documenting teaching artifact. Adds the narration, rationale, and citations that make every design decision legible without a facilitator present.

**Capabilities:**
- ADR-style decision records for all major architectural choices (auth model, SSE vs WebSockets, atomic transactions, ORM boundary, rendering strategy, test pyramid approach, accessibility strategy, responsive approach)
- Concept docs for each demonstrated practice — naming the principle, explaining it in context, linking to authoritative external resources
- Test suite documentation aligned with concept docs

### Risk Mitigation Strategy

**Technical Risks:**
- *Row-level locking in Drizzle ORM* — the ORM abstraction leaks at the transaction boundary; raw SQL (`SELECT ... FOR UPDATE`) will likely be required. Flag this explicitly in implementation — it is itself a teaching moment about ORM limits.
- *SSE fan-out* — notifying recipients when payments land requires either Postgres LISTEN/NOTIFY, an in-process event bus, or a polling loop. Design decision should be made early and documented.
- *SSE reconnection* — connection lifecycle must handle tab visibility changes and network interruptions gracefully; test coverage required.

**Resource Risks:**
- Maintainer team is the training team operating on an organic backlog cadence. Phase 2 completion depends on training team bandwidth, not a fixed delivery date.
- Phase 1 is scoped to be completable without external dependencies or infrastructure.

**Market / Adoption Risks:**
- Not applicable. Internal training tool with a captive audience. No adoption risk.

## Functional Requirements

This is the capability contract for C1Pay. Every capability listed here must be implemented; anything not listed will not exist in the final product.

Phase 2 items are marked **(Phase 2)**.

### User Authentication & Identity

- **FR1:** A new user can register an account with a unique username and password
- **FR2:** A registered user can authenticate with their username and password
- **FR3:** An authenticated user can log out and end their session
- **FR4:** The system enforces authenticated access to all protected routes — unauthenticated requests are rejected
- **FR5:** User passwords are stored using a one-way cryptographic hash — plaintext passwords are never persisted or logged

### Balance Management

- **FR6:** A new user account is assigned a fixed starting balance at registration
- **FR7:** An authenticated user can view their current balance
- **FR8:** The system prevents a user from initiating any payment that would exceed their available balance
- **FR9:** All balance changes are applied atomically — no partial updates are possible under concurrent operations

### Money Movement — Send

- **FR10:** An authenticated user can search for another registered user by username
- **FR11:** An authenticated user can send money to another user by specifying an amount and an optional note
- **FR12:** A sent payment transfers funds immediately with no pending state
- **FR13:** Sender and recipient balances update atomically upon a completed send
- **FR14:** A completed send is recorded in the transaction history of both the sender and recipient

### Money Movement — Request

- **FR15:** An authenticated user can request money from another registered user by specifying an amount and an optional note
- **FR16:** A submitted payment request appears in the recipient's inbox in a pending state
- **FR17:** A recipient can pay a pending request, transferring funds immediately
- **FR18:** A recipient can decline a pending request without transferring funds
- **FR19:** A requester can cancel their own pending request at any time before it is resolved
- **FR20:** A resolved request (paid, declined, or cancelled) is removed from the recipient's active inbox
- **FR21:** The outcome of a resolved request is recorded in both parties' transaction history
- **FR22:** The system prevents a recipient from paying a request when their balance is insufficient

### Activity & History

- **FR23:** An authenticated user can view a chronological list of all their transactions — sends, received payments, paid requests, and declined requests
- **FR24:** Each transaction record displays the counterparty, amount, direction, type, optional note, and timestamp
- **FR25:** An authenticated user can view the count of their pending incoming payment requests

### Real-Time Synchronisation

- **FR26:** An authenticated user's balance updates in real time when funds are sent to them
- **FR27:** An authenticated user's inbox updates in real time when a new payment request is received
- **FR28:** An authenticated user's inbox and balance update in real time when a request they sent is resolved
- **FR29:** The real-time connection re-establishes automatically after a network interruption

### User Interface & Accessibility

- **FR30:** The application is usable at mobile, tablet, and desktop viewport sizes without loss of functionality
- **FR31:** The application meets WCAG AA accessibility standards — including semantic HTML structure, ARIA roles and labels, keyboard navigation, focus management, and colour contrast ratios
- **FR32:** A user can complete all core flows (register, log in, send, request, pay, decline, cancel) using keyboard navigation alone

### Training Environment Administration

- **FR33:** An administrator can create multiple test user accounts in a single batch operation
- **FR34:** An administrator can assign a specified starting balance to all accounts during batch setup
- **FR35:** An administrator can reset account balances and clear transaction and request history for all test accounts
- **FR36:** The batch administration process is idempotent — repeated execution produces the same result without duplicating or corrupting data

### Test Coverage

- **FR37:** The system has unit tests that verify the behaviour of individual components in isolation, without database or network dependencies
- **FR38:** The system has integration tests that verify behaviour across component boundaries, including real database operations and transaction integrity
- **FR39:** The system has end-to-end tests that verify complete user flows from the browser through to the database
- **FR40:** Tests are named and organised by level so that the testing strategy — and which level each test belongs to — is legible to a reader without additional explanation

### Learning Layer *(Phase 2)*

- **FR41:** A reader can access a decision record for each major architectural choice made in the codebase *(Phase 2)*
- **FR42:** Each decision record documents the options considered, the decision made, and the rationale — including the engineering principle being applied *(Phase 2)*
- **FR43:** A reader can access a concept document for each software engineering practice demonstrated in the codebase *(Phase 2)*
- **FR44:** Each concept document explains the practice in the context of the C1Pay implementation and links to at least one authoritative external resource for further reading *(Phase 2)*

## Non-Functional Requirements

### Performance

C1Pay runs in a local development environment. Hard SLAs don't apply, but the demo experience must feel responsive — lag during a live training session breaks the teaching moment.

- Real-time balance and inbox updates reach connected clients within 1 second of the triggering event under local network conditions
- Page loads and route transitions complete within 2 seconds under local development
- No N+1 query patterns — database queries do not scale linearly with result set size

### Security

- User passwords are hashed using bcrypt with a minimum work factor of 12
- JWT tokens carry an explicit expiry; expired tokens are rejected on all protected routes
- JWT token payloads contain no sensitive data beyond the user identifier
- All protected routes reject unauthenticated requests with a 401 response — no silent failures
- No real financial data of any kind (account numbers, card numbers, banking credentials) is stored, transmitted, or referenced anywhere in the system

### Code Quality

Code quality is a first-class NFR for C1Pay — the codebase is itself a teaching artifact, and quality standards are part of what it demonstrates.

- No duplication of business logic — each piece of logic exists in exactly one location in the codebase
- Unit tests cover all business logic functions; integration tests cover all database operations; e2e tests cover all user-facing flows
- Each module is independently readable — a developer should be able to understand a module without cross-referencing unrelated files
- No dead code, unused imports, or commented-out blocks committed to the codebase

### Accessibility

- The application passes WCAG 2.1 AA automated checks — zero automated violations
- All interactive elements are operable via keyboard with visible focus indicators
- All non-text content has appropriate text alternatives
- Colour contrast meets WCAG AA minimums: 4.5:1 for normal text, 3:1 for large text and UI components
