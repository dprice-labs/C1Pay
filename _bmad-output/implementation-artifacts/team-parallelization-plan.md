# C1Pay — Remaining-Work Parallelization Plan (3 Pairs)

_Generated 2026-06-18. Reworked 2026-06-22 for paired teams. Source of truth for status: `sprint-status.yaml`. Story specs: `epics.md`. Conventions: `architecture.md`._

## 0. Team structure — 3 working pairs

We have consolidated 8 individual developers into **3 paired teams**. Each pair owns a coherent vertical slice and a bounded set of files; within a pair, the two devs split function-level work and self-review.

| Team | Members | Merged to `main` so far |
|---|---|---|
| **P1** | David P. & Sat | **3.3** (real-time recipient balance) + **3.4** (transaction history) |
| **P2** | Vindhya & David S. | **4.1** (requests schema + create-request) — owns Epic 4 internals |
| **P3** | Sagar & Bharat | **5.1** (batch create, PR #21) |

## 1. Scope: what's left

Done: Epic 1, Epic 2, **Epic 3 (all)**, **4.1**, **5.1**.

**8 stories remain:**

| Epic | Stories | Theme |
|---|---|---|
| 4 | 4.2, 4.3, 4.4, 4.5 | Request flow + state machine + real-time |
| 5 | 5.2 | Reset test accounts (CLI) |
| 6 | 6.1, 6.2, 6.3, 6.4 | Accessibility & responsive |
| 7 | 7.1, 7.2 | Learning layer (docs, Phase 2) — **whole team** |

## 2. The honest constraint

**3 pairs cannot finish this 3× faster.** The critical path now runs through the back half of Epic 4:

```
4.2 ──► 4.3 ──┐
              ├──► 4.5
4.4 ──────────┘
```

`4.2 → 4.3 → 4.5` is **3 stories deep** and serial because every Epic 4 story mutates the same three files (`src/lib/requests.ts`, the PATCH route, the `/requests` page). 4.1 already landed the schema, the append-only `requests.ts` skeleton, and the PATCH `action` discriminator, so the foundation is in — but the remaining chain is still serial. No amount of headcount shortens it.

So the plan does two things:
1. **Keeps each pair busy with non-blocking work** around the Epic 4 chain (batch admin, the a11y system + gate).
2. **Holds the clean file-ownership protocols from 4.1** (§6) so the work that *does* overlap (Epic 4 internals, Epic 6 cross-cutting) merges without conflict.

## 3. Dependency graph (remaining stories)

```
4.1 (done) ──► 4.2 Inbox ──► 4.3 Pay/Decline ──┐
        │                                        ├─► 4.5 Real-time
        └──────────────► 4.4 Cancel/Outgoing ───┘

4.1 (done) ──► 5.2 Reset (clears payment_requests table)

feature pages ─► 6.1 Semantic/ARIA/Contrast  ┐
feature pages ─► 6.2 Keyboard                 ├─ verify + harden, run last on each page
feature pages ─► 6.3 Responsive               │
playwright ────► 6.4 axe Gate (scaffold early)┘

all code shipped ─► 7.1 ADRs + 7.2 Concept docs  (whole-team convergence)
```

## 4. The 3 workstreams (owners + file ownership)

Each pair is the **sole writer** of its files; cross-team coordination happens only at the §6 hotspots.

| Team | Workstream | Stories | Owns (sole writer) | Blocked by |
|---|---|---|---|---|
| **P2** (Vindhya & David S.) | **Epic 4 critical path** | **4.2 → 4.3 → 4.5** | `src/lib/requests.ts` (fills inbox/pay/decline + emit wiring), `/(protected)/requests/page.tsx` shell, `RequestCard.tsx`, PATCH pay/decline branches, `use-sse.ts` request payload | 4.4 (for 4.5 only) |
| **P3** (Sagar & Bharat) | **Batch admin + Outgoing** | **5.2**, then **4.4** | `scripts/seed.ts` (entire file), batch tests, `OutgoingRequests.tsx`, PATCH cancel branch | none (5.2); 4.1 done (unblocks 4.4) |
| **P1** (David P. & Sat) | **A11y system & gate** | **6.4, 6.1, 6.2, 6.3** | focus-indicator token in `globals.css`, contrast palette, `(protected)/layout.tsx` landmarks, `tests/e2e` axe + keyboard + responsive specs | feature pages (final sweeps) |

Then **all three pairs converge on Epic 7** (see Wave 3).

**Why these assignments:** P2 wrote 4.1 and owns the requests infrastructure — they carry the serial Epic 4 chain with full context. P3 already has Epic 5 (`seed.ts`); 4.4 is the one Epic 4 story that lives in its own component + PATCH branch, so a second team can take it without racing P2's files. P1 is clear after 3.4 and picks up the cross-cutting a11y system everyone consumes.

## 5. Wave timeline

### Wave 1 — now, everyone busy, zero cross-blocking

- **P2 → 4.2 (inbox)**, then **4.3 (pay/decline)** ⚠️ *critical path — this chain gates 4.5. Land each fast and clean.*
- **P3 → 5.2 (reset)** — 4.1 already shipped the `payment_requests` table, so 5.2 is unblocked now (5.1 merged in PR #21). Then **4.4 (cancel/outgoing)** — coordinate the `/requests` page + PATCH route with P2 (see §6).
- **P1 → 6.4 axe-gate scaffold + 6.1 shared primitives** (focus token, contrast palette, semantic landmarks in the shared `(protected)/layout.tsx`) — foundational, the other pairs consume these. Then **6.2 / 6.3** keyboard + responsive specs against pages that already exist (auth, home, send, history).

### ⏸ Sync Point — **4.3 + 4.4 merged** → unblocks 4.5

### Wave 2 — Epic 4 convergence + a11y hardening

- **P2 → 4.5** (emit wiring into create/pay/decline/cancel; real-time inbox + balance) — final Epic 4 integration.
- **P3** finishes 5.2 if still open; reviews Epic 4 PRs; begins helping with page-level a11y verification.
- **P1 → 6.1 final sweep + 6.4 enforced on all routes** (every page now exists), **6.2 keyboard + 6.3 responsive** across all core flows.

### Wave 3 — Learning Layer (🤝 whole team)

All three pairs come together on **Epic 7** once the product code is shipped and stable:

- **7.1 Architectural Decision Records** — each pair authors the ADRs for the decisions it lived closest to (P2: request state machine + real-time emit; P3: batch admin + idempotent reset; P1: accessibility-first patterns + axe gate). Shared `docs/decisions/` with one ADR per file → no write collisions.
- **7.2 Concept docs** — split the demonstrated-practices write-ups the same way, each pair documenting the code it shipped.
- Convene as one team to reconcile cross-cutting narrative, terminology, and the index so the learning layer reads as a single coherent artifact.

Per-file ownership (one ADR / one concept doc per file) means the whole team can write in parallel without stepping on each other.

## 6. Collision hotspots & merge protocols

The only places independent work can clash. Follow the protocol and merges stay clean. (The 3.3/3.4 and 4.1-schema protocols are now historical — those stories shipped.)

1. **`src/lib/requests.ts`** (4.2, 4.3, 4.4, 4.5) — **append-only / fill-the-stub.** 4.1 landed the file with `createRequest` plus documented stub signatures for `getInboxRequests`, `getOutgoingRequests`, `payRequest`, `declineRequest`, `cancelRequest`. Each story fills its own reserved stub. No reformatting, no reordering.

2. **`src/app/api/requests/[id]/route.ts` PATCH** (4.3 pay/decline, 4.4 cancel) — 4.1 scaffolded the handler with an `action` discriminator (`pay | decline | cancel`) and stub branches. **P2 fills pay/decline, P3 fills cancel.** Different branches → clean merge.

3. **`src/app/(protected)/requests/page.tsx`** (4.2 incoming, 4.4 outgoing) — **P2 owns the page shell** (incoming section + a placeholder slot). **P3 delivers a self-contained `<OutgoingRequests/>` component** that P2 slots in. P3 never edits the page shell directly.

4. **Epic 6 cross-cutting (every page + `globals.css`)** — highest risk. Rules:
   - Feature pairs **build accessibility in as they go** (semantic HTML, keyboard operability, ARIA, `AmountDisplay` alt text) per the always-on rules in `CLAUDE.md`. P1's Epic 6 then **verifies and hardens** — it does not retrofit from scratch.
   - **P1 owns `globals.css`** focus-indicator token + contrast palette (landed Wave 1). Everyone consumes the token; **no per-page `outline` or colour overrides.**
   - Page-level 6.1/6.2/6.3 passes run **after** each feature page merges — sequence per page, don't race the same file.

5. **`scripts/seed.ts`** (5.1, 5.2) — single owner (P3). No cross-team conflict.

6. **`src/lib/schemas.ts`, `src/db/index.ts` barrel** — additive; later Epic-4 stories only add new schema exports.

7. **`docs/decisions/*`, `docs/concepts/*`** (7.1, 7.2) — one file per ADR / concept; each pair writes its own files. Reconcile the index together at the end.

## 7. Definition of done (every story)

- Tests at the correct pyramid level (unit = no DB/network; integration = real DB; e2e = browser) per the story's ACs.
- New axe-core violations are **build failures**, not warnings (once 6.4's gate is live).
- Branch named `story/<id>-<slug>`; PR to `main`; **never commit to `main`** (per `CLAUDE.md`).
- `sprint-status.yaml` updated: `backlog → in-progress → review → done`.
- Deferred items appended to `deferred-work.md` during code review.

## 8. One-line summary

The plan is **critical-path-bound, not headcount-bound.** **P2** drives the serial Epic 4 chain (4.2 → 4.3 → 4.5), **P3** runs batch admin + the parallel 4.4 branch, **P1** builds and enforces the accessibility system around them. One sync point — **4.3 + 4.4 merged** — gates 4.5. Then **all three pairs converge on the learning layer (Epic 7).**
