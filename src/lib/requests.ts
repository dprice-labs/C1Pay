import { eq, and, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { paymentRequests } from '@/db/schema/requests'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import type { PaymentRequest } from '@/db/schema/requests'

const log = createLogger('requests')

/**
 * A pending request as seen by the recipient. Requester username is resolved
 * via join at query time — no N+1 per-row lookups (NFR3).
 */
export interface InboxRequestItem {
  id: number
  requesterUsername: string
  amountCents: number
  note: string | null
  createdAt: Date
}

// Module-scope alias avoids recreating the join target on every call.
const requesterUser = alias(users, 'requester_user')

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

  const [inserted] = await db
    .insert(paymentRequests)
    .values({ requesterId, recipientId, amountCents, note: note ?? null })
    .returning()

  if (!inserted) throw new AppError('Request insert failed', 'INTERNAL_ERROR', 500)

  log.info(`createRequest: requester=${requesterId} → recipient=${recipientId} amountCents=${amountCents}`)
  return inserted
}

/**
 * Pending incoming requests for a user, newest-first. Requester username is
 * resolved in the same query — no N+1 per-row lookups (NFR3).
 */
export async function getInboxRequests(
  userId: number,
): Promise<InboxRequestItem[]> {
  const rows = await db
    .select({
      id: paymentRequests.id,
      amountCents: paymentRequests.amountCents,
      note: paymentRequests.note,
      createdAt: paymentRequests.createdAt,
      requesterUsername: requesterUser.username,
    })
    .from(paymentRequests)
    .innerJoin(requesterUser, eq(paymentRequests.requesterId, requesterUser.id))
    .where(
      and(
        eq(paymentRequests.recipientId, userId),
        eq(paymentRequests.status, 'PENDING'),
      ),
    )
    .orderBy(desc(paymentRequests.createdAt), desc(paymentRequests.id))

  log.info(`getInboxRequests userId=${userId} → ${rows.length} rows`)
  return rows
}
