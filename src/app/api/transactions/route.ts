import { getAuthUser } from '@/lib/auth'
import { sendMoney, getTransactionHistory } from '@/lib/transactions'
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

// FR23: the authenticated user's chronological transaction history. The /history
// Server Component calls getTransactionHistory() directly; this route exists for
// the FR23 API contract and any future client consumer. Mirrors the auth-first
// ordering and { error, code } shape of GET /api/users/search.
export async function GET() {
  let userId: number
  try {
    ;({ userId } = await getAuthUser())
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  try {
    // getTransactionHistory already logs the userId + row count, so no route-level log here
    // (it would double-log every fetch, including the Server Component page render path).
    const history = await getTransactionHistory(userId)
    return Response.json(history)
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.message, err.code, err.status)
    log.error(
      `unexpected error in GET /api/transactions: ${err instanceof Error ? err.message : String(err)}`,
    )
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}
