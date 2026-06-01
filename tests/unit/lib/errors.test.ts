import { describe, it, expect } from 'vitest'
import { AppError, errorResponse } from '@/lib/errors'

describe('AppError', () => {
  it('stores message, code, and status', () => {
    const err = new AppError('Insufficient balance', 'INSUFFICIENT_BALANCE', 400)
    expect(err.message).toBe('Insufficient balance')
    expect(err.code).toBe('INSUFFICIENT_BALANCE')
    expect(err.status).toBe(400)
    expect(err instanceof Error).toBe(true)
    expect(err instanceof AppError).toBe(true)
    expect(err.name).toBe('AppError')
  })
})

describe('errorResponse', () => {
  it('returns correct shape and status', async () => {
    const res = errorResponse('Validation failed', 'VALIDATION_ERROR', 400)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toEqual({ error: 'Validation failed', code: 'VALIDATION_ERROR' })
  })
})
