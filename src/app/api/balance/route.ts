import { getAuthUser } from '@/lib/auth'
import { getUserById } from '@/lib/users'
import { errorResponse, AppError } from '@/lib/errors'

// Authoritative balance read for the authed user. The SSE stream (BALANCE_UPDATED) is the
// primary live-update path, but the in-memory emitter has no replay: an event emitted while
// the recipient's EventSource is momentarily disconnected (reaper abort, network blip, tab
// throttling) is lost. `use-sse` calls this on every (re)connect `open` to reconcile, so a
// missed update self-heals instead of leaving the balance stale until a full reload.
export async function GET() {
  try {
    const { userId } = await getAuthUser()
    const user = await getUserById(userId)
    return Response.json({ balanceCents: user.balanceCents })
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
