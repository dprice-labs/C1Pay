import { describe, it, expect, afterEach, afterAll } from 'vitest'
import { db } from '@/db/index'
import { users } from '@/db/schema/users'
import { paymentRequests } from '@/db/schema/requests'
import { transactions } from '@/db/schema/transactions'
import { eq, or } from 'drizzle-orm'
import { createUser } from '@/lib/users'
import { createRequest, getInboxRequests, payRequest, declineRequest } from '@/lib/requests'

const REQUESTER_USERNAME = '__req_test_requester__'
const RECIPIENT_USERNAME = '__req_test_recipient__'

afterAll(async () => {
  await globalThis._pgClient?.end()
  globalThis._pgClient = undefined
})

afterEach(async () => {
  // Must delete in FK-safe order: transactions → payment_requests → users
  const testUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(or(eq(users.username, REQUESTER_USERNAME), eq(users.username, RECIPIENT_USERNAME)))

  for (const u of testUsers) {
    await db
      .delete(transactions)
      .where(
        or(eq(transactions.senderId, u.id), eq(transactions.recipientId, u.id)),
      )
    await db
      .delete(paymentRequests)
      .where(
        or(eq(paymentRequests.requesterId, u.id), eq(paymentRequests.recipientId, u.id)),
      )
  }

  await db
    .delete(users)
    .where(or(eq(users.username, REQUESTER_USERNAME), eq(users.username, RECIPIENT_USERNAME)))
})

describe('createRequest integration', () => {
  it('inserts a payment_requests row with status PENDING', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await createRequest(requester.id, recipient.id, 5000, 'coffee')

    const rows = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.requesterId, requester.id))

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      requesterId: requester.id,
      recipientId: recipient.id,
      amountCents: 5000,
      note: 'coffee',
      status: 'PENDING',
      resolvedAt: null,
    })
  })

  it('inserts with null note when note is omitted', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await createRequest(requester.id, recipient.id, 10000)

    const rows = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.requesterId, requester.id))

    expect(rows).toHaveLength(1)
    expect(rows[0]!.note).toBeNull()
    expect(rows[0]!.resolvedAt).toBeNull()
  })

  it('throws SELF_REQUEST and inserts no row', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')

    await expect(createRequest(requester.id, requester.id, 5000)).rejects.toMatchObject({
      code: 'SELF_REQUEST',
    })

    const rows = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.requesterId, requester.id))

    expect(rows).toHaveLength(0)
  })

  it('throws INVALID_AMOUNT for zero and negative amounts', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await expect(createRequest(requester.id, recipient.id, 0)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    })
    await expect(createRequest(requester.id, recipient.id, -100)).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    })

    const rows = await db
      .select()
      .from(paymentRequests)
      .where(eq(paymentRequests.requesterId, requester.id))

    expect(rows).toHaveLength(0)
  })
})

describe('getInboxRequests integration', () => {
  it('returns PENDING incoming requests with resolved requester username', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await createRequest(requester.id, recipient.id, 7500, 'lunch')

    const items = await getInboxRequests(recipient.id)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      requesterUsername: REQUESTER_USERNAME,
      amountCents: 7500,
      note: 'lunch',
    })
    expect(items[0]!.id).toBeTypeOf('number')
    expect(items[0]!.createdAt).toBeInstanceOf(Date)
  })

  it('excludes outgoing requests (user is requester, not recipient)', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    await createRequest(requester.id, recipient.id, 5000)

    const items = await getInboxRequests(requester.id)

    expect(items).toHaveLength(0)
  })

  it.each([
    ['PAID'],
    ['DECLINED'],
    ['CANCELLED'],
  ] as const)('excludes %s requests', async (status) => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    const req = await createRequest(requester.id, recipient.id, 3000)
    await db
      .update(paymentRequests)
      .set({ status })
      .where(eq(paymentRequests.id, req.id))

    const items = await getInboxRequests(recipient.id)

    expect(items).toHaveLength(0)
  })

  it('returns empty array when no pending requests exist', async () => {
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')

    const items = await getInboxRequests(recipient.id)

    expect(items).toHaveLength(0)
  })
})

describe('payRequest integration', () => {
  it('debits payer, credits requester, inserts transactions row, and sets status PAID', async () => {
    // requester requests 5000 from recipient; recipient pays
    const requester = await createUser(REQUESTER_USERNAME, 'pass') // balance = 100000
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass') // balance = 100000
    const req = await createRequest(requester.id, recipient.id, 5000, 'coffee')

    const result = await payRequest(req.id, recipient.id)

    // Request is now PAID with resolvedAt set
    expect(result.status).toBe('PAID')
    expect(result.resolvedAt).toBeInstanceOf(Date)

    // Balances updated atomically
    const [updatedRecipient] = await db.select().from(users).where(eq(users.id, recipient.id))
    const [updatedRequester] = await db.select().from(users).where(eq(users.id, requester.id))
    expect(updatedRecipient!.balanceCents).toBe(100000 - 5000) // payer debited
    expect(updatedRequester!.balanceCents).toBe(100000 + 5000) // requester credited

    // transactions row inserted
    const txRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.senderId, recipient.id))
    expect(txRows).toHaveLength(1)
    expect(txRows[0]).toMatchObject({
      senderId: recipient.id,
      recipientId: requester.id,
      amountCents: 5000,
      note: 'coffee',
    })

    // Request removed from active inbox
    const inbox = await getInboxRequests(recipient.id)
    expect(inbox).toHaveLength(0)
  })

  it('throws INSUFFICIENT_BALANCE when payer has no balance — no changes persisted', async () => {
    // Give recipient 0 balance by using a fresh createUser and then zeroing balance
    const requester = await createUser(REQUESTER_USERNAME, 'pass') // balance = 100000
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass') // balance = 100000
    // Zero out recipient balance
    await db.update(users).set({ balanceCents: 0 }).where(eq(users.id, recipient.id))

    const req = await createRequest(requester.id, recipient.id, 5000)

    await expect(payRequest(req.id, recipient.id)).rejects.toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
    })

    // Balances unchanged
    const [updatedRecipient] = await db.select().from(users).where(eq(users.id, recipient.id))
    const [updatedRequester] = await db.select().from(users).where(eq(users.id, requester.id))
    expect(updatedRecipient!.balanceCents).toBe(0)
    expect(updatedRequester!.balanceCents).toBe(100000)

    // No transactions row inserted
    const txRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.senderId, recipient.id))
    expect(txRows).toHaveLength(0)

    // Request still PENDING
    const [req2] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, req.id))
    expect(req2!.status).toBe('PENDING')
  })

  it('throws REQUEST_ALREADY_RESOLVED when request is already PAID', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')
    const req = await createRequest(requester.id, recipient.id, 1000)

    // Pay once
    await payRequest(req.id, recipient.id)

    // Attempt to pay again
    await expect(payRequest(req.id, recipient.id)).rejects.toMatchObject({
      code: 'REQUEST_ALREADY_RESOLVED',
    })
  })
})

describe('declineRequest integration', () => {
  it('sets status DECLINED with resolvedAt and no balance changes', async () => {
    const requester = await createUser(REQUESTER_USERNAME, 'pass')
    const recipient = await createUser(RECIPIENT_USERNAME, 'pass')
    const req = await createRequest(requester.id, recipient.id, 3000)

    const result = await declineRequest(req.id, recipient.id)

    expect(result.status).toBe('DECLINED')
    expect(result.resolvedAt).toBeInstanceOf(Date)

    // Balances unchanged — no funds moved
    const [updatedRecipient] = await db.select().from(users).where(eq(users.id, recipient.id))
    const [updatedRequester] = await db.select().from(users).where(eq(users.id, requester.id))
    expect(updatedRecipient!.balanceCents).toBe(100000)
    expect(updatedRequester!.balanceCents).toBe(100000)

    // No transactions row inserted
    const txRows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.senderId, recipient.id))
    expect(txRows).toHaveLength(0)

    // Request removed from active inbox
    const inbox = await getInboxRequests(recipient.id)
    expect(inbox).toHaveLength(0)
  })
})
