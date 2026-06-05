import { NextResponse } from 'next/server'
import { loginSchema } from '@/lib/schemas'
import { findByUsername } from '@/lib/users'
import { signJwt, verifyPassword, COOKIE_NAME } from '@/lib/auth'
import { errorResponse } from '@/lib/errors'
import { createLogger } from '@/lib/logger'

const log = createLogger('login')

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
  }

  const { username, password } = parsed.data

  let user
  try {
    user = await findByUsername(username)
  } catch {
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return errorResponse('Invalid username or password', 'INVALID_CREDENTIALS', 401)
  }

  let token
  try {
    token = await signJwt({ userId: user.id })
  } catch {
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }

  log.info(`Login successful for userId ${user.id}`)

  const response = NextResponse.json({ userId: user.id })
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 86400,
    secure: process.env.NODE_ENV === 'production',
  })
  return response
}
