import { getAuthUser } from '@/lib/auth'
import { AppError, errorResponse } from '@/lib/errors'
import { register, deregister } from '@/lib/sse-emitter'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
}

export async function GET(request: Request) {
  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  register(userId, writer)
  request.signal.addEventListener('abort', () => deregister(userId, writer))

  return new Response(readable, { headers: SSE_HEADERS })
}
