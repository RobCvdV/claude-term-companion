import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CompanionClient, type WebSocketLike } from './client'
import { loadIdentity, toBase64, type KeyStore } from './identity'
import type { ServerFrame } from './frames'

/**
 * Drives this app's own client against a real claude-term, over the tailnet.
 *
 * Everything else about the app can be typechecked; this is the only way to know
 * the handshake it actually sends is the one a Mac accepts. Node's global
 * WebSocket stands in for React Native's, which is the same API.
 *
 * Opt-in, because it needs a Mac to talk to:
 *
 *   COMPANION_HOST=100.x.y.z COMPANION_PORT=50987 \
 *     COMPANION_KEY=/path/to/client.json npx vitest run lib/host.e2e.test.ts
 *
 * COMPANION_KEY points at a store written by claude-term's own
 * scripts/companion-client.mjs, so an already-trusted device can be reused
 * instead of burning a fresh pairing code.
 */
const host = process.env.COMPANION_HOST
const port = Number(process.env.COMPANION_PORT)
const keyFile = process.env.COMPANION_KEY
const RUN = Boolean(host && port && keyFile)

/** A pkcs8 Ed25519 key is a 16-byte header then the 32-byte seed. */
function seedFromPkcs8Pem(pem: string): Uint8Array {
  const der = Buffer.from(pem.replace(/-----[^-]+-----|\s/g, ''), 'base64')
  if (der.length !== 48) throw new Error(`expected a 48-byte pkcs8 key, got ${der.length}`)
  return new Uint8Array(der.subarray(16))
}

function storeFrom(seed: Uint8Array, deviceId: string): KeyStore {
  const data = new Map<string, string>([
    ['companion.secret', toBase64(seed)],
    ['companion.deviceId', deviceId]
  ])
  return {
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k)
  }
}

describe.runIf(RUN)('against a real claude-term', () => {
  it('authenticates and is told about the sessions', async () => {
    const saved = JSON.parse(readFileSync(keyFile!, 'utf8')) as {
      deviceId: string
      privateKey: string
    }
    const identity = await loadIdentity(
      storeFrom(seedFromPkcs8Pem(saved.privateKey), saved.deviceId),
      () => {
        throw new Error('should not need new randomness')
      }
    )

    const frames: ServerFrame[] = []
    const statuses: string[] = []
    const client = new CompanionClient(
      identity,
      {
        onStatus: (status) => statuses.push(status),
        onFrame: (frame) => frames.push(frame)
      },
      (url) => new WebSocket(url) as unknown as WebSocketLike,
      'vitest harness'
    )

    client.connect({ host: host!, port })
    const until = Date.now() + 15_000
    while (Date.now() < until && client.status !== 'ready' && client.status !== 'error') {
      await new Promise((r) => setTimeout(r, 100))
    }
    expect(client.status, statuses.join(' → ')).toBe('ready')

    const ready = frames.find((f) => f.type === 'ready')
    expect(ready).toBeDefined()

    client.send({ type: 'sessions' })
    const gotSessions = Date.now() + 5_000
    while (Date.now() < gotSessions && !frames.some((f) => f.type === 'sessions')) {
      await new Promise((r) => setTimeout(r, 100))
    }
    expect(frames.some((f) => f.type === 'sessions')).toBe(true)
    client.disconnect()
  }, 30_000)
})
