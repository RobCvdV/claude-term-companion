import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import type { KeyStore } from './identity'
import { parseBook, remember, type HostBook } from './hosts'

/** The device key lives in the Keychain, not in app storage. */
export const keychain: KeyStore = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key)
}

export const randomBytes = (n: number): Uint8Array => Crypto.getRandomBytes(n)

const BOOK = 'companion.hosts'
/** Where the one-and-only Mac used to live, before there could be several. */
const LEGACY_HOST = 'companion.host'
const LEGACY_PORT = 'companion.port'

export async function loadBook(): Promise<HostBook> {
  const book = parseBook(await SecureStore.getItemAsync(BOOK))
  if (book.hosts.length) return book

  const host = await SecureStore.getItemAsync(LEGACY_HOST)
  const port = Number(await SecureStore.getItemAsync(LEGACY_PORT))
  if (!host || !Number.isFinite(port) || port <= 0) return book
  const migrated = remember(book, { host, port })
  await saveBook(migrated)
  await SecureStore.deleteItemAsync(LEGACY_HOST)
  await SecureStore.deleteItemAsync(LEGACY_PORT)
  return migrated
}

export async function saveBook(book: HostBook): Promise<void> {
  await SecureStore.setItemAsync(BOOK, JSON.stringify(book))
}
