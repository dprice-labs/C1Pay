import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const log = createLogger('logout')

export async function POST(request: NextRequest) {
  const hadSession = Boolean(request.cookies.get(COOKIE_NAME)?.value)

  const response = new NextResponse(null, { status: 204 })
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  })

  log.info(
    hadSession
      ? 'Logout successful — session cookie cleared'
      : 'Logout request received with no session cookie present — cleared as a no-op'
  )

  return response
}
