import { createLogger } from '@/lib/logger'
import type { SSEEvent } from '@/types'

const log = createLogger('sse-emitter')
const encoder = new TextEncoder()

declare global {
  // eslint-disable-next-line no-var
  var __sseWriters: Map<number, WritableStreamDefaultWriter> | undefined
}

const writers: Map<number, WritableStreamDefaultWriter> =
  globalThis.__sseWriters ?? (globalThis.__sseWriters = new Map())

export function register(userId: number, writer: WritableStreamDefaultWriter): void {
  const existing = writers.get(userId)
  if (existing) existing.close().catch(() => {})
  writers.set(userId, writer)
  log.info(`registered userId=${userId} (total=${writers.size})`)
}

// writer param enables identity-checked deletion: only removes the entry if it still
// points to this specific writer, preventing a late abort from evicting a newer connection.
export function deregister(userId: number, writer?: WritableStreamDefaultWriter): void {
  if (writer !== undefined && writers.get(userId) !== writer) return
  writers.delete(userId)
  log.info(`deregistered userId=${userId} (total=${writers.size})`)
}

// A default TransformStream starts backpressured, so writer.write() stays pending until the
// recipient's connection is actively pulling. A stalled recipient (backgrounded/throttled
// tab, slow network, full TCP window) would otherwise leave the write pending indefinitely —
// hanging any awaiting caller and leaking a forever-pending promise. Bound it: on timeout we
// treat the writer as dead, deregister it, and abort the stream so the client's EventSource
// reconnects cleanly.
const WRITE_TIMEOUT_MS = 10_000

export async function emit(userId: number, event: SSEEvent): Promise<void> {
  const writer = writers.get(userId)
  if (!writer) return

  const text = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
  const write = writer.write(encoder.encode(text))
  // If we abort after a timeout, the underlying write rejects later — swallow it here so it
  // never surfaces as an unhandled rejection.
  write.catch(() => {})

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      write,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('SSE write timed out')), WRITE_TIMEOUT_MS)
      }),
    ])
  } catch {
    log.error(`write failed or stalled for userId=${userId} — deregistering`)
    deregister(userId, writer)
    writer.abort().catch(() => {})
  } finally {
    if (timer) clearTimeout(timer)
  }
}
