---
stepsCompleted: [1, 2, 3, 4]
inputDocuments: []
session_topic: 'Simple Venmo-style P2P payment app MVP'
session_goals: 'Define MVP scope, core features, UX flows, and technical approach for send/request payment functionality'
selected_approach: 'ai-recommended'
techniques_used: ['First Principles Thinking', 'SCAMPER Method', 'Constraint Mapping']
ideas_generated: 22
session_active: false
workflow_completed: true
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** David
**Date:** 2026-05-14

## Session Overview

**Topic:** Simple Venmo-style P2P payment app MVP
**Goals:** Define MVP scope, core features, UX flows, and technical approach for send/request payment functionality

### Session Setup

Focused MVP definition session. User wants a simple Venmo-style app with core send/request payment functionality and minimal scope beyond that.

**Key Constraint Established Early:** Sandboxed application — no real bank connections. Users have a fixed seeded starting balance. All transfers are internal ledger operations. This eliminated compliance, KYC, and banking API complexity entirely.

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Simple Venmo-style P2P payment app MVP with focus on defining what's truly essential for v1

**Recommended Techniques:**
- **First Principles Thinking:** Strip assumptions from existing payment apps and rebuild from fundamentals
- **SCAMPER Method:** Systematically scope the product — identify what to Substitute, Combine, Adapt, Modify, Eliminate, or Reverse
- **Constraint Mapping:** Separate real blockers from imagined ones to find the fastest path to shipping

---

## Technique Execution Results

### Technique 1: First Principles Thinking — COMPLETE

**Focus:** Strip away assumptions from existing payment apps and identify what's truly essential for v1.

#### Ideas Generated

**[Core #1]**: Identity — Both People Must Be "Known"
*Concept:* For a transfer to happen, the system needs to know who Person A and Person B are. An "account" encodes identity + a payment method in one object. Both users require accounts.
*Novelty:* Minimum viable identity is a username — no phone number lookup, no contact syncing, no email matching complexity required.

**[Core #2]**: Money Must Exist Before It Can Move
*Concept:* Person A must have funds accessible to the system. In this app, that means a seeded starting balance — a number in a database, not a bank connection. A payment is a debit from one balance and a credit to another.
*Novelty:* Eliminates the hardest parts of fintech (KYC, banking APIs, compliance, fraud). The entire backend is essentially: `users`, `balances`, and `transactions`.

**[Core #3]**: The Request as the Transaction Trigger
*Concept:* A request initiates the payment flow — Person B triggers an action that lands in Person A's inbox, awaiting resolution. This is the "pull" direction of money movement.
*Novelty:* Anchoring the MVP on the request flow makes the interaction intentional and structured.

**[Core #4]**: The App is a Ledger, Not a Bank Bridge
*Concept:* No real money moves. The system maintains internal balances for each user, starting at a seeded amount. A "payment" is a ledger entry: debit sender, credit receiver.
*Novelty:* Eliminates compliance, KYC, fraud, and banking API complexity entirely.

**[Core #5]**: Username as the Identity Primitive
*Concept:* Users are found and addressed by username. At signup, a user picks a unique handle — that's their address in the system. Search works by matching username.
*Novelty:* Simple, unambiguous identity. No phone syncing, no email lookup.

**[UX #1]**: Request Inbox Model
*Concept:* Person A has an inbox of pending payment requests. Each request shows who sent it, how much, and two actions: Pay or Decline. No social feed — just a task list of money owed.
*Novelty:* Framing requests as an inbox makes the UI action-oriented. Requests don't disappear until resolved.

**[UX #2]**: Directed Search to Initiate a Request
*Concept:* Person B searches a user directory by username to find Person A, then submits an amount and optional note. The system routes that request to Person A's inbox.
*Novelty:* Username is the single identity lookup mechanism — simple, unambiguous, no external data required.

**[UX #3]**: Send Flow as Request Mirror
*Concept:* Person A searches for Person B by username, enters an amount and optional note, and confirms. Money moves immediately — no pending state, no approval needed. Person B is notified.
*Novelty:* Structurally identical to request but unilateral and instant. Same UI skeleton, fundamentally different consequences.

**[UX #4]**: Request State Machine — Three Terminal States
*Concept:* A request is created as `pending`, then transitions to either `paid` or `declined`. Once resolved, it leaves Person A's inbox permanently. Person B is notified on either outcome.
*Novelty:* Clear lifecycle: created → pending → resolved. Simple `status` field on the requests table. Nothing lingers ambiguously.

**[UX #5]**: Notifications as the Feedback Loop
*Concept:* Person B receives an in-app notification when their request is paid or declined. Person B receives a notification when money is sent to them proactively. Closes the loop without requiring constant checking.
*Novelty:* Deferred to MVP+ — in-app badge and activity list are sufficient for v1.

**[UX #6]**: Balance-Gated Pay Action
*Concept:* The Pay button is disabled when Person A's balance is insufficient to cover the request amount. The system prevents the action entirely. Balance is always visible so users can self-regulate.
*Novelty:* No error states, no partial payments, no overdraft logic. Constraint surfaced proactively.

**[UX #7]**: Dual-Surface Home Screen
*Concept:* The home screen shows balance prominently AND surfaces pending requests via a badge/notification indicator. Balance answers "what do I have?" and the badge answers "what needs my attention?"
*Novelty:* Neither balance-first nor inbox-first — both coexist. The app functions as a financial task manager.

**[UX #8]**: Proactive Send — No Request Required
*Concept:* A dedicated Send action lets Person A push money to Person B without waiting for a request. Person A searches by username, enters amount + optional note, confirms — money moves instantly.
*Novelty:* Makes the app symmetric. Requests are "pull" money; sends are "push" money.

**[UX #9]**: Transaction History as Activity Feed
*Concept:* A chronological log of all money movement — sends, received payments, paid requests, declined requests. Each entry shows who, how much, when, direction (in/out), and any attached note.
*Novelty:* Doubles as a system audit trail — users can verify every balance change.

**[UX #10]**: Optional Note on Requests
*Concept:* When Person B submits a request, they can attach a short optional note. The note travels with the request and appears in Person A's inbox and both parties' transaction history.
*Novelty:* One text field adds enormous social context without adding complexity.

**[UX #11]**: Notes on Both Send and Request
*Concept:* Every money action — whether a proactive send or a payment request — supports an optional short note. The note appears in the recipient's notification and in both parties' transaction history.
*Novelty:* Notes travel with money in both directions.

---

### Technique 2: SCAMPER Method — COMPLETE

**Focus:** Systematically stress-test the feature set — what to cut, simplify, add, or lock in.

#### Ideas & Decisions

**[SCAMPER-E #1]**: Eliminate In-App Notifications → Backlog
*Concept:* Remove notifications from v1. Users check their inbox and transaction history manually. The pending request badge on the home screen provides passive awareness.
*Novelty:* Forces the inbox to be the single source of truth. Simpler to build, no read/unread state to manage.

**[SCAMPER-C #1]**: Keep Send and Request as Separate Flows — Decision
*Concept:* Despite sharing the same UI skeleton, Send and Request serve distinct intents. Combining them risks confusing two fundamentally different actions.
*Novelty:* Separation reinforces clarity — the user always knows exactly what action they're taking.

**[SCAMPER-S #1]**: Recent Contacts List → MVP+
*Concept:* A list of previously transacted users for one-tap access, replacing cold username search for repeat interactions.
*Novelty:* Dramatically reduces friction for the common case (paying the same people repeatedly) without changing the identity model.

**[SCAMPER-A #1]**: Tap-Only Interactions — Decision
*Concept:* Swipe gestures for Pay/Decline deferred. All actions are explicit taps in v1.
*Novelty:* Simpler interaction model, ships faster, avoids gesture conflict edge cases.

**[SCAMPER-M #1]**: Flat List + Plain Balance — Decision
*Concept:* Transaction history is a flat chronological list. Balance is a plain number. No filtering, grouping, or trend indicators in v1.
*Novelty:* Add visual hierarchy only when users demonstrate a need to navigate a growing list.

**[SCAMPER-P #1]**: Home Screen Stays Focused — Decision
*Concept:* Transaction history lives only on its own dedicated screen. Home screen remains balance + inbox badge + Send/Request actions only.
*Novelty:* Each screen has one job — home is for awareness and quick actions, history is for lookup.

**[SCAMPER-R #1]**: Requester Can Cancel Pending Requests — v1
*Concept:* Person B can cancel a request they've sent, as long as it's still pending. The request is removed from Person A's inbox and marked cancelled.
*Novelty:* Gives the requester agency after submission. Prevents bad requests from sitting in someone's inbox indefinitely.

---

### Technique 3: Constraint Mapping — COMPLETE

**Focus:** Separate real blockers from imagined ones. Find the fastest path to shipping.

#### Constraint Analysis

| Constraint | Classification | Resolution |
|---|---|---|
| Authentication | Real, Solvable | Username + password, session token — standard auth |
| Balance integrity | Real, Solvable | Atomic DB transactions with row-level locking |
| Compliance / KYC | **Imagined** | Fully eliminated by sandboxed design decision |
| Real-time UI sync | Real, **Solved** | Server-Sent Events (SSE) — server→client push over HTTP/2 |
| Starting balance | Real, **Solved** | Fixed amount assigned to all users at signup |
| Username uniqueness | Real, Solvable | DB unique constraint + async validation on signup form |
| Balance-drop scenario | Real, **Solved** | Pay-time balance check + SSE keeps UI current |

**SSE chosen over WebSockets** because the app only needs server→client updates. SSE is simpler to scale, uses standard HTTP/2, has built-in reconnection, and requires no WebSocket state management.

---

## Idea Organization and Prioritization

### Thematic Clusters

**Theme 1: Core Architecture (The Ledger)**
- Sandboxed internal ledger — no real money, no banking APIs
- Users, balances, transactions as the entire data model
- Username as the identity primitive
- Fixed starting balance for all users
- Atomic DB transactions for balance integrity

**Theme 2: Money Flow UX (Send & Request)**
- Send: search by username → amount + optional note → instant transfer
- Request: search by username → amount + optional note → pending in recipient's inbox
- Send and Request kept as separate flows (intentional UX clarity)
- Balance-gated Pay button (disabled if insufficient funds)
- Requester can cancel pending requests

**Theme 3: Inbox & Resolution**
- Request inbox as task list — Pay or Decline
- Request state machine: pending → paid | declined
- Cancelled state for requester-initiated cancellations
- Inbox clears on resolution

**Theme 4: Home Screen & Navigation**
- Dual-surface home: balance + inbox badge + Send/Request actions
- Home screen stays focused — no activity preview
- Transaction history on dedicated screen (flat chronological list)
- Plain balance number (no trends or indicators)

**Theme 5: Technical Infrastructure**
- SSE for real-time balance and inbox sync
- Standard username + password auth with session token
- DB unique constraint + async validation for usernames

### v1 Feature Set — Final

| Feature | Status |
|---|---|
| User accounts (username + password) | v1 |
| Fixed starting balance | v1 |
| Send money (username search + amount + optional note) | v1 |
| Request money (username search + amount + optional note) | v1 |
| Request inbox (Pay / Decline) | v1 |
| Balance-gated Pay button | v1 |
| Cancel outgoing pending requests | v1 |
| Transaction history (flat chronological list) | v1 |
| Home screen (balance + inbox badge + Send/Request) | v1 |
| Real-time sync via SSE | v1 |
| Tap-only interactions | v1 |

### MVP+ Backlog

| Feature | Rationale for Deferral |
|---|---|
| In-app notifications | Badge + inbox sufficient for v1; adds read/unread complexity |
| Notify on request cancellation | Depends on notification system |
| Recent contacts list | Username search works for v1; contacts reduce friction at scale |
| Swipe gestures (Pay/Decline) | Added complexity; tap-only ships faster |
| Transaction filtering (All/Sent/Received) | Flat list sufficient until volume demands it |
| Balance trend indicator | Plain number sufficient for v1 |
| Mini activity feed on home screen | Home screen discipline maintained for v1 |

### Implied Data Model

```
users
  id, username (unique), password_hash, balance, created_at

requests
  id, from_user_id, to_user_id, amount, note, status (pending/paid/declined/cancelled), created_at, resolved_at

transactions
  id, from_user_id, to_user_id, amount, note, type (send/request_payment), request_id (nullable), created_at

notifications [MVP+]
  id, user_id, message, read, created_at
```

---

## Session Summary and Insights

**Total Ideas Generated:** 22 across 3 techniques
**Techniques Used:** First Principles Thinking, SCAMPER Method, Constraint Mapping
**Session Duration:** Full three-technique session with checkpoint

### Key Achievements

- Defined a tight, shippable v1 with zero ambiguity about what's in or out
- Eliminated an entire category of complexity (banking/compliance) via the sandboxed design decision
- Resolved all 7 identified constraints — no unresolved blockers to shipping
- Built a clean MVP+ backlog that preserves good ideas without polluting v1

### Breakthrough Moments

- **Sandboxed ledger insight:** Recognizing the app as a pure ledger (not a bank bridge) was the session's biggest unlock — it eliminated the hardest problems in fintech
- **SSE over WebSockets:** Choosing SSE based on the unidirectional nature of the updates — a nuanced technical decision that will simplify the backend considerably
- **Cancel outgoing requests (SCAMPER-R):** Emerged from reversing the request flow assumption — a small feature with high user value that would have been easy to miss
- **Home screen discipline:** Consistently deferring "nice to have" home screen additions keeps the core interaction clean

### Your Next Steps

1. **Choose your tech stack** — the data model is clear; pick your backend language, framework, and database
2. **Scaffold the project** — users, requests, and transactions tables are your foundation
3. **Build auth first** — username + password + session token before any money movement
4. **Implement Send before Request** — it's simpler (no pending state) and validates your ledger logic
5. **Add SSE last** — build the core flows with polling or manual refresh first, then layer in real-time
6. **Reference this document** when scoping sprints — the v1/MVP+ split is your scope boundary
