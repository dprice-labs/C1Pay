<p align="center">
  <img src="./C1Pay.jpg" alt="C1Pay Full-Stack Architecture Diagram" width="800">
</p>

A Venmo/Zelle-style sandbox web app built as a team knowledge-sharing reference codebase. The goal is to demonstrate full-stack software development best practices for a mid-level to senior developer audience — not production software, but a deliberate teaching artifact where every decision is worth examining.

## What it demonstrates

- JWT authentication with secure token handling
- User registration and account management
- Payment requests between registered users (no real money movement)
- Mobile-responsive UI
- Full-stack best practices across architecture, testing, and data access

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js |
| ORM | Drizzle ORM |
| Database | PostgreSQL |
| Auth | JWT |
| Testing | Vitest |

## Running e2e in containers

`npm run test:e2e` runs Playwright natively against your local dev server and
Postgres. If your host can't launch Playwright's browsers (e.g. Ubuntu 26.04,
where the bundled browser builds aren't yet supported), use the containerised
runner instead:

```bash
npm run test:e2e:docker
```

This spins up an isolated stack defined in `docker-compose.e2e.yml`:

- the **official Playwright image** (pinned to our Playwright version) with browsers preinstalled,
- a **throwaway Postgres** (in-memory, no host port) that is migrated then discarded,
- the app, started inside the same container.

It is fully additive and does not touch your local environment — your host
Postgres instance, `node_modules`, and `.next` cache are never read or
written. The first run installs dependencies into a cached volume; later runs
reuse it. Run `npm run test:e2e:docker:clean` after changing dependencies to
force a fresh install.

> Requires Docker with the Compose plugin. When bumping `@playwright/test`,
> update the image tag in `docker-compose.e2e.yml` to match.

## Purpose

This repo is a reference codebase — read it, study it, and use it as a baseline for team discussions on tradeoffs and patterns. The structure and decisions are intentional and designed to be visible to the reader.
