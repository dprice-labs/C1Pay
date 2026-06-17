import { getAuthUser } from '@/lib/auth'
import { sendMoney } from '@/lib/transactions'
import { sendMoneySchema } from '@/lib/schemas'
import { errorResponse, AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('transactions-route')

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  const parsed = sendMoneySchema.safeParse(body)
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
    const transaction = await sendMoney(
      userId,
      parsed.data.recipientId,
      parsed.data.amountCents,
      parsed.data.note,
    )
    log.info(
      `send userId=${userId} → recipientId=${parsed.data.recipientId} amountCents=${parsed.data.amountCents}`,
    )
    return Response.json(transaction, { status: 201 })
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(
      `unexpected error in POST /api/transactions: ${err instanceof Error ? err.message : String(err)}`,
    )
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
