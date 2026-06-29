---
baseline_commit: 3ce1993
---

# Story 8.2: Add GitHub Actions CI for the E2E Gate

Status: backlog

## Story

As a maintainer,
I want a GitHub Actions workflow that runs the full Playwright suite on every pull request,
so that the axe gate is infrastructure-enforced and a PR can never merge with a WCAG AA violation or a broken e2e test.

## Context

There is currently no GitHub Actions workflow in the repository. The Docker e2e gate (`npm run test:e2e:docker`) is required by the BMad story process but has no infrastructure backing it — a PR can be merged without the gate running. This story adds `.github/workflows/e2e.yml`, turning "Docker gate green" from a convention into a hard infrastructure requirement.

## Acceptance Criteria

1. **Given** a pull request targeting `main`, **When** the PR is opened or updated (including `synchronize` and `reopened` events), **Then** the workflow at `.github/workflows/e2e.yml` triggers automatically.

2. **Given** the workflow runs, **Then** it:
   - Starts a Postgres service container (`postgres:18-alpine`, matching `docker-compose.e2e.yml`) so the full stack is available without Docker-in-Docker.
   - Installs Node.js dependencies (`npm ci`).
   - Installs Playwright browsers (`npx playwright install --with-deps chromium`).
   - Runs database migrations (`npm run db:migrate`).
   - Builds a production Next.js bundle (`npm run build`).
   - Starts the app in production mode (`npm run start`) and waits for it to be ready on port 3000.
   - Runs the full Playwright suite (`npm run test:e2e`).

3. **Given** all tests pass and zero axe violations are detected, **Then** the job exits `0`, the required status check passes, and the PR is unblocked for merge.

4. **Given** any test fails or any axe violation is detected, **Then** the job exits non-zero, the required status check fails, and the PR is blocked from merging.

5. **Given** the workflow, **Then** the `test-results/` directory (Playwright failure screenshots and traces) is uploaded as a job artifact on failure so failures are diagnosable without re-running locally.

6. **Given** the workflow, **Then** `node_modules` is cached keyed to `package-lock.json` (using `actions/cache`) to reduce wall-clock time on repeat runs.

## Tasks / Subtasks

- [ ] **Task 1: Create `.github/workflows/e2e.yml`**
  - [ ] Create the `.github/workflows/` directory if it does not exist.
  - [ ] Define the trigger: `on: pull_request: branches: [main]` with types `[opened, synchronize, reopened]`.
  - [ ] Add a Postgres service container (`postgres:18-alpine`) with health check (`pg_isready`) matching `docker-compose.e2e.yml`'s configuration.
  - [ ] Set environment variables: `DATABASE_URL: postgres://postgres:postgres@localhost:5432/c1pay` and `JWT_SECRET: e2e-test-secret`.
  - [ ] Add `actions/cache` step for `~/.npm` keyed on `${{ hashFiles('package-lock.json') }}`.
  - [ ] Add step: `npm ci`.
  - [ ] Add step: `npx playwright install --with-deps chromium` (installs the browser that `playwright.config.ts`'s single Chromium project uses; the image in `docker-compose.e2e.yml` bundles browsers, but a bare `ubuntu-latest` runner does not).
  - [ ] Add step: `npm run db:migrate`.
  - [ ] Add step: `npm run build`.
  - [ ] Add step: start `npm run start` in the background (`&`) then wait for port 3000 with `npx wait-on http://localhost:3000` (or `curl --retry`).
  - [ ] Add step: `npm run test:e2e`.
  - [ ] Add final step: upload `test-results/` as an artifact (`actions/upload-artifact`) with `if: failure()`.

- [ ] **Task 2: Cache the Next.js build (optional optimisation)**
  - [ ] Add `actions/cache` for `.next/cache` keyed on a hash of Next.js source files. This is a secondary optimisation — skip if it complicates the workflow; production build correctness takes priority.

- [ ] **Task 3: Verify the workflow on a live PR**
  - [ ] Push the workflow on this story's branch.
  - [ ] Open a draft pull request against `main`.
  - [ ] Confirm the workflow triggers, the full suite passes, and the GitHub Actions check is visible on the PR.
  - [ ] Record the exact check name (format: `<job-id>` from `jobs:` in `e2e.yml`) in the Dev Agent Record so it can be set as a required status check in repository Settings → Branches → Branch protection rules.

- [ ] **Task 4: Document the required status check**
  - [ ] Record in Completion Notes the job name that appears as the GitHub required check (e.g. `e2e / run-e2e-suite`), so the repo owner can add it under Settings → Branches → Require status checks → Add check.

## Dev Notes

### Recommended approach: Postgres service container

The `docker-compose.e2e.yml` approach requires Docker-in-Docker in GitHub Actions (the `docker compose` CLI inside a runner, which works but adds privilege flags and complicates layer caching). The Postgres service container approach is simpler and equally correct:

```yaml
services:
  postgres:
    image: postgres:18-alpine
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: c1pay
    options: >-
      --health-cmd pg_isready
      --health-interval 2s
      --health-timeout 3s
      --health-retries 15
    ports:
      - 5432:5432
```

`DATABASE_URL` in the job env then points to `localhost:5432` (the service container port is mapped to the runner's localhost).

### Production build, not dev server

The workflow MUST use `next build && next start` — not `next dev`. The axe gate should run against the same production build that ships. `next build` will fail fast if there are TypeScript errors, so it also serves as a type-check gate.

### `next start` readiness gate

`next start` is asynchronous — the test step must not run until the app is accepting connections:

```yaml
- run: npm run start &
- run: npx wait-on http://localhost:3000 --timeout 60000
```

`wait-on` is available as a zero-install npx invocation. Alternatively: `curl --retry 30 --retry-delay 1 --retry-all-errors http://localhost:3000`.

### `wait-on` dependency

`wait-on` is not currently a project dependency. Either:
- Use `npx wait-on` (no install needed, slightly slower).
- Use a `curl --retry` loop (zero deps, reliable).

Do not add `wait-on` as a dev dependency just for this workflow.

### Playwright browser installation

`playwright.config.ts` defines a single Chromium project. On `ubuntu-latest` the browser is not pre-installed:
```yaml
- run: npx playwright install --with-deps chromium
```
`--with-deps` installs OS-level library dependencies that Chromium needs on Linux.

### Environment variables

`JWT_SECRET` can be any string in CI — `e2e-test-secret` is fine (tests register and log in as ephemeral users, so there is no production secret to protect). If the repository has GitHub Actions secrets configured, use `${{ secrets.JWT_SECRET }}` instead; but a hardcoded test value works and keeps the setup self-contained.

### Postgres version

`postgres:18-alpine` — matches `docker-compose.e2e.yml` for parity with the local gate.

## Testing Requirements

The workflow itself is the gate. Verification is Task 3: open a PR and confirm the GitHub Actions check appears, runs, and passes (green). The suite's own test results are the evidence.

## References

- Existing Docker e2e setup: `docker-compose.e2e.yml` (reference for Postgres config and env vars)
- Playwright config: `playwright.config.ts` (single Chromium project, `fullyParallel: true`)
- npm scripts: `package.json` (`build`, `start`, `db:migrate`, `test:e2e`)
- Epic 8 goal: `_bmad-output/planning-artifacts/epics.md` § Epic 8
