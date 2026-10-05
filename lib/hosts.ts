/**
 * The Macs this phone is paired with.
 *
 * One Ed25519 key enrols with as many hosts as you like — each stores the public
 * half separately — so being paired with several is only a matter of remembering
 * more than one address. Exactly one of them is live at a time; the rest sit
 * here waiting to be switched to.
 *
 * Kept free of Expo imports so the bookkeeping can be tested under Node.
 */

export interface SavedHost {
  host: string
  port: number
  /** what the Mac called itself the last time we reached it */
  name?: string
}

export interface HostBook {
  hosts: SavedHost[]
  /** key() of the one the app talks to; null when the book is empty */
  active: string | null
}

export const EMPTY_BOOK: HostBook = { hosts: [], active: null }

/** Address and port together identify a host — the name is only a label. */
export function key(entry: { host: string; port: number }): string {
  return `${entry.host}:${entry.port}`
}

export function activeHost(book: HostBook): SavedHost | null {
  return book.hosts.find((h) => key(h) === book.active) ?? null
}

export function label(entry: SavedHost): string {
  return entry.name?.trim() || entry.host
}

/** Add a host, or update what we know about one, and make it the live one. */
export function remember(book: HostBook, entry: SavedHost): HostBook {
  const k = key(entry)
  const existing = book.hosts.find((h) => key(h) === k)
  return {
    // a re-pair must not lose the name when the host has not told us one yet
    hosts: existing
      ? book.hosts.map((h) => (key(h) === k ? { ...h, ...entry, name: entry.name ?? h.name } : h))
      : [...book.hosts, entry],
    active: k
  }
}

/** Drop a host. Forgetting the live one hands the connection to whatever is left. */
export function forget(book: HostBook, k: string): HostBook {
  const hosts = book.hosts.filter((h) => key(h) !== k)
  if (book.active !== k) return { hosts, active: book.active }
  return { hosts, active: hosts.length ? key(hosts[0]) : null }
}

/**
 * Read a stored book, tolerating anything. This comes out of the Keychain, and a
 * phone that threw its Macs away because one field was the wrong shape would be
 * worse than one that quietly starts over.
 */
export function parseBook(raw: string | null): HostBook {
  if (!raw) return EMPTY_BOOK
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return EMPTY_BOOK
    const { hosts, active } = parsed as { hosts?: unknown; active?: unknown }
    if (!Array.isArray(hosts)) return EMPTY_BOOK
    const clean = hosts.flatMap((h): SavedHost[] => {
      const entry = h as { host?: unknown; port?: unknown; name?: unknown }
      if (typeof entry?.host !== 'string' || !entry.host) return []
      const port = Number(entry.port)
      if (!Number.isFinite(port) || port <= 0) return []
      return [
        { host: entry.host, port, ...(typeof entry.name === 'string' ? { name: entry.name } : {}) }
      ]
    })
    const wanted = typeof active === 'string' ? active : null
    return {
      hosts: clean,
      active: clean.some((h) => key(h) === wanted) ? wanted : (clean[0] ? key(clean[0]) : null)
    }
  } catch {
    return EMPTY_BOOK
  }
}
