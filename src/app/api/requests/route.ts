import { getAuthUser } from '@/lib/auth'
import { createRequest, getInboxRequests } from '@/lib/requests'
import { createRequestSchema } from '@/lib/schemas'
import { errorResponse, AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('requests-route')

export async function GET() {
  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  try {
    const items = await getInboxRequests(userId)
    // Note: createdAt serialises to an ISO string over the wire — Date type is only valid server-side.
    return Response.json(items)
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(`unexpected error in GET /api/requests: ${err instanceof Error ? err.message : String(err)}`)
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  const parsed = createRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  try {
    const paymentRequest = await createRequest(
      userId,
      parsed.data.recipientId,
      parsed.data.amountCents,
      parsed.data.note,
    )
    log.info(
      `create request userId=${userId} → recipientId=${parsed.data.recipientId} amountCents=${parsed.data.amountCents}`,
    )
    return Response.json(paymentRequest, { status: 201 })
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(
      `unexpected error in POST /api/requests: ${err instanceof Error ? err.message : String(err)}`,
    )
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
