import { eq, or, desc, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { transactions } from '@/db/schema/transactions'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import { emit } from '@/lib/sse-emitter'
import type { Transaction } from '@/db/schema/transactions'

const log = createLogger('transactions')

/**
 * A transaction as seen from a single viewer's perspective. The `transactions`
 * table stores one row per transfer; "sent" vs "received" and the counterparty
 * are derived at read time (never duplicated — see Story 3.1). Returning this
 * viewer-relative shape keeps that derivation in one place (NFR9) so the route
 * and the page both consume an already-resolved row.
 */
export interface TransactionHistoryItem {
  id: number
  amountCents: number
  note: string | null
  createdAt: Date
  direction: 'sent' | 'received'
  counterpartyUsername: string
}

export async function sendMoney(
  senderId: number,
  recipientId: number,
  amountCents: number,
  note?: string,
): Promise<Transaction> {
  if (senderId === recipientId) {
    throw new AppError('Cannot send money to yourself', 'SELF_TRANSFER', 400)
  }
  if (amountCents <= 0) {
    throw new AppError('Amount must be positive', 'INVALID_AMOUNT', 400)
  }

  const { transaction, recipientBalanceCents } = await db.transaction(async (tx) => {
    // Lock both rows in ascending id order to prevent deadlock under concurrent sends
    // involving the same pair of users. Drizzle does not expose FOR UPDATE natively —
    // raw SQL is required at this ORM boundary.
    const rows = await tx.execute<{ id: number; balance_cents: number }>(
      sql`SELECT id, balance_cents FROM users WHERE id IN (${senderId}, ${recipientId}) ORDER BY id FOR UPDATE`
    )

    const senderRow = rows.find((r) => r.id === senderId)
    const recipientRow = rows.find((r) => r.id === recipientId)

    if (!senderRow) throw new AppError('Sender not found', 'USER_NOT_FOUND', 404)
    if (!recipientRow) throw new AppError('Recipient not found', 'USER_NOT_FOUND', 404)

    if (senderRow.balance_cents < amountCents) {
      throw new AppError('Insufficient balance', 'INSUFFICIENT_BALANCE', 409)
    }

    // Recipient's post-credit balance. Captured once here and reused both for the credit
    // update and the post-commit SSE emit — never re-queried (see Story 3.3 Dev Notes).
    const recipientBalanceCents = recipientRow.balance_cents + amountCents

    await tx
      .update(users)
      .set({ balanceCents: senderRow.balance_cents - amountCents })
      .where(eq(users.id, senderId))

    await tx
      .update(users)
      .set({ balanceCents: recipientBalanceCents })
      .where(eq(users.id, recipientId))

    const [inserted] = await tx
      .insert(transactions)
      .values({ senderId, recipientId, amountCents, note: note ?? null })
      .returning()

    if (!inserted) throw new AppError('Transaction insert failed', 'INTERNAL_ERROR', 500)

    log.info(`sendMoney: sender=${senderId} → recipient=${recipientId} amountCents=${amountCents}`)

    return { transaction: inserted, recipientBalanceCents }
  })

  // AC #1 + #2: notify the recipient ONLY after the transaction COMMITS. If the transaction
  // throws or rolls back, this line is never reached → nothing is emitted.
  //
  // Fire-and-forget on purpose: emit() awaits a write to the recipient's SSE stream, and a
  // default TransformStream starts backpressured — so that write does not resolve until the
  // recipient's connection is actively pulling. Awaiting it here would couple the sender's
  // already-committed transfer to the recipient's liveness: a stalled recipient tab would
  // hang the sender's POST. The money has moved; the sender must not wait on the recipient.
  // emit() bounds and reaps its own stalled writes internally; the trailing .catch() guards
  // the narrow window before emit()'s own try block (JSON.stringify / the initial write()), so
  // this floating promise can never surface as an unhandled rejection out of sendMoney.
  // Recipient-only by design (AC #1) — the sender's debit is the optimistic client write (Story 3.2).
  void emit(recipientId, {
    type: 'BALANCE_UPDATED',
    data: { balance: recipientBalanceCents },
  }).catch(() => {})

  return transaction
}

// Two aliased joins resolve both usernames in a single round-trip (no N+1, NFR3).
// Both FKs are NOT NULL and reference users.id, so an inner join on each side is
// safe and lets PostgreSQL use the existing sender/recipient indexes (Story 3.1).
const senderUser = alias(users, 'sender_user')
const recipientUser = alias(users, 'recipient_user')

/**
 * All transactions where `userId` is the sender or recipient, newest-first (FR23).
 * Counterparty usernames are resolved in the same query — no per-row lookups (NFR3).
 */
export async function getTransactionHistory(userId: number): Promise<TransactionHistoryItem[]> {
  const rows = await db
    .select({
      id: transactions.id,
      senderId: transactions.senderId,
      recipientId: transactions.recipientId,
      amountCents: transactions.amountCents,
      note: transactions.note,
      createdAt: transactions.createdAt,
      senderUsername: senderUser.username,
      recipientUsername: recipientUser.username,
    })
    .from(transactions)
    .innerJoin(senderUser, eq(transactions.senderId, senderUser.id))
    .innerJoin(recipientUser, eq(transactions.recipientId, recipientUser.id))
    .where(or(eq(transactions.senderId, userId), eq(transactions.recipientId, userId)))
    // Secondary sort on id breaks ties: createdAt alone is not a stable order when two
    // transactions share a timestamp, which would reorder rows nondeterministically across
    // requests (and flake the ordering assertion in the integration test).
    .orderBy(desc(transactions.createdAt), desc(transactions.id))

  log.info(`getTransactionHistory userId=${userId} → ${rows.length} rows`)
  return rows.map((r) => toHistoryItem(r, userId))
}

/**
 * Pure mapping from a joined row to a viewer-relative history item. DB-free and
 * unit-testable in isolation (FR37) — the direction/counterparty derivation lives
 * here, in one place (NFR9).
 */
export function toHistoryItem(
  r: {
    id: number
    senderId: number
    recipientId: number
    amountCents: number
    note: string | null
    createdAt: Date
    senderUsername: string
    recipientUsername: string
  },
  userId: number,
): TransactionHistoryItem {
  const sent = r.senderId === userId
  return {
    id: r.id,
    amountCents: r.amountCents,
    note: r.note,
    createdAt: r.createdAt,
    direction: sent ? 'sent' : 'received',
    counterpartyUsername: sent ? r.recipientUsername : r.senderUsername,
  }
}
