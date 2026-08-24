import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import type { KeyStore } from './identity'

/** The device key lives in the Keychain, not in app storage. */
export const keychain: KeyStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key)
}

export const randomBytes = (n: number): Uint8Array => Crypto.getRandomBytes(n)

const HOST = 'companion.host'
const PORT = 'companion.port'

export async function loadConnection(): Promise<{ host: string; port: number } | null> {
  const host = await SecureStore.getItemAsync(HOST)
  const port = await SecureStore.getItemAsync(PORT)
  return host && port ? { host, port: Number(port) } : null
}

export async function saveConnection(host: string, port: number): Promise<void> {
  await SecureStore.setItemAsync(HOST, host)
  await SecureStore.setItemAsync(PORT, String(port))
}

export async function forgetConnection(): Promise<void> {
  await SecureStore.deleteItemAsync(HOST)
  await SecureStore.deleteItemAsync(PORT)
}
