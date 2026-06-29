---
baseline_commit: 3ce1993
---

# Story 8.3: Add Mandatory Accessibility Task to BMad Story Template

Status: backlog

## Story

As a developer implementing a story that introduces new UI,
I want the BMad dev-story agent to always include a mandatory accessibility task,
so that axe scans, keyboard assertions, and ARIA checks are built into every story from the start — not retrofitted in a separate sweep.

## Context

Stories 4.3, 4.4, and 4.5 each introduced interactive UI (Pay/Decline/Cancel buttons, the NSF alert, the outgoing-requests section, real-time inbox updates) and went green through the Docker gate without ever being axe-scanned in their non-empty states. Story 6.5 was the cleanup. That pattern — build features, skip a11y verification, accumulate debt, write a sweep story — is structural. The root cause is that the dev-story template has no mandatory accessibility checklist.

This story adds one. The change is entirely in the BMad template override — no application code is touched.

## Acceptance Criteria

1. **Given** `_bmad/custom/bmad-dev-story.toml` is updated, **When** the dev-story agent implements a story that introduces new UI (new pages, routes, interactive components, or new conditional states on existing pages), **Then** the story's Tasks/Subtasks section includes an explicit accessibility task as the final implementation task.

2. **Given** the mandatory accessibility task, **Then** it requires all of the following to be checked before the story's status moves to `review`:
   - An axe scan (`AxeBuilder`) for each new route or conditional state the story introduces, gated behind a `ready` locator unique to that state.
   - For each new interactive element: keyboard reachability with a visible focus indicator.
   - For each new interactive element: meaningful accessible name (via visible text, `aria-label`, or `aria-labelledby` — not an icon without a label).
   - For each new state or status indicator: state conveyed by text or icon, never colour alone.
   - Where SSE-driven UI updates are introduced: an `aria-live` region is verified or added.

3. **Given** a story that introduces no UI (pure service layer, database schema, migration, script, or configuration change), **Then** the accessibility task is omitted — the rule is scoped to stories with new user-facing surfaces.

4. **Given** the rule is added to `persistent_facts` in `_bmad/custom/bmad-dev-story.toml`, **When** the `bmad-dev-story` skill activates, **Then** the agent applies the rule without requiring an explicit user prompt at story-generation time.

5. **Given** the rule is documented as a file reference (rather than an inline string), **Then** the referenced file (`_bmad/custom/accessibility-story-checklist.md`) exists, is clear enough for a dev-story agent to generate a concrete task list, and is committed to the repository alongside the template update.

## Tasks / Subtasks

- [ ] **Task 1: Draft `_bmad/custom/accessibility-story-checklist.md`**
  - [ ] Write the checklist file. It must be self-contained: a dev-story agent with no prior context should be able to read it and produce a concrete, fully specified accessibility task block for any UI-introducing story.
  - [ ] Include: the scope rule (UI-only; omit for non-UI stories), the required sub-items (axe scan per route/state, focus/keyboard per interactive element, ARIA name per interactive element, colour-not-alone per status indicator, aria-live per SSE update), and the gate condition ("all items must be checked before status moves to `review`").
  - [ ] Include a template task block that the dev-story agent can adapt verbatim:
    ```
    - [ ] **Task N: Accessibility verification (must be completed before review)**
      - [ ] Axe scan (`AxeBuilder`) for each new route and conditional state — gate behind a `ready` locator unique to that state (not just the route); assert zero WCAG 2.1 AA violations.
      - [ ] For each new interactive element: assert keyboard reachability and a visible focus indicator.
      - [ ] For each new interactive element: assert its accessible name is conveyed by visible text or `aria-label`/`aria-labelledby` — not by icon alone.
      - [ ] For each new status or state indicator: assert the state is conveyed by text or a labelled icon — not colour alone.
      - [ ] [If the story introduces SSE-driven UI updates] Assert the updating region carries `aria-live` so screen-reader users are notified.
    ```

- [ ] **Task 2: Update `_bmad/custom/bmad-dev-story.toml`**
  - [ ] Add the checklist file as a `persistent_facts` entry so it is loaded on activation:
    ```toml
    persistent_facts = [
      "file:{project-root}/_bmad/custom/accessibility-story-checklist.md",
    ]
    ```
    (The base `customize.toml` already carries `"file:{project-root}/**/project-context.md"`. Per BMad array-merge rules, adding `persistent_facts` in the custom override appends to the base — it does not replace it.)

- [ ] **Task 3: Verify — UI story**
  - [ ] Activate `bmad-dev-story` on a hypothetical story that introduces new UI (e.g., a draft story adding a confirmation dialog). Confirm the generated Tasks/Subtasks includes an accessibility task with all required sub-items.

- [ ] **Task 4: Verify — non-UI story**
  - [ ] Activate `bmad-dev-story` on a hypothetical story that is purely backend (e.g., a new service function with integration tests only). Confirm the generated Tasks/Subtasks does NOT include an accessibility task.

## Dev Notes

### Files changed

| File | Change |
|---|---|
| `_bmad/custom/accessibility-story-checklist.md` | Created — the checklist document |
| `_bmad/custom/bmad-dev-story.toml` | Updated — adds `persistent_facts` entry referencing the checklist |

No application code, no test files, no epics.md changes (beyond what Story 8.1/8.2 already added).

### Why `persistent_facts` over `activation_steps_append`

`persistent_facts` are loaded once and stay in scope for the entire dev-story session — the agent applies the rule whenever it encounters a UI-introducing task, without the user having to re-state it. `activation_steps_append` runs as a procedural step (good for one-time setup actions like branch checks); it's less appropriate for a standing rule the agent must apply contextually across story generation.

### BMad array-merge behaviour

From `customize.toml` comments: `arrays (persistent_facts, activation_steps_*): append`. Adding `persistent_facts` in `_bmad/custom/bmad-dev-story.toml` appends to — does not replace — the base template's `persistent_facts`. The base already includes `"file:{project-root}/**/project-context.md"`.

### What the checklist should NOT do

- Do not prescribe specific Playwright test file names or helper implementations — those details live in the story's Dev Notes, not in a standing rule.
- Do not require accessibility task items for non-UI stories — the rule would generate noise for backend-only stories and would be ignored or removed, eroding trust in the template.
- Do not duplicate CLAUDE.md's always-on accessibility rules — the checklist is a *task gate*, not a coding standards document.

### Relationship to CLAUDE.md

`CLAUDE.md` already requires accessibility as always-on for UI code. This story adds the process layer: a checkable task that makes omitting verification a visible, explicit failure — not just a guideline that can go unchecked in the rush to ship.

## Testing Requirements

Manual verification only (Tasks 3 and 4). No automated tests for the template change itself. The acceptance signal is that an activated dev-story agent produces the correct task block for UI stories and omits it for non-UI stories.

## References

- `_bmad/custom/bmad-dev-story.toml` — current team override (activation hook, on_complete)
- `.claude/skills/bmad-dev-story/customize.toml` — base template shape (read-only reference; merge rules documented in comments)
- `CLAUDE.md` § Accessibility — the always-on rules that this story codifies into the process
- Epic 8 goal: `_bmad-output/planning-artifacts/epics.md` § Epic 8
- Story 6.5 Dev Notes: test conventions that the checklist references (axe gate, ready-locator idiom, colour-alone pattern)
