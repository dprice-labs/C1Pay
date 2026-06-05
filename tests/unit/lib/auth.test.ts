import { describe, it, expect } from 'vitest'
import { SignJWT } from 'jose'
import { signJwt, verifyJwt } from '@/lib/auth'

describe('signJwt + verifyJwt', () => {
  it('produces a token with correct userId claim', async () => {
    const token = await signJwt({ userId: 42 })
    const { userId } = await verifyJwt(token)
    expect(userId).toBe(42)
  })

  it('payload contains only userId (no extra claims)', async () => {
    const token = await signJwt({ userId: 99 })
    const parts = token.split('.')
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
    const businessClaims = Object.keys(payload).filter(k => !['iat', 'exp'].includes(k))
    expect(businessClaims).toEqual(['userId'])
  })

  it('rejects a tampered token', async () => {
    const token = await signJwt({ userId: 1 })
    const parts = token.split('.')
    parts[2] = parts[2].slice(0, -2) + 'xx'
    const tampered = parts.join('.')
    await expect(verifyJwt(tampered)).rejects.toThrow()
  })

  it('rejects an expired token', async () => {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret) throw new Error('JWT_SECRET not set in .env.local')
    const secret = new TextEncoder().encode(jwtSecret)
    const expiredToken = await new SignJWT({ userId: 1 } as Record<string, unknown>)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret)
    await expect(verifyJwt(expiredToken)).rejects.toThrow()
  })
})
