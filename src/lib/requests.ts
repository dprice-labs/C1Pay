import { db } from '@/db/index'
import { paymentRequests } from '@/db/schema/requests'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import type { PaymentRequest } from '@/db/schema/requests'

const log = createLogger('requests')

export async function createRequest(
  requesterId: number,
  recipientId: number,
  amountCents: number,
  note?: string,
): Promise<PaymentRequest> {
  if (requesterId === recipientId) {
    throw new AppError('Cannot request money from yourself', 'SELF_REQUEST', 400)
  }
  if (amountCents <= 0) {
    throw new AppError('Amount must be positive', 'INVALID_AMOUNT', 400)
  }

  let inserted: PaymentRequest | undefined
  try {
    ;[inserted] = await db
      .insert(paymentRequests)
      .values({ requesterId, recipientId, amountCents, note: note ?? null })
      .returning()
  } catch (err) {
    const pgCode =
      (err as { code?: string }).code ??
      ((err as { cause?: { code?: string } }).cause?.code)
    if (pgCode === '23503') {
      throw new AppError('Recipient not found', 'RECIPIENT_NOT_FOUND', 404)
    }
    throw err
  }

  if (!inserted) throw new AppError('Request insert failed', 'INTERNAL_ERROR', 500)

  log.info(`createRequest: requester=${requesterId} → recipient=${recipientId} amountCents=${amountCents}`)
  return inserted
}
