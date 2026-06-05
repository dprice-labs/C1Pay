import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { AppError } from '@/lib/errors'
export const COOKIE_NAME = 'session'

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('[auth] JWT_SECRET is not set — add it to .env.local')
  return new TextEncoder().encode(secret)
}

export async function signJwt(payload: { userId: number }): Promise<string> {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(getSecret())
}

export async function verifyJwt(token: string): Promise<{ userId: number }> {
  const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] })
  if (typeof payload.userId !== 'number') {
    throw new Error('[auth] JWT payload.userId is missing or not a number')
  }
  return { userId: payload.userId }
}

export async function getAuthUser(): Promise<{ userId: number }> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) {
    throw new AppError('Unauthorized', 'UNAUTHORIZED', 401)
  }
  try {
    return await verifyJwt(token)
  } catch {
    throw new AppError('Unauthorized', 'UNAUTHORIZED', 401)
  }
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

