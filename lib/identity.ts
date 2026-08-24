import { ed25519 } from '@noble/curves/ed25519.js'
import { AUTH_CONTEXT } from 'claude-term-protocol'

/**
 * This device's key, and the proofs it makes with it.
 *
 * Deliberately free of Expo imports so the whole handshake can be exercised
 * under Node against a real host — the part that has to be right is the wire
 * format, not the storage.
 */

/** Where a key lives between launches. Backed by the Keychain on a device. */
export interface KeyStore {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

export interface Identity {
  deviceId: string
  /** base64 SPKI, which is what the host stores and verifies against */
  publicKey: string
  sign(nonce: string): string
}

const SECRET_KEY = 'companion.secret'
const DEVICE_ID_KEY = 'companion.deviceId'

/**
 * The DER wrapper Node's `createPublicKey({ type: 'spki' })` expects around a
 * raw Ed25519 key: an AlgorithmIdentifier of 1.3.101.112 and a BIT STRING.
 * Fixed by RFC 8410, so it can simply be prefixed rather than encoded.
 */
const SPKI_PREFIX = new Uint8Array([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00
])

export function toSpkiBase64(rawPublicKey: Uint8Array): string {
  if (rawPublicKey.length !== 32) throw new Error('an Ed25519 public key is 32 bytes')
  const der = new Uint8Array(SPKI_PREFIX.length + 32)
  der.set(SPKI_PREFIX)
  der.set(rawPublicKey, SPKI_PREFIX.length)
  return toBase64(der)
}

export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  // btoa exists in Hermes and in Node 16+
  return btoa(binary)
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** The exact bytes the host expects a device to sign. */
export function authMessage(nonce: string, deviceId: string): Uint8Array {
  return new TextEncoder().encode(`${AUTH_CONTEXT}\n${nonce}\n${deviceId}`)
}

function identityFrom(secret: Uint8Array, deviceId: string): Identity {
  return {
    deviceId,
    publicKey: toSpkiBase64(ed25519.getPublicKey(secret)),
    sign: (nonce) => toBase64(ed25519.sign(authMessage(nonce, deviceId), secret))
  }
}

/**
 * This device's identity, generated on first use and kept thereafter. The secret
 * never leaves the store — the host only ever sees the public half and
 * signatures over nonces it chose itself.
 */
export async function loadIdentity(
  store: KeyStore,
  randomBytes: (n: number) => Uint8Array
): Promise<Identity> {
  const existingSecret = await store.get(SECRET_KEY)
  const existingId = await store.get(DEVICE_ID_KEY)
  if (existingSecret && existingId) {
    return identityFrom(fromBase64(existingSecret), existingId)
  }
  const secret = randomBytes(32)
  // 16 random bytes as hex — long enough that the host's minimum is met and two
  // devices never collide
  const deviceId = toHex(randomBytes(16))
  await store.set(SECRET_KEY, toBase64(secret))
  await store.set(DEVICE_ID_KEY, deviceId)
  return identityFrom(secret, deviceId)
}

/** Forget this device's key, so the next pairing enrols a new one. */
export async function resetIdentity(store: KeyStore): Promise<void> {
  await store.remove(SECRET_KEY)
  await store.remove(DEVICE_ID_KEY)
}
