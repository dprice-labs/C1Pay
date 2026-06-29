/**
 * Health check endpoint for Kubernetes liveness / readiness probes.
 *
 * Fast response — no DB calls, no auth bypass needed (excluded from middleware).
 */

export async function GET() {
  return Response.json({ status: 'ok' }, { status: 200 })
}
