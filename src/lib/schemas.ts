import { z } from 'zod'

export const registerSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(8).max(72),
})

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>

export const sendMoneySchema = z.object({
  recipientId: z.number().int().positive(),
  // Upper bound matches Postgres `integer` (int4) max so a transfer can never
  // overflow the recipient's balance_cents column — rejected as 400, not a 500.
  amountCents: z.number().int().positive().max(2_147_483_647),
  note: z.string().max(500).optional(),
})

export type SendMoneyInput = z.infer<typeof sendMoneySchema>

export const createRequestSchema = z.object({
  recipientId: z.number().int().positive(),
  // Upper bound matches Postgres `integer` (int4) max so a request can never
  // overflow the amount_cents column — rejected as 400, not a 500.
  amountCents: z.number().int().positive().max(2_147_483_647),
  note: z.string().max(500).optional(),
})

export type CreateRequestInput = z.infer<typeof createRequestSchema>
