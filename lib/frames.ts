import { clientFrame, type ClientFrame as ProtocolClientFrame } from 'claude-term-protocol'

export * from 'claude-term-protocol'
export type ClientFrame = ProtocolClientFrame

/**
 * Frames coming *from* the host.
 *
 * The protocol package types these but does not carry a schema for them: the
 * host is the thing we already trust to the extent of letting it drive our UI,
 * and a phone that rejected a frame from a newer host would simply stop working.
 * So parse loosely — well-formed JSON with a string `type` — and let the screens
 * ignore what they do not recognise.
 */
export type ServerFrame = import('claude-term-protocol').ServerFrame

export function parseServerFrameLoose(raw: string): ServerFrame | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const type = (parsed as { type?: unknown }).type
    return typeof type === 'string' ? (parsed as ServerFrame) : null
  } catch {
    return null
  }
}

/** Our own frames are checked before sending, so a bug here fails loudly. */
export function assertClientFrame(frame: ClientFrame): ClientFrame {
  return clientFrame.parse(frame)
}
