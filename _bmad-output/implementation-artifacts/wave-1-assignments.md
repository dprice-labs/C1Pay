# C1Pay — Wave 1 Assignments

_Generated 2026-06-22. Full plan: `team-parallelization-plan.md`. Status source of truth: `sprint-status.yaml`._

## Assignments

| Team | Members | Now → Next | Why |
|---|---|---|---|
| **P2** | Vindhya & David S. | **4.2 → 4.3** (then 4.5) | They wrote 4.1 and own `requests.ts` + the PATCH handler — they carry the serial Epic 4 chain with full context. |
| **P3** | Sagar & Bharat | **5.2 → 4.4** | Already own `seed.ts` (5.1); 5.2 is now unblocked. 4.4 lives in its own component + PATCH branch, so they progress Epic 4 without racing P2's files. |
| **P1** | David P. & Sat | **6.4 + 6.1 → 6.2/6.3** | Clear after 3.4. Build the a11y system everyone consumes (axe gate, focus token, landmarks) first, then verify/harden each page. |

**Sync point:** 4.3 + 4.4 merged → unblocks 4.5 (P2).
**Then:** all three pairs converge on the learning layer (Epic 7).

**Core logic:** critical-path-bound, not headcount-bound — P2 drives the serial Epic 4 chain, P3 and P1 run fully independent tracks (batch admin, accessibility) around it.
