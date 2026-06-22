import { getAuthUser } from '@/lib/auth'
import { createRequest } from '@/lib/requests'
import { createRequestSchema } from '@/lib/schemas'
import { errorResponse, AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('requests-route')

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
    log.error(`unexpected auth error in POST /api/requests: ${err instanceof Error ? err.message : String(err)}`)
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
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
