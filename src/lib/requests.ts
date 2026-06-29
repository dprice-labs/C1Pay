import { eq, and, desc, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { paymentRequests } from '@/db/schema/requests'
import { transactions } from '@/db/schema/transactions'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import { emit } from '@/lib/sse-emitter'
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

/**
 * A pending request as seen by the requester. Recipient username is resolved
 * via join at query time — no N+1 per-row lookups (NFR3).
 */
export interface OutgoingRequestItem {
  id: number
  recipientUsername: string
  amountCents: number
  note: string | null
  createdAt: Date
}

// Module-scope aliases avoid recreating the join target on every call.
const requesterUser = alias(users, 'requester_user')
const recipientUser = alias(users, 'recipient_user')

// Shared ordering for both pending-request views — newest first, id as tiebreaker.
const PENDING_REQUEST_ORDER = [desc(paymentRequests.createdAt), desc(paymentRequests.id)] as const

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

  // Emit REQUEST_RECEIVED to the recipient so their inbox badge updates live (AC#1, AC#2).
  // Fire-and-forget — a failed emit must not affect the committed request.
  void db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, requesterId))
    .then(([row]) => {
      if (row?.username) {
        void emit(recipientId, {
          type: 'REQUEST_RECEIVED',
          data: { requestId: inserted.id, fromUsername: row.username, amountCents: inserted.amountCents, note: inserted.note ?? undefined },
        }).catch((err) => { log.warn(`REQUEST_RECEIVED emit failed requestId=${inserted.id} err=${err}`) })
      } else {
        log.warn(`createRequest: requester username not found for SSE emit requesterId=${requesterId}`)
      }
    })
    .catch((err) => { log.warn(`createRequest: username lookup for SSE emit failed requesterId=${requesterId} err=${err}`) })

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
    .orderBy(...PENDING_REQUEST_ORDER)

  log.info(`getInboxRequests userId=${userId} → ${rows.length} rows`)
  return rows
}

/**
 * Pending outgoing requests for a user, newest-first. Recipient username is
 * resolved in the same query — no N+1 per-row lookups (NFR3).
 */
export async function getOutgoingRequests(
  userId: number,
): Promise<OutgoingRequestItem[]> {
  const rows = await db
    .select({
      id: paymentRequests.id,
      amountCents: paymentRequests.amountCents,
      note: paymentRequests.note,
      createdAt: paymentRequests.createdAt,
      recipientUsername: recipientUser.username,
    })
    .from(paymentRequests)
    .innerJoin(recipientUser, eq(paymentRequests.recipientId, recipientUser.id))
    .where(
      and(
        eq(paymentRequests.requesterId, userId),
        eq(paymentRequests.status, 'PENDING'),
      ),
    )
    .orderBy(...PENDING_REQUEST_ORDER)

  log.info(`getOutgoingRequests userId=${userId} → ${rows.length} rows`)
  return rows
}

/**
 * Pay a PENDING request. Opens a single atomic transaction: locks both user rows
 * (ascending id order — same deadlock prevention as sendMoney), debits the payer,
 * credits the requester, inserts a transactions row, and marks the request PAID.
 * Caller must be the recipient of the request (not the requester).
 */
export async function payRequest(requestId: number, userId: number): Promise<PaymentRequest> {
  const updated = await db.transaction(async (tx) => {
    // Lock the request row immediately — prevents concurrent pays from both reading PENDING.
    const [request] = await tx
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, requestId))
      .for('update')

    if (!request) throw new AppError('Request not found', 'REQUEST_NOT_FOUND', 404)
    // Auth check before status check — unauthorized callers should not learn whether the request is resolved.
    if (request.recipientId !== userId) {
      throw new AppError('Forbidden', 'FORBIDDEN', 403)
    }
    if (request.status !== 'PENDING') {
      throw new AppError('Request already resolved', 'REQUEST_ALREADY_RESOLVED', 409)
    }

    const payerId = userId
    const requesterId = request.requesterId

    // Lock both rows in ascending id order to prevent deadlock (same pattern as sendMoney).
    const rows = await tx.execute<{ id: number; balance_cents: number }>(
      sql`SELECT id, balance_cents FROM users WHERE id IN (${payerId}, ${requesterId}) ORDER BY id FOR UPDATE`
    )

    const payerRow = rows.find((r) => r.id === payerId)
    const requesterRow = rows.find((r) => r.id === requesterId)

    if (!payerRow) throw new AppError('Payer not found', 'USER_NOT_FOUND', 404)
    if (!requesterRow) throw new AppError('Requester not found', 'USER_NOT_FOUND', 404)

    if (payerRow.balance_cents < request.amountCents) {
      throw new AppError('Insufficient balance', 'INSUFFICIENT_BALANCE', 409)
    }

    const requesterNewBalance = requesterRow.balance_cents + request.amountCents

    await tx
      .update(users)
      .set({ balanceCents: payerRow.balance_cents - request.amountCents })
      .where(eq(users.id, payerId))

    await tx
      .update(users)
      .set({ balanceCents: requesterNewBalance })
      .where(eq(users.id, requesterId))

    await tx
      .insert(transactions)
      .values({
        senderId: payerId,
        recipientId: requesterId,
        amountCents: request.amountCents,
        note: request.note,
      })

    const [updatedRequest] = await tx
      .update(paymentRequests)
      .set({ status: 'PAID', resolvedAt: sql`NOW()` })
      .where(eq(paymentRequests.id, requestId))
      .returning()

    if (!updatedRequest) throw new AppError('Request update failed', 'INTERNAL_ERROR', 500)

    return { updatedRequest, requesterNewBalance }
  })

  const requesterNewBalance = updated.requesterNewBalance
  const req = updated.updatedRequest
  const requesterId = req.requesterId

  log.info(`payRequest: requestId=${requestId} payer=${userId} requester=${requesterId} amountCents=${req.amountCents}`)

  // Emit to the requester (original request creator) — they receive funds + inbox update.
  void emit(requesterId, { type: 'BALANCE_UPDATED', data: { balance: requesterNewBalance } }).catch(() => {})
  void emit(requesterId, {
    type: 'REQUEST_RESOLVED',
    data: { requestId: req.id, status: 'PAID' as const },
  }).catch(() => {})

  return updated.updatedRequest
}

/**
 * Shared no-funds-move resolution path for declineRequest/cancelRequest: lock the
 * request row, verify the caller is the authorized party, verify it's still PENDING,
 * then set the terminal status. Wrapped in a transaction with FOR UPDATE so a
 * concurrent payRequest/declineRequest/cancelRequest cannot commit between the
 * status check and the status update.
 */
async function resolveRequestGuarded(
  requestId: number,
  userId: number,
  authorizedField: 'recipientId' | 'requesterId',
  terminalStatus: 'DECLINED' | 'CANCELLED',
): Promise<PaymentRequest> {
  return await db.transaction(async (tx) => {
    const [request] = await tx
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.id, requestId))
      .for('update')

    if (!request) throw new AppError('Request not found', 'REQUEST_NOT_FOUND', 404)
    // Auth check before status check — unauthorized callers should not learn whether the request is resolved.
    if (request[authorizedField] !== userId) {
      throw new AppError('Forbidden', 'FORBIDDEN', 403)
    }
    if (request.status !== 'PENDING') {
      throw new AppError('Request already resolved', 'REQUEST_ALREADY_RESOLVED', 409)
    }

    const [updatedRequest] = await tx
      .update(paymentRequests)
      .set({ status: terminalStatus, resolvedAt: sql`NOW()` })
      .where(and(eq(paymentRequests.id, requestId), eq(paymentRequests.status, 'PENDING')))
      .returning()

    if (!updatedRequest) throw new AppError('Request update failed', 'INTERNAL_ERROR', 500)

    return updatedRequest
  })
}

/**
 * Decline a PENDING request. Sets status = DECLINED with resolved_at = now().
 * No funds move. Caller must be the recipient of the request.
 */
export async function declineRequest(requestId: number, userId: number): Promise<PaymentRequest> {
  const updated = await resolveRequestGuarded(requestId, userId, 'recipientId', 'DECLINED')

  log.info(`declineRequest: requestId=${requestId} userId=${userId}`)

  // Emit REQUEST_RESOLVED to the requester — their request was declined (AC#3).
  void emit(updated.requesterId, {
    type: 'REQUEST_RESOLVED',
    data: { requestId: updated.id, status: 'DECLINED' as const },
  }).catch(() => {})

  return updated
}

/**
 * Cancel a PENDING request. Sets status = CANCELLED with resolved_at = now().
 * No funds move. Caller must be the requester (not the recipient).
 */
export async function cancelRequest(requestId: number, userId: number): Promise<PaymentRequest> {
  const updated = await resolveRequestGuarded(requestId, userId, 'requesterId', 'CANCELLED')

  log.info(`cancelRequest: requestId=${requestId} userId=${userId}`)

  // Emit REQUEST_RESOLVED to the recipient — their pending request was cancelled (AC#3).
  void emit(updated.recipientId, {
    type: 'REQUEST_RESOLVED',
    data: { requestId: updated.id, status: 'CANCELLED' as const },
  }).catch(() => {})

  return updated
}
