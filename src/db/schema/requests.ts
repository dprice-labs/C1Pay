import { integer, pgEnum, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const requestStatus = pgEnum('request_status', ['PENDING', 'PAID', 'DECLINED', 'CANCELLED'])

export const paymentRequests = pgTable('payment_requests', {
  id: serial('id').primaryKey(),
  requesterId: integer('requester_id').notNull().references(() => users.id),
  recipientId: integer('recipient_id').notNull().references(() => users.id),
  amountCents: integer('amount_cents').notNull(),
  note: text('note'),
  status: requestStatus('status').notNull().default('PENDING'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
})

export type PaymentRequest = typeof paymentRequests.$inferSelect
export type NewPaymentRequest = typeof paymentRequests.$inferInsert
