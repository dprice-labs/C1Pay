---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary']
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-05-14-142342.md'
  - 'README.md'
workflowType: 'prd'
briefCount: 0
researchCount: 0
brainstormingCount: 1
projectDocsCount: 1
classification:
  projectType: web_app
  domain: 'Fintech (Sandbox)'
  purposeClass: 'Reference Implementation / Developer Education'
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - C1Pay

**Author:** David
**Date:** 2026-05-18

## Executive Summary

C1Pay is a sandbox P2P payment web application built as a software engineering reference implementation. The app is fully functional — user registration, send/request money flows, real-time balance sync — but its primary output is not the product itself. It is the preserved reasoning behind it.

Mid-to-senior developers who already know software engineering principles lack access to a full-system artifact that shows those principles *applied, explained, and connected to why* at a readable scale. Production codebases optimize for shipping; the reasoning disappears. Tutorial projects are too simple to surface real tradeoffs. C1Pay occupies the deliberate middle: realistic enough to demonstrate non-trivial patterns, constrained enough to stay legible, and explicitly designed to keep the engineering judgment visible.

### What Makes This Special

**Reasoning is preserved, not just demonstrated.** Every significant architectural decision — SSE over WebSockets, username as the identity primitive, JWT session model, atomic transaction approach — is documented in ADR-style decision records with explicit rationale and citations to authoritative resources. Readers see the decision *and* the argument that produced it.

**Two-layer product.** The working application is the first layer. The second is a structured learning layer: decision files for architectural choices and concept docs that name each engineering principle in play, explain it in context, and link outward to further reading. Together they form a complete teaching artifact.

**Test pyramid as explicit strategy.** The test suite demonstrates the testing pyramid (unit → integration → e2e) as a deliberate pedagogical structure, not incidental coverage. Test naming and organization surface the strategy, making the testing rationale as legible as the code.

**Domain is the vehicle.** The P2P payment domain is chosen for its complexity profile: real enough to surface non-trivial engineering tradeoffs (transaction integrity, real-time sync, auth, state machines), simple enough (fully sandboxed — no real money, no KYC, no banking APIs) to keep the system readable end-to-end.

**DRY as a visible principle.** No duplication in code or tests — demonstrated and deliberate throughout.

### Project Classification

| Attribute | Value |
|---|---|
| **Project Type** | Web Application (Next.js) |
| **Domain** | Fintech (Sandbox) |
| **Purpose Class** | Reference Implementation / Developer Education |
| **Complexity** | Medium — non-trivial data integrity and stateful real-time layer; code clarity is a first-class architectural constraint |
| **Project Context** | Greenfield implementation (stack defined, architecture decided, no code written) |
| **Stack** | Next.js · PostgreSQL · Drizzle ORM · JWT · Vitest |
