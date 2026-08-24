/** What the Mac encodes in its pairing QR. Kept in step with CompanionPanel.tsx. */
export interface PairingPayload {
  host: string
  port: number
  code: string
}

/**
 * Read a scanned QR. Returns null for anything that is not one of ours, so
 * pointing the camera at a random barcode does nothing.
 */
export function parsePairingPayload(raw: string): PairingPayload | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const { v, host, port, code } = parsed as Record<string, unknown>
  if (v !== 1) return null
  if (typeof host !== 'string' || !host) return null
  if (typeof port !== 'number' || !Number.isInteger(port) || port <= 0 || port > 65535) return null
  if (typeof code !== 'string' || code.length < 6 || code.length > 32) return null
  return { host, port, code }
}
