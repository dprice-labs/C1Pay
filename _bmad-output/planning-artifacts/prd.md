---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation']
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
**Date:** 2026-05-18

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

## Product Scope

### MVP — Minimum Viable Product

**Application layer:**
- User accounts (username + password, fixed starting balance)
- Send money (username search, amount, optional note — instant transfer)
- Request money (username search, amount, optional note — pending inbox)
- Request inbox (Pay / Decline actions)
- Cancel outgoing pending requests
- Balance-gated Pay button (disabled on insufficient funds)
- Transaction history (flat chronological list)
- Home screen (balance, inbox badge, Send/Request actions)
- Real-time sync via SSE

**Learning layer:**
- ADR-style decision records for all major architectural choices
- Concept docs for each demonstrated practice, with citations
- Test suite structured to demonstrate the full testing pyramid (unit, integration, e2e)

### Growth Features (Post-MVP)

- In-app notifications (push pending requests and payment receipts)
- Recent contacts list (reduce friction for repeat interactions)
- Transaction filtering (All / Sent / Received)
- Additional practice demonstrations as training program needs expand
- Expanded concept doc library as new topics are added to training curriculum

### Vision

C1Pay is a living training artifact — updated continuously as software engineering practices evolve, new technologies become relevant, and the training team's curriculum grows. There is no terminal version; the codebase stays current with the state of the art the team wants to teach.

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

C1Pay operates in the fintech domain by vocabulary and design pattern — not by regulatory obligation. The sandboxed architecture eliminates the compliance surface that defines real fintech products. What remains is a small set of security and integrity requirements that apply on their own merit, several of which are themselves practices being demonstrated by the codebase.

### Security

- **Password hashing** — user credentials are hashed using bcrypt (or equivalent). Plaintext passwords are never stored or logged. This is both a functional requirement and a demonstrated practice.
- **JWT integrity** — tokens are signed, carry appropriate expiry, and contain no sensitive payload data. Token validation is enforced on all protected routes. Demonstrated as a named practice with a decision record.
- **No sensitive financial data** — the system stores no real account numbers, card numbers, or banking credentials. All balances are internal ledger values. This constraint is structural and permanent.

### Data Integrity

- **Atomic transactions** — balance debits and credits execute as a single atomic database operation. Concurrent sends cannot produce inconsistent balance states. Row-level locking is applied at the transaction boundary. This is the primary fintech-pattern technical requirement that genuinely applies to C1Pay.
- **No overdraft** — balance sufficiency is enforced at the application layer before any transaction is committed. The Pay action is disabled in the UI when balance is insufficient; a server-side check enforces this independently.

### Compliance

None applicable. C1Pay is not a financial product. It carries no KYC, AML, PCI-DSS, or regional regulatory obligations by design.

### Technical Constraints

- **Local development only** — no enterprise infrastructure, no deployment security requirements, no access control beyond application-level auth. The app runs in a local dev environment for training sessions.
- **Environment reset capability** — the batch process must be able to create, seed, and reset accounts idempotently. Training sessions depend on a clean, consistent starting state.
