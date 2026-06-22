import { vi, describe, it, expect, beforeEach } from 'vitest'

// vi.hoisted ensures these are available when vi.mock factories run (which are hoisted)
const { mockBcryptHash, mockReturning, mockValues } = vi.hoisted(() => {
  const mockReturning = vi.fn()
  const mockValues = vi.fn(() => ({ returning: mockReturning }))
  const mockBcryptHash = vi.fn().mockResolvedValue('$2b$12$fakehash')
  return { mockBcryptHash, mockReturning, mockValues }
})

vi.mock('bcryptjs', () => ({
  default: { hash: mockBcryptHash },
}))

vi.mock('@/db/index', () => ({
  db: {
    insert: () => ({ values: mockValues }),
  },
}))

// Import AFTER mock declarations
import { createUser } from '@/lib/users'

const MOCK_USER = {
  id: 1,
  username: 'alice',
  passwordHash: '$2b$12$fakehash',
  balanceCents: 100000,
  createdAt: new Date(),
}

describe('createUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBcryptHash.mockResolvedValue('$2b$12$fakehash')
    mockValues.mockReturnValue({ returning: mockReturning })
    mockReturning.mockResolvedValue([MOCK_USER])
  })

  it('hashes the password with bcrypt at work factor 12', async () => {
    await createUser('alice', 'mypassword')
    expect(mockBcryptHash).toHaveBeenCalledWith('mypassword', 12)
  })

  it('never passes plaintext password to db.insert', async () => {
    await createUser('alice', 'mypassword')
    const inserted = mockValues.mock.calls[0][0]
    expect(inserted.passwordHash).not.toBe('mypassword')
  })

  it('sets balanceCents to 100000 by default', async () => {
    await createUser('alice', 'pass')
    const inserted = mockValues.mock.calls[0][0]
    expect(inserted.balanceCents).toBe(100000)
  })

  it('uses the provided balanceCents when given', async () => {
    await createUser('alice', 'pass', 50000)
    const inserted = mockValues.mock.calls[0][0]
    expect(inserted.balanceCents).toBe(50000)
  })

  it('throws AppError INVALID_AMOUNT for a negative balanceCents', async () => {
    await expect(createUser('alice', 'pass', -500)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
      status: 400,
    })
  })

  it('throws AppError INVALID_AMOUNT for a non-integer balanceCents', async () => {
    await expect(createUser('alice', 'pass', 100.5)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
      status: 400,
    })
  })

  it('does not hash the password when balanceCents is invalid', async () => {
    await createUser('alice', 'pass', -500).catch(() => {})
    expect(mockBcryptHash).not.toHaveBeenCalled()
  })

  it('throws AppError USERNAME_TAKEN on duplicate username', async () => {
    const pgError = Object.assign(new Error('duplicate key'), { code: '23505' })
    mockReturning.mockRejectedValueOnce(pgError)
    await expect(createUser('alice', 'pass')).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
      status: 409,
    })
  })

  it('throws AppError USERNAME_TAKEN when error code is on .cause (Drizzle wrapping)', async () => {
    const cause = Object.assign(new Error('duplicate key'), { code: '23505' })
    const drizzleError = Object.assign(new Error('DrizzleQueryError'), { cause })
    mockReturning.mockRejectedValueOnce(drizzleError)
    await expect(createUser('alice', 'pass')).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
      status: 409,
    })
  })

  it('throws AppError INTERNAL_ERROR when .returning() resolves to empty array', async () => {
    mockReturning.mockResolvedValueOnce([])
    await expect(createUser('alice', 'password123')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
    })
  })
})

import { registerSchema } from '@/lib/schemas'

describe('registerSchema', () => {
  it('rejects password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({ username: 'alice', password: 'short' })
    expect(result.success).toBe(false)
  })

  it('accepts password exactly 8 characters', () => {
    const result = registerSchema.safeParse({ username: 'alice', password: 'exactly8' })
    expect(result.success).toBe(true)
  })

  it('accepts password exactly 72 characters', () => {
    const result = registerSchema.safeParse({ username: 'alice', password: 'a'.repeat(72) })
    expect(result.success).toBe(true)
  })

  it('rejects password longer than 72 characters', () => {
    const result = registerSchema.safeParse({ username: 'alice', password: 'a'.repeat(73) })
    expect(result.success).toBe(false)
  })

  it('rejects whitespace-only username after trim', () => {
    const result = registerSchema.safeParse({ username: '   ', password: 'password123' })
    expect(result.success).toBe(false)
  })
})
