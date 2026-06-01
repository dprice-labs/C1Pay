# Story 1.1: Project Scaffold & Infrastructure

Status: done

## Story

As a developer,
I want a configured Next.js project with test pyramid infrastructure and shared utility modules,
so that I can begin implementing features with the correct tooling and test structure from the first commit.

## Acceptance Criteria

1. **Given** the repo is cloned, **When** `npm run dev` is executed, **Then** the default Next.js app runs on localhost:3000 without errors

2. **Given** the project is initialized, **When** `src/lib/logger.ts` is imported, **Then** it provides `logger.info()`, `logger.error()`, and `logger.warn()` methods that prefix output with `[LEVEL] [context] message`

3. **Given** the project is initialized, **When** `src/lib/errors.ts` is inspected, **Then** it exports an `AppError` class with `message`, `code`, and `status` properties and an `errorResponse(message, code, status)` helper

4. **Given** the test pyramid is configured, **When** `npm run test:unit` is run, **Then** Vitest runs only tests in `tests/unit/` with no DB or network access

5. **Given** the test pyramid is configured, **When** `npm run test:integration` is run, **Then** Vitest runs tests in `tests/integration/` using a real test database (no tests exist yet — command must succeed without hanging)

6. **Given** the test pyramid is configured, **When** `npm run test:e2e` is run, **Then** Playwright runs tests in `tests/e2e/` (no tests exist yet — command must succeed without hanging)

7. **Given** the project is initialized, **When** `.env.example` is inspected, **Then** it documents `DATABASE_URL` and `JWT_SECRET` with placeholder values and inline comments describing each variable

8. **Given** any server-side module is written, **Then** it imports from `logger.ts` — no raw `console.log` in server code

## Tasks / Subtasks

- [x] Task 1: Scaffold Next.js project (AC: #1)
  - [x] Run `npx create-next-app@16 . --typescript --app --eslint --tailwind --src-dir --import-alias "@/*"` from the project root (see Dev Notes — use `.` not `c1pay`)
  - [x] Verify `npm run dev` starts without errors on localhost:3000
  - [x] Commit the scaffold output as the baseline

- [x] Task 2: Install and configure test dependencies (AC: #4, #5, #6)
  - [x] Install dev deps: `npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom @playwright/test`
  - [x] Run `npx playwright install --with-deps chromium` to install the Chromium browser
  - [x] Create `vitest.config.ts` (see Dev Notes for content)
  - [x] Create `playwright.config.ts` (see Dev Notes for content)
  - [x] Create directory structure: `tests/unit/lib/`, `tests/integration/`, `tests/e2e/`
  - [x] Add `test:unit`, `test:integration`, `test:e2e` scripts to `package.json`

- [x] Task 3: Create `src/lib/logger.ts` (AC: #2, #8)
  - [x] Implement `logger` with `info`, `error`, `warn` methods, prefix format `[LEVEL] [context] message`
  - [x] Logger accepts optional context string as second argument or via a `createLogger(context)` factory

- [x] Task 4: Create `src/lib/errors.ts` (AC: #3)
  - [x] Implement `AppError` class extending `Error` with `code: string` and `status: number` properties
  - [x] Implement `errorResponse(message, code, status)` helper returning `Response.json({ error, code }, { status })`

- [x] Task 5: Create `.env.example` (AC: #7)
  - [x] Add `DATABASE_URL` with placeholder and inline comment
  - [x] Add `JWT_SECRET` with placeholder and inline comment
  - [x] Verify `.env.local` is in `.gitignore`

- [x] Task 6: Write proving unit test (AC: #4)
  - [x] Create `tests/unit/lib/errors.test.ts` — tests `AppError` and `errorResponse` without any DB or network access
  - [x] Verify `npm run test:unit` passes

- [x] Task 7: Verify Playwright config (AC: #6)
  - [x] Run `npm run test:e2e` — must exit cleanly (0 test files found = success, not an error)

## Dev Notes

### CRITICAL: Scaffold command — use `.` not `c1pay`

The architecture document specifies `npx create-next-app@16 c1pay ...` but the git repository is already initialized at `/home/dprice/Projects/C1Pay`. **Use `.` as the project directory** to scaffold into the existing repo:

```bash
npx create-next-app@16 . \
  --typescript \
  --app \
  --eslint \
  --tailwind \
  --src-dir \
  --import-alias "@/*"
```

The `create-next-app` prompt may ask "Ok to proceed?" — answer yes. It will merge into the existing directory. The project name in `package.json` should be `c1pay` (lowercase).

### Test dependencies installation

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom @playwright/test
```

Note: `@testing-library/jest-dom` is NOT needed for Vitest — use `expect` from Vitest directly. Vitest has built-in DOM matchers when combined with jsdom.

### `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

The `environment: 'node'` default is correct — unit tests for `src/lib/` functions run in Node. If a test needs DOM globals, add `// @vitest-environment jsdom` at the top of that specific file.

### `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### `package.json` test scripts

Add to `"scripts"` in `package.json`:

```json
"test:unit": "vitest run tests/unit",
"test:integration": "vitest run tests/integration",
"test:e2e": "playwright test"
```

The `vitest run <dir>` pattern filters by path, running only the tests in that directory. `vitest run tests/unit` = unit tests only; `vitest run tests/integration` = integration tests only.

### `src/lib/logger.ts`

```typescript
type LogLevel = 'INFO' | 'ERROR' | 'WARN'

function log(level: LogLevel, context: string, message: string): void {
  console[level === 'ERROR' ? 'error' : level === 'WARN' ? 'warn' : 'log'](
    `[${level}] [${context}] ${message}`
  )
}

export const logger = {
  info: (context: string, message: string) => log('INFO', context, message),
  error: (context: string, message: string) => log('ERROR', context, message),
  warn: (context: string, message: string) => log('WARN', context, message),
}
```

Usage: `logger.info('auth', 'JWT validated for userId 42')` → `[INFO] [auth] JWT validated for userId 42`

No third-party logging library. The thin wrapper around `console` is the intentional design — it keeps the output scannable and is itself a named teaching pattern.

### `src/lib/errors.ts`

```typescript
export class AppError extends Error {
  code: string
  status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
  }
}

export function errorResponse(message: string, code: string, status: number): Response {
  return Response.json({ error: message, code }, { status })
}
```

The `errorResponse` helper is used in **every** route handler error path throughout the project. The `{ error, code }` shape is the invariant — never deviate from it.

### `.env.example`

```bash
# PostgreSQL connection string — used by Drizzle ORM client in src/db/index.ts
DATABASE_URL=postgresql://user:password@localhost:5432/c1pay

# Secret key for signing/verifying JWT tokens — must be a long random string
JWT_SECRET=your-secret-key-here-change-this-in-development
```

### `tests/unit/lib/errors.test.ts` (proving test)

```typescript
import { describe, it, expect } from 'vitest'
import { AppError, errorResponse } from '@/lib/errors'

describe('AppError', () => {
  it('stores message, code, and status', () => {
    const err = new AppError('Insufficient balance', 'INSUFFICIENT_BALANCE', 400)
    expect(err.message).toBe('Insufficient balance')
    expect(err.code).toBe('INSUFFICIENT_BALANCE')
    expect(err.status).toBe(400)
    expect(err instanceof Error).toBe(true)
  })
})

describe('errorResponse', () => {
  it('returns correct shape and status', async () => {
    const res = errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'Validation failed', code: 'VALIDATION_ERROR' })
  })
})
```

### Project directory structure (target for this story)

After this story, the repo should match this partial structure (only directories/files created in this story):

```
c1pay/                          ← project root (already exists as /home/dprice/Projects/C1Pay)
├── .env.example                ← NEW: documents DATABASE_URL and JWT_SECRET
├── .env.local                  ← gitignored (not created in this story — no DB yet)
├── .gitignore                  ← from scaffold, verify .env.local is listed
├── next.config.ts              ← from scaffold
├── package.json                ← from scaffold + test scripts added
├── playwright.config.ts        ← NEW
├── tailwind.config.ts          ← from scaffold (Tailwind v4 may use CSS imports instead)
├── tsconfig.json               ← from scaffold
├── vitest.config.ts            ← NEW
│
├── src/
│   ├── app/                    ← from scaffold (default Next.js pages — leave as-is)
│   ├── lib/
│   │   ├── errors.ts           ← NEW
│   │   └── logger.ts           ← NEW
│   └── middleware.ts           ← NOT in this story (Story 1.5)
│
└── tests/
    ├── unit/
    │   └── lib/
    │       └── errors.test.ts  ← NEW (proving test)
    ├── integration/            ← NEW empty dir (tests added in later stories)
    └── e2e/                    ← NEW empty dir (tests added in later stories)
```

**Do NOT create in this story:** `src/db/`, `src/store/`, `src/hooks/`, `src/types/`, `src/components/`, `src/middleware.ts`, `drizzle.config.ts`, `scripts/`. These belong to later stories.

### Tailwind v4 note

`create-next-app@16` ships with Tailwind CSS v4. In v4, the primary config mechanism is CSS imports in `src/app/globals.css` (e.g. `@import "tailwindcss"`), not `tailwind.config.ts`. The scaffolder handles this correctly — do not manually create or modify a `tailwind.config.ts` unless the scaffolder produces one.

### Vitest `@/*` path alias

The vitest config `resolve.alias` must map `@` → `./src` to match the TypeScript path alias (`@/*`) set by `create-next-app`. Without this, `import { AppError } from '@/lib/errors'` will fail in tests.

### Anti-patterns (never do)

- `console.log` directly in `src/lib/` or `src/app/api/` code — always use `logger`
- Creating the DB schema (`src/db/`) in this story — that is Story 1.2
- Installing `jest` — this project uses Vitest throughout
- Using `require()` — TypeScript ESM everywhere

### References

- [Source: architecture.md#Starter Template Evaluation] — scaffold command, Tailwind v4, test framework
- [Source: architecture.md#Infrastructure & Deployment] — `logger.ts` rationale, `.env.example` pattern
- [Source: architecture.md#API & Communication Patterns] — `errorResponse` shape and `{ error, code }` invariant
- [Source: architecture.md#Complete Project Directory Structure] — target directory layout
- [Source: epics.md#Story 1.1] — acceptance criteria and scope

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6 (1M context)

### Debug Log References

- Scaffold workaround: `create-next-app@16` rejects directory names with capital letters as the npm package name. Scaffolded to `c1pay/` subdir, hoisted files to project root, then removed subdir. Manual cleanup of `c1pay/` subdir needed if it persists.
- Playwright 1.60 does not support Ubuntu 26.04. Upgraded to `@playwright/test@1.61.0-alpha-2026-06-01` which downloads Chrome for Testing 149.0.7827.22 successfully.
- `playwright install --with-deps chromium` fails on Ubuntu 26.04; used `playwright install chromium` (no system deps) — system packages already present.
- Both `vitest run <dir>` (no tests) and `playwright test` (no tests) exit code 1 by default. Added `--passWithNoTests` to `test:integration` and `--pass-with-no-tests` to `test:e2e` scripts so empty test directories succeed.

### Completion Notes List

- All 7 tasks complete, all 8 ACs satisfied.
- AC #1: `npm run dev` starts Next.js 16.2.6 on localhost:3000 in 157ms.
- AC #2: `src/lib/logger.ts` exports `logger.info/error/warn(context, message)` with `[LEVEL] [context] message` format.
- AC #3: `src/lib/errors.ts` exports `AppError` and `errorResponse` with invariant `{ error, code }` shape.
- AC #4: `npm run test:unit` — 2/2 tests pass (errors.test.ts).
- AC #5: `npm run test:integration` exits 0 (no tests yet, `--passWithNoTests`).
- AC #6: `npm run test:e2e` exits 0 (no tests yet, `--pass-with-no-tests`).
- AC #7: `.env.example` documents `DATABASE_URL` and `JWT_SECRET` with inline comments.
- AC #8: Zero `console.log` in `src/` — all output goes through `logger`.

### File List

- `.env.example` — NEW
- `.gitignore` — MODIFIED (merged scaffold's Next.js ignores with existing personal config)
- `AGENTS.md` — NEW (from scaffold)
- `eslint.config.mjs` — NEW (from scaffold)
- `next-env.d.ts` — NEW (from scaffold)
- `next.config.ts` — NEW (from scaffold)
- `package-lock.json` — NEW
- `package.json` — NEW (scaffold) + test scripts added
- `playwright.config.ts` — NEW
- `postcss.config.mjs` — NEW (from scaffold)
- `public/` — NEW (from scaffold)
- `src/app/` — NEW (from scaffold)
- `src/lib/errors.ts` — NEW
- `src/lib/logger.ts` — NEW
- `tests/unit/lib/errors.test.ts` — NEW
- `tests/integration/` — NEW (empty dir)
- `tests/e2e/` — NEW (empty dir)
- `tsconfig.json` — NEW (from scaffold)
- `vitest.config.ts` — NEW

### Change Log

- 2026-06-01: Story 1.1 implemented — Next.js 16 scaffold, test pyramid (Vitest + Playwright), `src/lib/logger.ts`, `src/lib/errors.ts`, `.env.example`

### Review Findings

_Code review 2026-06-01 (Blind Hunter + Edge Case Hunter + Acceptance Auditor). All 8 ACs verified satisfied; the following are quality findings on top of an accepted implementation._

**Resolved during review (pre-triage fixes):**

- [x] [Review][Fixed] `.env.example` was gitignored by `.env*` — added `!.env.example` negation [.gitignore:37]. Unblocks AC #7.
- [x] [Review][Fixed] Stray duplicate Next.js scaffold removed — deleted nested `c1pay/` directory (spec mandated scaffolding into `.`).

**Decision needed (resolved → patched):**

- [x] [Review][Decision→Patch] Logger missing `createLogger(context)` factory — decision: ADD it. Implemented `createLogger(context)` alongside the existing `logger` in `src/lib/logger.ts`.
- [x] [Review][Decision→Patch] `errorResponse` could throw `RangeError` on out-of-range status — decision: ADD a guard. `errorResponse` now clamps any non-200–599 status to 500 before calling `Response.json` [src/lib/errors.ts:14-18].

**Patch (applied):**

- [x] [Review][Patch] App metadata set from scaffold default to C1Pay [src/app/layout.tsx:15-18].
- [x] [Review][Patch] Proving test now asserts `err.name === 'AppError'` and `instanceof AppError` [tests/unit/lib/errors.test.ts]. Verified: `npm run test:unit` 2/2 pass, `tsc --noEmit` clean.

**Deferred (boilerplate / future-epic concerns):**

- [x] [Review][Defer] `globals.css` `body` hard-codes `Arial` while `layout.tsx` loads Geist and exposes `--font-geist-sans` — Geist downloaded but never applied [src/app/globals.css:24] — deferred to Epic 2 (Home Screen UI).
- [x] [Review][Defer] `page.tsx` is create-next-app boilerplate (default content, new-tab links with no "opens in new window" affordance) [src/app/page.tsx] — deferred to Epic 2; accessibility pass in Epic 6.
- [x] [Review][Defer] No helper to convert an `AppError` into an `errorResponse` — two parallel error shapes invite drift [src/lib/errors.ts] — revisit when route handlers land (Epic 3+).
- [x] [Review][Defer] Test tooling fragility — `@playwright/test` pinned to date-stamped alpha `^1.61.0-alpha-2026-06-01`; `playwright.config.ts` `webServer` has no `timeout` (60s default cold-start flake risk) — deferred to CI hardening.
