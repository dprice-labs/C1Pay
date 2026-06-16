import { index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users'

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  senderId: integer('sender_id').notNull().references(() => users.id),
  recipientId: integer('recipient_id').notNull().references(() => users.id),
  amountCents: integer('amount_cents').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_transactions_sender_id').on(table.senderId),
  index('idx_transactions_recipient_id').on(table.recipientId),
])

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
