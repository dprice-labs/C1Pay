/**
 * Health check endpoint for Kubernetes liveness / readiness probes.
 *
 * Placement instructions:
 *   1) Create this file at:  src/app/health/[[...path]]/route.ts
 *      (catch-all dynamic route so _any_ /health/* path works)
 *
 *   2) Add '/health*' to the middleware matcher exclusion list in src/middleware.ts,
 *      inside the existing negative-lookahead regex — append it before the closing ):
 *
 *        // BEFORE (existing):
 *        '/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico(?:/|$)|login(?:/|$)|register(?:/|$)|api/auth(?:/|$)).*)'
 *
 *        // AFTER (add |health(?:/|$)):
 *        '/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico(?:/|$)|login(?:/|$)|register(?:/|$)|api/auth(?:/|$)|health(?:/|$)).*)'
 *
 * This endpoint does NOT require authentication and must respond fast (no DB calls).
 */

/** @returns 200 with status body — used by kube liveness/readiness probes */
export async function GET() {
  return Response.json({ status: 'ok' }, { status: 200 })
}
