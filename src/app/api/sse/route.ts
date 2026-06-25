import { getAuthUser } from '@/lib/auth'
import { AppError, errorResponse } from '@/lib/errors'
import { register, deregister } from '@/lib/sse-emitter'
import { createLogger } from '@/lib/logger'

const log = createLogger('sse-route')

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'X-Accel-Buffering': 'no',
}

const encoder = new TextEncoder()

export async function GET(request: Request) {
  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(`unexpected error in getAuthUser (GET /api/sse): ${err instanceof Error ? err.message : String(err)}`)
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()

  register(userId, writer)
  request.signal.addEventListener('abort', () => deregister(userId, writer))

  // Flush an initial SSE comment so the runtime sends the response headers immediately.
  // The readable stream is otherwise empty until the first emit(), and headers aren't sent
  // until the first body byte — which would delay EventSource's `open` event (and block any
  // client awaiting the response) until the first real event. A comment line is ignored by
  // EventSource but opens the stream. Fire-and-forget: the default TransformStream is
  // backpressured, so awaiting here could hang until the reader pulls.
  writer.write(encoder.encode(': connected\n\n')).catch(() => {})

  return new Response(readable, { headers: SSE_HEADERS })
}
