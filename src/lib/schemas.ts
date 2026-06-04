import { z } from 'zod'

export const registerSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(8).max(72),
})

export type RegisterInput = z.infer<typeof registerSchema>
