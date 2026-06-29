import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify, errors as joseErrors } from 'jose'
import { COOKIE_NAME } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const log = createLogger('middleware')

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('[middleware] JWT_SECRET is not set — add it to .env.local')
  return new TextEncoder().encode(secret)
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return false

  try {
    await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
    return true
  } catch (error) {
    if (error instanceof joseErrors.JOSEError) {
      log.warn(`Session cookie rejected (${error.code}) for ${request.nextUrl.pathname}`)
    } else {
      const message = error instanceof Error ? error.message : String(error)
      log.error(`Unexpected error verifying session for ${request.nextUrl.pathname}: ${message}`)
    }
    return false
  }
}

export async function middleware(request: NextRequest) {
  if (await hasValidSession(request)) {
    return NextResponse.next()
  }

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  matcher: [
      '/((?!_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico(?:/|$)|login(?:/|$)|register(?:/|$)|api/auth(?:/|$)|health(?:/|$)).*)',
  ],
}
