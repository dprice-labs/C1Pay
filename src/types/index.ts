export type SSEEvent =
  | { type: 'BALANCE_UPDATED'; data: { balance: number } }
  | { type: 'REQUEST_RECEIVED'; data: { requestId: number; fromUsername: string; amountCents: number; note?: string } }
  | { type: 'REQUEST_RESOLVED'; data: { requestId: number; status: 'PAID' | 'DECLINED' | 'CANCELLED' } }

// Stub types filled out by Epics 3-4
export interface User {
  id: number
  username: string
  balanceCents: number
  createdAt: string
}

export interface Transaction {
  id: number
  senderId: number
  recipientId: number
  amountCents: number
  note: string | null
  createdAt: string
}

export interface PaymentRequest {
  id: number
  requesterId: number
  recipientId: number
  amountCents: number
  note: string | null
  status: 'PENDING' | 'PAID' | 'DECLINED' | 'CANCELLED'
  createdAt: string
  resolvedAt: string | null
}
