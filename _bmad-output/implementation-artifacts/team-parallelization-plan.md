# C1Pay — Remaining-Work Parallelization Plan (Team of 8)

_Generated 2026-06-18. Source of truth for status: `sprint-status.yaml`. Story specs: `epics.md`. Conventions: `architecture.md`._

## 1. Scope: what's left

Done: Epic 1 (all), Epic 2 (all), Epic 3.1, 3.2. In review: **3.3** (real-time recipient balance — merge this first; it's the gate for 3.4).

**14 stories remain:**

| Epic | Stories | Theme |
|---|---|---|
| 3 | 3.4 | Transaction history |
| 4 | 4.1, 4.2, 4.3, 4.4, 4.5 | Request flow + state machine + real-time |
| 5 | 5.1, 5.2 | Batch admin (CLI) |
| 6 | 6.1, 6.2, 6.3, 6.4 | Accessibility & responsive |
| 7 | 7.1, 7.2 | Learning layer (docs, Phase 2) |

## 2. The honest constraint

**8 people cannot finish this 8× faster.** The critical path runs through Epic 4:

```
4.1 ──► 4.2 ──► 4.3 ──┐
   │                  ├──► 4.5
   └──► 4.4 ──────────┘
```

`4.1 → 4.2 → 4.3 → 4.5` is **4 stories deep** and serial because every Epic 4 story mutates the same three files (`src/lib/requests.ts`, the PATCH route, the `/requests` page). No amount of headcount shortens it.

So the plan does two things:
1. **Front-loads all genuinely independent work** (history, batch admin, docs, a11y system/gate) into Wave 1 so nobody waits on Epic 4.
2. **Assigns clean file ownership** so the work that *does* overlap (Epic 4 internals, Epic 6 cross-cutting) merges without conflict.

## 3. Dependency graph (all remaining stories)

```
3.3 (review) ──► 3.4 History                         [transactions.ts read path]

(nothing) ─────► 4.1 Requests Foundation ──► 4.2 Inbox ──► 4.3 Pay/Decline ──┐
                      │                                                       ├─► 4.5 Real-time
                      └──────────────────────► 4.4 Cancel/Outgoing ──────────┘

users (done) ──► 5.1 Batch Create
4.1 ───────────► 5.2 Reset (needs payment_requests table to clear)

feature pages ─► 6.1 Semantic/ARIA/Contrast  ┐
feature pages ─► 6.2 Keyboard                 ├─ verify + harden, run last on each page
feature pages ─► 6.3 Responsive               │
playwright ────► 6.4 axe Gate (scaffold early)┘

decisions (done) ► 7.1 ADRs        (zero code dependency — docs only)
code exists ─────► 7.2 Concept docs (references final code)
```

## 4. The 8 workstreams (owners + file ownership)

Each dev owns a coherent vertical slice and a **bounded set of files**. "Owns" = sole writer; others coordinate via the protocols in §6.

| Dev | Workstream | Stories | Owns (sole writer) | Starts | Blocked by |
|---|---|---|---|---|---|
| **D1** | History | 3.4 | `/(protected)/history/*`, `GET /api/transactions` branch | after 3.3 merges | 3.3 |
| **D2** | Requests Core (critical-path lead) | **4.1**, then **4.5** | `src/db/schema/requests.ts`, migration, `/(protected)/request/*`, `src/lib/requests.ts` (skeleton + signatures), `src/hooks/use-sse.ts` request payload | **immediately** | none (4.1); 4.3+4.4 (4.5) |
| **D3** | Inbox / Resolve | 4.2, 4.3 | `/(protected)/requests/page.tsx` (shell), `RequestCard.tsx`, PATCH pay/decline branches | after 4.1 | 4.1 |
| **D4** | Outgoing / Cancel | 4.4 | `OutgoingRequests.tsx` component, PATCH cancel branch | after 4.1 | 4.1 |
| **D5** | Batch Admin | 5.1, 5.2 | `scripts/seed.ts` (entire file), batch integration tests | 5.1 immediately; 5.2 after 4.1 | 4.1 (5.2 only) |
| **D6** | Learning Layer | 7.1, 7.2 | `docs/decisions/*`, `docs/concepts/*` | **immediately** | none |
| **D7** | A11y System & Gate | 6.1, 6.4 | focus-indicator token in `globals.css`, contrast palette, `tests/e2e` axe helper + gate | gate/tokens immediately; sweep last | feature pages (final sweep) |
| **D8** | Keyboard & Responsive | 6.2, 6.3 | `tests/e2e` keyboard + responsive specs | harness immediately vs existing pages | feature pages (full coverage) |

Load is balanced: D2 bookends Epic 4 (hardest), D3 carries two coupled Epic-4 stories, everyone else has 1–2 stories plus support time.

## 5. Wave timeline (two sync points)

### Wave 0 — now
- Merge **3.3** (in review). This is the only thing gating 3.4.

### Wave 1 — everyone busy, zero cross-blocking
- **D2 → 4.1** ⚠️ *top priority — it unblocks D3, D4, and D5's second story. Land it fast and clean.*
- **D1 → 3.4** (branch after 3.3 merges)
- **D5 → 5.1** (only needs `createUser`, already done)
- **D6 → 7.1** (all decisions already captured in `architecture.md`; pure `docs/`)
- **D7 → 6.4 gate scaffold + 6.1 shared primitives** (focus token, palette, semantic landmarks in the shared `(protected)/layout.tsx`) — foundational, others consume these
- **D8 → keyboard/responsive e2e harness** run against pages that already exist (auth, home, send)
- **D3 / D4 holding work** (no requests.ts dependency): build `RequestCard.tsx` / `OutgoingRequests.tsx` as standalone components against mock data + the status-badge primitive. Real, mergeable progress while 4.1 lands.

### ⏸ Sync Point 1 — **4.1 merged** → unblocks 4.2, 4.4, 5.2

### Wave 2
- **D3 → 4.2** (inbox) then **4.3** (pay/decline)
- **D4 → 4.4** (cancel/outgoing) — coordinate the `/requests` page + PATCH route with D3 (see §6)
- **D5 → 5.2** (reset — can now clear `payment_requests`)
- **D1** finishes 3.4 → joins Epic 6 page verification or assists 7.2
- **D2** preps 4.5 (write the two-client `realtime.spec.ts`, design emit wiring) — can't merge until 4.3+4.4 land; reviews Epic 4 PRs meanwhile
- **D6 → 7.2**
- **D7** wires axe gate to each page as it merges; page-level 6.1 contrast/semantic checks
- **D8** runs 6.2/6.3 against now-stable pages (home, send, history, request)

### ⏸ Sync Point 2 — **4.3 + 4.4 merged** → unblocks 4.5

### Wave 3 — convergence & hardening
- **D2 → 4.5** (emit wiring into create/pay/decline/cancel; real-time inbox + balance) — final Epic 4 integration
- **D7 → 6.1 final sweep + 6.4 enforced on all routes** (every page now exists)
- **D8 → 6.2 keyboard + 6.3 responsive across all core flows**
- **D6** finalizes docs against shipped code
- Everyone else: review, integration tests, bugfix

## 6. Collision hotspots & merge protocols

These are the only places independent work can clash. Follow the protocol and merges stay clean.

1. **`src/lib/requests.ts`** (4.1, 4.2, 4.3, 4.4, 4.5) — **append-only.** 4.1 lands the file with `createRequest` **plus documented (stubbed) signatures** for `getInboxRequests`, `getOutgoingRequests`, `payRequest`, `declineRequest`, `cancelRequest`. Each later story fills its own function. No reformatting, no reordering — every dev appends or fills a reserved stub.

2. **`src/app/api/requests/[id]/route.ts` PATCH** (4.3 pay/decline, 4.4 cancel) — **4.1 scaffolds the handler** with an `action` discriminator (`pay | decline | cancel`) and three stub branches. D3 fills pay/decline, D4 fills cancel. Different branches → clean merge.

3. **`src/app/(protected)/requests/page.tsx`** (4.2 incoming, 4.4 outgoing) — **D3 owns the page shell** with an incoming section + a placeholder slot. D4 delivers a self-contained `<OutgoingRequests/>` component that D3 slots in. D4 never edits the page shell directly.

4. **`src/lib/transactions.ts`** (3.3 emit wiring, 3.4 read path) — merge **3.3 first**, then D1 appends `getTransactionHistory`. Distinct functions; no overlap.

5. **Epic 6 cross-cutting (every page + `globals.css`)** — highest risk. Rules:
   - Feature devs **build accessibility in as they go** (semantic HTML, keyboard operability, ARIA, `AmountDisplay` alt text) per the always-on rules in `CLAUDE.md`. Epic 6 then **verifies and hardens** — it does not retrofit from scratch.
   - **D7 owns `globals.css`** focus-indicator token + contrast palette (landed Wave 1). Everyone consumes the token; **no per-page `outline` or colour overrides.**
   - Page-level 6.1/6.2/6.3 passes run **after** each feature page merges — sequence per page, don't race the same file.

6. **`scripts/seed.ts`** (5.1, 5.2) — single owner (D5). No cross-dev conflict.

7. **`src/db/index.ts` barrel, `src/types/index.ts`, `src/lib/schemas.ts`** (4.1 adds requests schema/type/Zod) — additive; 4.1 owns these edits, later Epic-4 stories only add new schema exports.

## 7. Definition of done (every story)

- Tests at the correct pyramid level (unit = no DB/network; integration = real DB; e2e = browser) per the story's ACs.
- New axe-core violations are **build failures**, not warnings (once 6.4's gate is live).
- Branch named `story/<id>-<slug>`; PR to `main`; **never commit to `main`** (per `CLAUDE.md`).
- `sprint-status.yaml` updated: `backlog → in-progress → review → done`.
- Deferred items appended to `deferred-work.md` during code review.

## 8. One-line summary

The plan is **critical-path-bound, not headcount-bound.** Get **4.1 merged first** (D2), run History / Batch / Docs / A11y-harness fully in parallel around it (D1, D5, D6, D7, D8), then push Epic 4 through its serial chain (D2→D3→D4→D2) while Epic 6 verifies each page as it stabilizes. Two sync points: **4.1 merged**, then **4.3+4.4 merged**.
