import { integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull(),
  passwordHash: text('password_hash').notNull(),
  balanceCents: integer('balance_cents').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_users_username').on(table.username),
])

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
