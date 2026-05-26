---
stepsCompleted: [1, 2, 3, 4, 5]
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-20.md'
---

# UX Design Specification C1Pay

**Author:** David
**Date:** 2026-05-26

---

<!-- UX design content will be appended sequentially through collaborative workflow steps -->

## Executive Summary

### Project Vision

C1Pay is a sandbox P2P payment web application whose primary product is preserved engineering reasoning, not the application itself. The UI exists to make abstract software engineering concepts — SSE real-time synchronisation, the request state machine, balance atomicity — visually concrete during live training demonstrations. Every UX decision serves two simultaneous goals: a clean, functional payment experience and a legible teaching artifact that developers will study in code.

### Target Users

Three personas drive the UX design:

| Persona | Role | Primary UX Need |
|---|---|---|
| **Alex** (Facilitator) | Senior engineer running training sessions | Reliability and visual clarity for demo "wow moments" — changes must be unmissable across two screens simultaneously |
| **Jordan** (Demo participant) | Trainee operating the app live during a session | Clarity and predictability — flows are self-evident, no surprises, no cognitive load on the interface |
| **Sam** (Code reader) | Developer studying the implementation | UI structure that maps cleanly to the underlying data model for easy cross-referencing |

### Key Design Challenges

1. **Making real-time changes unmissable** — SSE updates are the centrepiece of the live demo. Balance changes and inbox arrivals must be visually obvious — not subtle — so trainees can observe the mechanism at work across two screens simultaneously.

2. **Request state machine legibility** — The facilitator walks through all four state transitions (pending → paid, pending → declined, pending → cancelled) in under two minutes. Each state needs a distinct, immediately readable visual treatment so the state machine is understood without narration.

3. **Accessibility as a demonstrated practice** — WCAG AA is both a functional requirement and a teaching artifact. The keyboard navigation, focus management, and ARIA structure will be studied in code. The design must be keyboard-first — not keyboard-retrofitted — to serve as a strong teaching example of the principle.

4. **Demo-stable predictability over novelty** — This is not a consumer product competing for engagement. Clean, unsurprising, reliable UX wins. Trainees must not be distracted by the interface during a training session.

### Design Opportunities

1. **State changes as visible events** — Animate balance updates and inbox badge changes in a way that surfaces the SSE delivery — not just the end state, but the *arrival* of the change. This reinforces the teaching moment without requiring the facilitator to explain it.

2. **UI structure that mirrors the data model** — Laying out screens so the visual hierarchy maps directly to the data entities (users, transactions, requests) gives developer trainees a mental model that transfers cleanly to the code.

3. **Keyboard-first by design** — Designing all flows keyboard-first (not retrofitting keyboard support after the fact) produces naturally accessible UX and a stronger, more authentic teaching example of the accessibility practice.

## Core User Experience

### Defining Experience

The primary user action is **Send Money** — the happy path that anchors every training demo. The critical interaction is not the form itself but what happens immediately after: the real-time balance update landing on both screens with no page reload. That SSE delivery is the teaching moment the entire demo is built around. The send flow is the trigger; the visible state change is the payoff.

### Platform Strategy

C1Pay is a web application (Next.js), desktop-primary. Training sessions run on a laptop connected to a projector, making keyboard and mouse the primary input methods. Keyboard-only navigation is a first-class requirement (FR32) — both functionally and as a demonstrated accessibility practice. Responsive design for mobile and tablet viewports is implemented as a deliberate teaching artifact (FR30), not incidental support. No offline functionality is required.

### Effortless Interactions

These interactions must require zero cognitive effort from the user:

- **Username search** — near-instant lookup with no friction; trainees should never hunt for a user
- **Send flow** — three steps maximum: find user → enter amount and optional note → confirm
- **Inbox Pay/Decline** — single-action buttons; no multi-step confirmation needed in a sandboxed environment
- **Real-time updates** — fully automatic; the balance and inbox update without any user action

### Critical Success Moments

1. **The SSE moment** — The recipient's balance visibly updates on screen while the sender's screen simultaneously confirms the transfer. Trainees observe this happening. This is the demo's centrepiece; if the update is imperceptible, the teaching moment is lost.

2. **The balance gate** — The Pay button is clearly disabled — with a visible reason, not just a grey state — when the recipient's balance is insufficient. The enforcement is obvious before any attempt is made.

3. **The state machine walkthrough** — All four request state transitions (pending → paid, pending → declined, pending → cancelled) are demonstrated cleanly in sequence. Each resolved state is visually distinct. The facilitator should not need to narrate what state a request is in.

### Experience Principles

1. **Visibility over subtlety** — State changes are teaching events. Balance updates, inbox arrivals, and request resolutions are designed to be seen — not noticed in passing. Animations surface the mechanism, not just the result.

2. **Flows over features** — The demo follows predictable paths. Design for the journey (login → send → observe SSE → request → resolve), not for isolated screens. Navigation between steps should feel inevitable.

3. **Structure mirrors model** — The UI is a direct rendering of the data model. What a developer sees in the interface — a transaction, a pending request, a balance — maps directly to what they find in the database schema and code. No UI abstractions that obscure the underlying structure.

4. **Keyboard-first by design** — All flows are designed keyboard-first from the outset. This produces naturally accessible UX and a more authentic teaching example of the accessibility practice than retrofitted support would provide.

## Desired Emotional Response

### Primary Emotional Goals

C1Pay's emotional design brief differs from consumer products — the emotions that matter are those that serve the teaching moment.

| Persona | Primary Emotion | Secondary | Avoid |
|---|---|---|---|
| **Facilitator (Alex)** | **Confidence** — "This will work when I need it." | Calm command during the demo | Anxiety about reliability |
| **Demo participant (Jordan)** | **Clarity** — "I know exactly what I'm doing." | Surprise and insight when SSE lands | Confusion about UI state |
| **Code reader (Sam)** | **Insight** — "I see how this works." | Empowerment — "I can apply this." | Frustration at opaque structure |

### Emotional Journey Mapping

- **First encounter** → Orientation. The home screen is immediately legible — balance, actions, inbox badge. Nothing to decode.
- **During the core action** (send or request) → Clarity and control. The user knows exactly what step they're on and what will happen next.
- **The SSE moment** → Surprise shading into insight. The balance update is visible enough to feel almost magical — but the structure makes the mechanism immediately explainable.
- **State machine walkthrough** → Satisfaction from completeness. Each transition is clean and distinct. All four states can be demonstrated without the system resisting.
- **If something goes wrong** → Informed, not lost. Errors are informative. The balance gate is communicated before the user encounters it. No silent failures.
- **Returning to the codebase later** → Recognition. The structure is familiar because the UI was a direct rendering of it.

### Micro-Emotions

- **Confidence vs. confusion** — Critical. During a live demo, any ambiguity about UI state breaks the teaching moment. Every state must be explicit, labelled, and unambiguous.
- **Trust vs. skepticism** — The app must behave correctly every time. A facilitator who has been burned once will hedge during the demo. Reliable, predictable behavior is an emotional requirement, not just a technical one.
- **Insight vs. frustration** — The "aha" moment is the product's core value. If the SSE update is too subtle to see, or a state transition is unclear, the insight does not land.

### Design Implications

| Emotion | Design Approach |
|---|---|
| **Confidence** (facilitator) | Predictable behavior, visible system status at all times, no ambiguous states |
| **Clarity** (demo participant) | Explicit step indicators in flows; action buttons labelled with outcomes ("Send $25", not just "Confirm") |
| **Insight** (SSE moment) | Animate balance change with a brief highlight — draw the eye to the number as it updates |
| **Trust** (all users) | Consistent visual language for states; balance gate communicated before the user hits it; errors with clear recovery paths |
| **Recognition** (code reader) | UI entity names match code and database names — "request" not "payment request", "transaction" not "activity" |

### Emotional Design Principles

1. **Serve the teaching moment, not engagement metrics** — Delight and novelty are not goals. Reliability, clarity, and insight are. Every design decision should ask: does this help or hinder the moment when the concept clicks?

2. **Make system state unmissable** — Facilitators must never wonder what state the app is in. Trainees must never be confused about what just happened. Visible, labelled, unambiguous state at all times.

3. **The interface disappears after the first use** — The goal is for the UI to become invisible once a trainee has used it once, so their full attention can move to the code. Familiarity and predictability serve this better than novelty.

## UX Pattern Analysis & Inspiration

### Inspiring Products Analysis

**Venmo**

Venmo is the category reference for P2P payment UX. Key strengths relevant to C1Pay:

- **Home screen layout** — Balance is the hero element. Primary actions (Pay, Request) are large and top-of-screen. The inbox badge count is immediately visible. This information hierarchy maps directly onto C1Pay's requirements.
- **Send/Request flow structure** — Recipient first → amount + note → confirm. A clean 3-step funnel with no dead ends. The sequencing makes intent unambiguous at every step.
- **Username as the identity primitive** — Venmo normalised searching by username as the standard identity model. C1Pay uses the same approach.
- **Activity feed item design** — Each row carries counterparty, direction indicator, amount, optional note, and timestamp. Scannable, dense, and complete. The direction indicator (sent/received) maps directly to the transaction data model.

Not relevant for C1Pay: the social feed, public/friends activity, privacy toggles, and emoji notes are core to Venmo's product but add cognitive noise to a teaching tool.

**Stripe Dashboard**

Stripe is the reference for state communication and data model transparency. Key strengths:

- **Labelled status badge pattern** — Every object carries an explicit status badge with text and subtle colour (`succeeded`, `pending`, `canceled`). Never colour alone. This is the right model for C1Pay's request inbox — a visible `pending` / `paid` / `declined` / `cancelled` badge on every request, not implied by its position in a list.
- **Entity naming consistency** — Stripe's UI names things exactly as the API and data model name them. What is visible in the dashboard is a direct rendering of the underlying structure. C1Pay should follow the same discipline: `transaction`, `request`, `balance` — matching the database schema precisely.
- **Error message quality** — Stripe identifies the reason for every failure with specificity. When C1Pay's balance gate fires, the message should be explicit: "Insufficient balance — you have $X, this request is for $Y."
- **State machine event timeline** — Stripe shows a mini event log on payment objects (created → processing → succeeded). A simplified version on the C1Pay request object — showing its state transition history — would serve as a natural teaching artifact for the 4-state lifecycle.

### Transferable UX Patterns

**Navigation patterns**
- Venmo's bottom-nav / home-screen layout: balance hero + primary action buttons + badge — adopt directly for the C1Pay home screen

**Interaction patterns**
- Venmo's 3-step send/request funnel (recipient → amount/note → confirm) — adopt directly
- Stripe's labelled status badges on all stateful objects — adopt for all request states in the inbox and history

**Visual patterns**
- Venmo's activity feed row structure (counterparty + direction + amount + note + timestamp) — adopt for transaction history
- Stripe's entity naming convention (UI names match data model names) — adopt as a design-wide discipline

**Teaching-specific patterns**
- Stripe's event timeline → adapted as a simplified request state transition log — surface the state machine visually

### Anti-Patterns to Avoid

- **Status by colour alone** — Relying on red/green to communicate request state is both an accessibility failure and a teaching failure. A developer cannot see "declined" in the source if the UI only shows a red colour.
- **Silent optimistic UI** — Apps that update balances without any visual signal make the SSE delivery invisible. For C1Pay the update must be seen, not inferred.
- **Ambiguous disabled states** — A grey Pay button with no explanation fails the balance gate requirement. The reason must be stated explicitly.
- **Modal confirmation loops** — Multiple "are you sure?" dialogs for sandbox actions create unnecessary friction. One confirmation step in the send/request flow is sufficient.
- **Euphemistic naming** — "Activity" instead of "transactions", "payment" instead of "request". Names must match the data model. Abstractions that obscure the underlying structure undermine the teaching purpose.

### Design Inspiration Strategy

| Action | Source | Pattern | Reason |
|---|---|---|---|
| **Adopt** | Venmo | Home screen layout — balance hero, action buttons, badge | Matches C1Pay's information hierarchy exactly |
| **Adopt** | Venmo | 3-step send/request funnel | Clean, proven, and unsurprising |
| **Adopt** | Venmo | Activity feed row structure | Maps directly to the transaction data model |
| **Adopt** | Stripe | Labelled status badges on all request states | Makes the state machine visible and accessible |
| **Adopt** | Stripe | Entity naming matches data model | Reinforces the "structure mirrors model" experience principle |
| **Adopt** | Stripe | Explicit, specific error messages | Supports the "informed, not lost" emotional goal |
| **Adapt** | Stripe | State machine timeline → simplified request event log | Teaching artifact for the 4-state request lifecycle |
| **Avoid** | — | Social feed and privacy controls | Out of scope; adds cognitive noise to the teaching context |
| **Avoid** | — | Status communicated by colour alone | Accessibility failure and undermines codebase legibility |
| **Avoid** | — | Silent optimistic UI updates | The SSE delivery moment must be visible |
