import { getAuthUser } from '@/lib/auth'
import { payRequest, declineRequest, cancelRequest } from '@/lib/requests'
import { patchRequestSchema, type PatchRequestInput } from '@/lib/schemas'
import { errorResponse, AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('requests-id-route')

// Exhaustive over patchRequestSchema's action enum — adding a 4th action requires
// adding a map entry here, and TypeScript errors if one is missing.
const ACTION_HANDLERS: Record<PatchRequestInput['action'], typeof payRequest> = {
  pay: payRequest,
  decline: declineRequest,
  cancel: cancelRequest,
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const requestId = parseInt(id, 10)
  if (isNaN(requestId)) {
    return errorResponse('Invalid request ID', 'VALIDATION_ERROR', 400)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  const parsed = patchRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(`unexpected error in getAuthUser (PATCH /api/requests/${requestId}): ${err instanceof Error ? err.message : String(err)}`)
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }

  try {
    const { action } = parsed.data
    const updated = await ACTION_HANDLERS[action](requestId, userId)

    log.info(`PATCH /api/requests/${requestId} action=${action} userId=${userId}`)
    return Response.json(updated)
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(
      `unexpected error in PATCH /api/requests/${requestId}: ${err instanceof Error ? err.message : String(err)}`,
    )
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
