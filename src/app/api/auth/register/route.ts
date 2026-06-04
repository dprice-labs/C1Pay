import { registerSchema } from '@/lib/schemas'
import { createUser } from '@/lib/users'
import { AppError, errorResponse } from '@/lib/errors'

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }
  try {
    const user = await createUser(parsed.data.username, parsed.data.password)
    return Response.json({ id: user.id, username: user.username }, { status: 201 })
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.message, error.code, error.status)
    }
    return errorResponse('Unexpected error', 'INTERNAL_ERROR', 500)
  }
}
