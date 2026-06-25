/**
 * Regression tests for GH #22: auth infrastructure errors must return 500,
 * not 401. Each affected route handler is tested with:
 *   1. A non-AppError from getAuthUser() → expect 500 INTERNAL_ERROR
 *   2. An AppError from getAuthUser()    → expect the AppError's own status (regression guard)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({ getAuthUser: vi.fn() }))
vi.mock('@/lib/requests', () => ({
  getInboxRequests: vi.fn(),
  createRequest: vi.fn(),
  payRequest: vi.fn(),
  declineRequest: vi.fn(),
  cancelRequest: vi.fn(),
}))
vi.mock('@/lib/transactions', () => ({
  sendMoney: vi.fn(),
  getTransactionHistory: vi.fn(),
}))
vi.mock('@/lib/users', () => ({ searchUsers: vi.fn() }))
vi.mock('@/lib/sse-emitter', () => ({ register: vi.fn(), deregister: vi.fn() }))

const mockLogError = vi.fn()
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), error: mockLogError, warn: vi.fn() }),
}))
vi.mock('@/db/index', () => ({ db: {} }))

import { getAuthUser } from '@/lib/auth'
import { AppError } from '@/lib/errors'

// ── helpers ──────────────────────────────────────────────────────────────────

function mockAuthInfraError() {
  vi.mocked(getAuthUser).mockRejectedValueOnce(new Error('DB connection refused'))
}

function mockAuthAppError(status = 401) {
  vi.mocked(getAuthUser).mockRejectedValueOnce(
    new AppError('Unauthorized', 'UNAUTHORIZED', status),
  )
}

async function parseJson(res: Response) {
  return res.json()
}

// ── GET /api/requests ─────────────────────────────────────────────────────────

describe('GET /api/requests — auth error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 INTERNAL_ERROR and logs the error when getAuthUser throws a non-AppError', async () => {
    mockAuthInfraError()
    const { GET } = await import('@/app/api/requests/route')
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await parseJson(res)
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('unexpected error in getAuthUser'))
  })

  it('returns 401 UNAUTHORIZED when getAuthUser throws an AppError (regression guard)', async () => {
    mockAuthAppError(401)
    const { GET } = await import('@/app/api/requests/route')
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect(body.code).toBe('UNAUTHORIZED')
  })
})

// ── POST /api/requests ────────────────────────────────────────────────────────

describe('POST /api/requests — auth error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 INTERNAL_ERROR and logs the error when getAuthUser throws a non-AppError', async () => {
    mockAuthInfraError()
    const { POST } = await import('@/app/api/requests/route')
    const req = new Request('http://localhost/api/requests', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 2, amountCents: 1000 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await parseJson(res)
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('unexpected error in getAuthUser'))
  })

  it('returns 401 UNAUTHORIZED when getAuthUser throws an AppError (regression guard)', async () => {
    mockAuthAppError(401)
    const { POST } = await import('@/app/api/requests/route')
    const req = new Request('http://localhost/api/requests', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 2, amountCents: 1000 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect(body.code).toBe('UNAUTHORIZED')
  })
})

// ── POST /api/transactions ────────────────────────────────────────────────────

describe('POST /api/transactions — auth error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 INTERNAL_ERROR and logs the error when getAuthUser throws a non-AppError', async () => {
    mockAuthInfraError()
    const { POST } = await import('@/app/api/transactions/route')
    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 2, amountCents: 500 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await parseJson(res)
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('unexpected error in getAuthUser'))
  })

  it('returns 401 UNAUTHORIZED when getAuthUser throws an AppError (regression guard)', async () => {
    mockAuthAppError(401)
    const { POST } = await import('@/app/api/transactions/route')
    const req = new Request('http://localhost/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ recipientId: 2, amountCents: 500 }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect(body.code).toBe('UNAUTHORIZED')
  })
})

// ── GET /api/transactions ─────────────────────────────────────────────────────

describe('GET /api/transactions — auth error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 INTERNAL_ERROR and logs the error when getAuthUser throws a non-AppError', async () => {
    mockAuthInfraError()
    const { GET } = await import('@/app/api/transactions/route')
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await parseJson(res)
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('unexpected error in getAuthUser'))
  })

  it('returns 401 UNAUTHORIZED when getAuthUser throws an AppError (regression guard)', async () => {
    mockAuthAppError(401)
    const { GET } = await import('@/app/api/transactions/route')
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect(body.code).toBe('UNAUTHORIZED')
  })
})

// ── GET /api/users/search ─────────────────────────────────────────────────────

describe('GET /api/users/search — auth error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 INTERNAL_ERROR and logs the error when getAuthUser throws a non-AppError', async () => {
    mockAuthInfraError()
    const { GET } = await import('@/app/api/users/search/route')
    const req = new Request('http://localhost/api/users/search?q=alice')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await parseJson(res)
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('unexpected error in getAuthUser'))
  })

  it('returns 401 UNAUTHORIZED when getAuthUser throws an AppError (regression guard)', async () => {
    mockAuthAppError(401)
    const { GET } = await import('@/app/api/users/search/route')
    const req = new Request('http://localhost/api/users/search?q=alice')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect(body.code).toBe('UNAUTHORIZED')
  })
})

// ── PATCH /api/requests/[id] ──────────────────────────────────────────────────

describe('PATCH /api/requests/[id] — auth error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 INTERNAL_ERROR and logs the error when getAuthUser throws a non-AppError', async () => {
    mockAuthInfraError()
    const { PATCH } = await import('@/app/api/requests/[id]/route')
    const req = new Request('http://localhost/api/requests/1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'pay' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(500)
    const body = await parseJson(res)
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('unexpected error in getAuthUser'))
  })

  it('returns 401 UNAUTHORIZED when getAuthUser throws an AppError (regression guard)', async () => {
    mockAuthAppError(401)
    const { PATCH } = await import('@/app/api/requests/[id]/route')
    const req = new Request('http://localhost/api/requests/1', {
      method: 'PATCH',
      body: JSON.stringify({ action: 'pay' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect(body.code).toBe('UNAUTHORIZED')
  })
})

// ── GET /api/sse ──────────────────────────────────────────────────────────────

describe('GET /api/sse — auth error handling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 500 INTERNAL_ERROR and logs the error when getAuthUser throws a non-AppError', async () => {
    mockAuthInfraError()
    const { GET } = await import('@/app/api/sse/route')
    const req = new Request('http://localhost/api/sse')
    const res = await GET(req)
    expect(res.status).toBe(500)
    const body = await parseJson(res)
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(mockLogError).toHaveBeenCalledWith(expect.stringContaining('unexpected error in getAuthUser'))
  })

  it('returns 401 UNAUTHORIZED when getAuthUser throws an AppError (regression guard)', async () => {
    mockAuthAppError(401)
    const { GET } = await import('@/app/api/sse/route')
    const req = new Request('http://localhost/api/sse')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await parseJson(res)
    expect(body.code).toBe('UNAUTHORIZED')
  })
})
