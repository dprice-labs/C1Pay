import { eq, sql } from 'drizzle-orm'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { transactions } from '@/db/schema/transactions'
import { AppError } from '@/lib/errors'
import { createLogger } from '@/lib/logger'
import type { Transaction } from '@/db/schema/transactions'

const log = createLogger('transactions')

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

  return db.transaction(async (tx) => {
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

    await tx
      .update(users)
      .set({ balanceCents: senderRow.balance_cents - amountCents })
      .where(eq(users.id, senderId))

    await tx
      .update(users)
      .set({ balanceCents: recipientRow.balance_cents + amountCents })
      .where(eq(users.id, recipientId))

    const [inserted] = await tx
      .insert(transactions)
      .values({ senderId, recipientId, amountCents, note: note ?? null })
      .returning()

    if (!inserted) throw new AppError('Transaction insert failed', 'INTERNAL_ERROR', 500)

    log.info(`sendMoney: sender=${senderId} → recipient=${recipientId} amountCents=${amountCents}`)

    return inserted
  })
}
