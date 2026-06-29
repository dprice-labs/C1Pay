# Accessibility Testing: Structural Deficiency and Remediation Plan

## The Problem

The current test suite organises accessibility coverage by *dimension* — `accessibility.spec.ts`, `keyboard.spec.ts`, `responsive.spec.ts` — rather than by *feature*. This means accessibility verification is decoupled from feature development: a developer ships a feature, writes tests in the feature's spec file, and relies on a separate periodic sweep to cover accessibility. The sweep only catches what someone remembered to add to a static list.

Three weaknesses compound each other:

**1. Hardcoded route list.** The axe gate scans a fixed set of routes. Any route added by a feature story is not automatically included. Someone must explicitly update a separate file they may never look at during feature development.

**2. State-blind scanning.** The gate hits each route in its default state, which is usually the least interesting one. Conditional UI — action buttons, error alerts, populated lists, dialogs — only renders under specific data conditions and is invisible to a scan of the empty state. A page can pass the axe gate with zero violations while its most interactive state has never been scanned.

**3. No CI enforcement.** There is no GitHub Actions workflow. The Docker e2e gate is required by the BMad story convention but has no infrastructure backing it. A PR can be merged without the gate running.

## Evidence: The Epic 4 Incident

Stories 4.3, 4.4, and 4.5 added Pay/Decline/Cancel buttons, the NSF insufficient-balance alert, the lifecycle indicator, and the real-time inbox. Every story ran `test:e2e:docker` and went green. The axe scan ran on every one of those Docker runs — and passed — because it hit `/inbox` in its empty state. None of the new interactive controls were ever scanned by axe until Story 6.5 explicitly seeded data and added a populated-inbox scan after the fact.

Story 6.5 existed solely to catch what the Epic 4 stories should have verified themselves. The pattern — build features, skip a11y verification, accumulate debt, write a sweep story to clean up — is structural, not accidental.

## Proposed Solution

### 1. Co-locate accessibility coverage with feature tests

Each feature spec file owns the axe scans, keyboard assertions, aria-live checks, and colour-alone verifications for the routes and states it introduces:

| Feature spec | Owns |
|---|---|
| `auth.spec.ts` | `/login` + `/register` axe scans |
| `send.spec.ts` | `/send` empty + combobox-expanded axe scans; keyboard send flow; mobile overflow |
| `inbox.spec.ts` | `/inbox` empty, populated-incoming, populated-outgoing axe scans; NSF alert text; badge text; keyboard pay/decline/cancel; focus-after-resolve; mobile overflow |
| `realtime.spec.ts` | `aria-live` structural assertions + live-update tests |
| `history.spec.ts` | `/history` axe scan |

### 2. Delete the three dimension-based spec files

Once coverage is migrated, `accessibility.spec.ts`, `keyboard.spec.ts`, and `responsive.spec.ts` are deleted. There is no content in these files that belongs to "accessibility in general" rather than to a specific feature. Their existence creates the impression that accessibility is a separate concern handled elsewhere — which is exactly the wrong mental model.

### 3. Add a mandatory a11y task to every story template

The BMad story template should require, for any story that introduces UI:

- An axe scan (`AxeBuilder`) for each new route or conditional state
- Behavioral assertions for any new interactive element: focus management, ARIA labels, keyboard operability, colour-not-alone
- These tasks must be checked before the story can move to review

### 4. Add GitHub Actions CI

A workflow that runs `test:e2e:docker` (or an equivalent Playwright job) on every PR. This turns "Docker gate green" from a convention enforced by the BMad story process into infrastructure that blocks merge.

## Before / After

| Before | After |
|---|---|
| New feature ships; axe scan updated maybe, in a separate file, by a later sweep story | New feature ships; axe scan is part of the feature's spec, written at the same time |
| Coverage grows through periodic sweep epics (time-lagged, easy to defer) | Coverage grows automatically with every feature story |
| Three dimension files require explicit updates whenever a feature adds UI | No such files — nothing to forget |
| Gate is process-enforced (BMad convention only) | Gate is infrastructure-enforced (CI blocks merge) |
| Empty-state scan can green while populated-state UI is never scanned | Feature spec owns all states its feature introduces |

---

## BMad Prompt

Paste the following into a BMad session to generate the epic and stories:

---

```
I want to create a new epic to restructure how accessibility testing is organised in this codebase.

## Background

The current test suite has three dimension-based spec files: `accessibility.spec.ts`,
`keyboard.spec.ts`, and `responsive.spec.ts`. These were created as part of Epic 6, which
was a post-hoc accessibility sweep over the features built in Epics 1–5. The problem is
structural: accessibility verification is decoupled from feature development. Developers
ship features, the Docker gate runs green (because the axe scan hits routes in their empty
state), and the new interactive UI is never scanned. A periodic sweep story has to catch
the gap. Epic 4 (Pay/Decline/Cancel, SSE inbox) is the concrete example: three stories
went green through the Docker gate while Pay/Decline/Cancel buttons, the NSF alert, and
the lifecycle indicator were never axe-scanned. Story 6.5 was the cleanup.

## Desired end state

1. Every feature spec file (`auth.spec.ts`, `send.spec.ts`, `inbox.spec.ts`,
   `realtime.spec.ts`, `history.spec.ts`) owns the axe scans, keyboard assertions,
   aria-live checks, and colour-alone verifications for the routes and states its feature
   introduces. Coverage lives next to the feature it tests.

2. `accessibility.spec.ts`, `keyboard.spec.ts`, and `responsive.spec.ts` are deleted.
   All their tests are migrated into the appropriate feature spec files first. The total
   test count stays the same — this is a reorganisation, not a deletion of coverage.

3. The BMad dev-story template (`_bmad/custom/bmad-dev-story.toml` or equivalent story
   template file) includes a mandatory accessibility task for any story that introduces UI:
   axe scan for each new route/state, behavioral assertions for new interactive elements.
   This task must be checked before the story moves to review.

4. A GitHub Actions workflow runs `playwright test` (against a production build) on every
   pull request, so the axe gate is infrastructure-enforced rather than process-enforced.

## Stories to create

Please create an epic with the following stories:

**Story X.1 — Migrate accessibility coverage into feature spec files**
Move all tests from `accessibility.spec.ts`, `keyboard.spec.ts`, and `responsive.spec.ts`
into their natural feature spec homes. Migrate, do not delete, until the suite is green.
Confirm `test:e2e:docker` passes with the same test count after migration.
Delete the three source files only once everything is green.

Mapping:
- login/register axe scans → `auth.spec.ts`
- `/send` axe scans + keyboard send flow + mobile overflow → `send.spec.ts`
- all inbox tests (axe empty + populated, NSF alert, badge text, keyboard pay/decline/cancel,
  focus-after-resolve, mobile overflow) → `inbox.spec.ts`
- aria-live structural + live-update tests → `realtime.spec.ts`
- `/history` axe scan → `history.spec.ts`
- `/request` axe scan + keyboard request flow → `request.spec.ts`

**Story X.2 — Add GitHub Actions CI for the e2e gate**
Create `.github/workflows/e2e.yml` that runs the Playwright suite on every pull request
against a production build (`next build && next start`). The job must block merge on
failure. Use the Docker Compose e2e setup already in the repo
(`docker-compose.e2e.yml`) or run Playwright directly with a Postgres service container.

**Story X.3 — Add mandatory accessibility task to BMad story template**
Update the BMad dev-story template so every story that introduces UI includes a required
accessibility task:
- Add axe scan (`AxeBuilder`) for each new route or conditional state
- Add behavioral assertions for new interactive elements (focus, ARIA labels, keyboard,
  colour-not-alone)
- Task must be checked before story moves to review status

Please generate the epic file and story files with full ACs and tasks following the
existing epics.md and story file conventions in this project.
```
