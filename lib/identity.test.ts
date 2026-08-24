import { createPublicKey, randomBytes as nodeRandom, verify } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { authMessage, fromBase64, loadIdentity, resetIdentity, toSpkiBase64 } from './identity'
import type { KeyStore } from './identity'

/**
 * The host verifies with Node's crypto, so these assert against Node's crypto
 * directly. If this passes, the handshake is the right shape on the wire —
 * which is the one thing a phone cannot discover by running.
 */

function memoryStore(): KeyStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k)
  }
}

const random = (n: number): Uint8Array => new Uint8Array(nodeRandom(n))

describe('toSpkiBase64', () => {
  it('produces a key Node accepts as Ed25519', () => {
    const spki = toSpkiBase64(random(32))
    const key = createPublicKey({
      key: Buffer.from(spki, 'base64'),
      format: 'der',
      type: 'spki'
    })
    expect(key.asymmetricKeyType).toBe('ed25519')
  })

  it('refuses anything that is not a 32-byte key', () => {
    expect(() => toSpkiBase64(random(31))).toThrow()
    expect(() => toSpkiBase64(random(64))).toThrow()
  })
})

describe('loadIdentity', () => {
  it('signs a nonce in a way the host can verify', async () => {
    const store = memoryStore()
    const identity = await loadIdentity(store, random)
    const nonce = Buffer.from(random(32)).toString('base64')

    const key = createPublicKey({
      key: Buffer.from(identity.publicKey, 'base64'),
      format: 'der',
      type: 'spki'
    })
    const ok = verify(
      null,
      Buffer.from(authMessage(nonce, identity.deviceId)),
      key,
      Buffer.from(fromBase64(identity.sign(nonce)))
    )
    expect(ok).toBe(true)
  })

  it('binds the signature to the nonce, so it cannot be replayed', async () => {
    const identity = await loadIdentity(memoryStore(), random)
    const key = createPublicKey({
      key: Buffer.from(identity.publicKey, 'base64'),
      format: 'der',
      type: 'spki'
    })
    const signature = identity.sign('nonce-one')
    const ok = verify(
      null,
      Buffer.from(authMessage('nonce-two', identity.deviceId)),
      key,
      Buffer.from(fromBase64(signature))
    )
    expect(ok).toBe(false)
  })

  it('keeps the same key across launches', async () => {
    const store = memoryStore()
    const first = await loadIdentity(store, random)
    const second = await loadIdentity(store, random)
    expect(second.deviceId).toBe(first.deviceId)
    expect(second.publicKey).toBe(first.publicKey)
  })

  it('makes a device id the host will accept', async () => {
    const identity = await loadIdentity(memoryStore(), random)
    // the host requires at least 8 characters
    expect(identity.deviceId.length).toBeGreaterThanOrEqual(8)
    expect(identity.deviceId).toMatch(/^[0-9a-f]+$/)
  })

  it('never puts the secret anywhere but the store', async () => {
    const store = memoryStore()
    const identity = await loadIdentity(store, random)
    expect(JSON.stringify(identity)).not.toContain([...store.data.values()][0])
  })

  it('forgetting the key means the next pairing enrols a new device', async () => {
    const store = memoryStore()
    const first = await loadIdentity(store, random)
    await resetIdentity(store)
    const second = await loadIdentity(store, random)
    expect(second.deviceId).not.toBe(first.deviceId)
  })
})
