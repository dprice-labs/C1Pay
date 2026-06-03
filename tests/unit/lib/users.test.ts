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

  it('sets balanceCents to 100000', async () => {
    await createUser('alice', 'pass')
    const inserted = mockValues.mock.calls[0][0]
    expect(inserted.balanceCents).toBe(100000)
  })

  it('throws AppError USERNAME_TAKEN on duplicate username', async () => {
    mockReturning.mockRejectedValueOnce(
      new Error('duplicate key value violates unique constraint')
    )
    await expect(createUser('alice', 'pass')).rejects.toMatchObject({
      code: 'USERNAME_TAKEN',
      status: 409,
    })
  })
})
