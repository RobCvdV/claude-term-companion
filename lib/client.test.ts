import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PROTOCOL_VERSION } from './frames'
import { CompanionClient, type WebSocketLike } from './client'
import type { Identity } from './identity'

/**
 * What the app does when it cannot reach the Mac.
 *
 * This all comes from one afternoon on a real phone. iOS resets an app's
 * **Local Network** permission on every reinstall, and with it denied not one
 * packet leaves the device — while the host, correctly, sees no TCP at all.
 * Worse, a dial to an address nothing answers on does not fail: the connect
 * hangs, so the status stayed 'pairing', and the Pair button is disabled in
 * that state. The screen looked frozen and there was nothing to press.
 */

const identity: Identity = {
  deviceId: 'device-1',
  publicKey: 'key',
  sign: () => 'signature'
}

/** A socket that neither opens nor closes — an unreachable address. */
function hangingSocket(): WebSocketLike & { fail: () => void } {
  const socket: WebSocketLike & { fail: () => void } = {
    send: () => {},
    close: () => {},
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    fail: () => socket.onclose?.()
  }
  return socket
}

/** A socket that answers with the host's challenge, as a reachable Mac does. */
function talkingSocket(): WebSocketLike & { greet: () => void; fail: () => void } {
  const socket = hangingSocket() as WebSocketLike & { greet: () => void; fail: () => void }
  socket.greet = () =>
    socket.onmessage?.({
      data: JSON.stringify({ type: 'challenge', nonce: 'n', protocol: PROTOCOL_VERSION })
    })
  return socket
}

function withClient(makeSocket: () => WebSocketLike): {
  client: CompanionClient
  details: (string | undefined)[]
} {
  const details: (string | undefined)[] = []
  const client = new CompanionClient(
    identity,
    { onStatus: (_status, detail) => details.push(detail), onFrame: () => {} },
    () => makeSocket()
  )
  return { client, details }
}

const HINT = /can't reach the Mac/
const AFTER_DEADLINE = 9_000

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('an unreachable host', () => {
  // The regression: a hanging connect used to leave the client in 'pairing' for
  // the length of the OS timeout, with the Pair button disabled throughout.
  it('gives up on a connect that hangs, rather than sitting in pairing', () => {
    const { client } = withClient(() => hangingSocket())
    client.pair({ host: '100.0.0.1', port: 1 }, 'ABCD2345')
    expect(client.status).toBe('pairing')

    vi.advanceTimersByTime(AFTER_DEADLINE)
    expect(client.status).toBe('error')
  })

  it('gives up on a hanging connect while reconnecting too', () => {
    const { client, details } = withClient(() => hangingSocket())
    client.connect({ host: '100.0.0.1', port: 1 })
    vi.advanceTimersByTime(AFTER_DEADLINE)
    // the trailing undefined is the retry re-dialling
    expect(details.filter(Boolean).at(-1)).toBe('reconnecting')
    expect(client.status).toBe('connecting')
  })

  it('names the likely cause once a blip no longer explains it', () => {
    const { client, details } = withClient(() => hangingSocket())
    client.connect({ host: '100.0.0.1', port: 1 })
    for (let i = 0; i < 4; i++) vi.advanceTimersByTime(AFTER_DEADLINE + 60_000)
    expect(details.filter(Boolean).at(-1)).toMatch(HINT)
  })

  it('blames the code, not the network, once the host has answered', () => {
    let socket = talkingSocket()
    const { client, details } = withClient(() => (socket = talkingSocket()))
    client.connect({ host: '100.0.0.1', port: 1 })

    // greet each re-dial before its handshake deadline, so every attempt is
    // one where the host did answer
    for (let i = 0; i < 4; i++) {
      socket.greet()
      socket.fail()
      vi.advanceTimersByTime(2_000)
    }
    expect(details.every((d) => !d || !HINT.test(d))).toBe(true)
    // the trailing undefined is the next re-dial announcing itself
    expect(details.filter(Boolean).at(-1)).toBe('reconnecting')
  })

  // A pairing code is never re-sent on our own initiative, so this is the only
  // message the person waiting on the pair screen will get.
  it('does not blame a pairing code that never reached the host', () => {
    const { client, details } = withClient(() => hangingSocket())
    client.pair({ host: '100.0.0.1', port: 1 }, 'ABCD2345')
    vi.advanceTimersByTime(AFTER_DEADLINE)
    expect(details.at(-1)).toMatch(HINT)
    expect(details.at(-1)).not.toMatch(/pairing did not complete/)
  })

  it('still blames the pairing code when the host refused it', () => {
    let socket = talkingSocket()
    const { client, details } = withClient(() => (socket = talkingSocket()))
    client.pair({ host: '100.0.0.1', port: 1 }, 'ABCD2345')
    socket.greet()
    socket.fail()
    expect(details.at(-1)).toBe('pairing did not complete')
  })

  // Abandoning a socket at the deadline must not leave it able to report back:
  // a late close would otherwise schedule a second retry for the same attempt.
  it('ignores a socket that closes after it was abandoned', () => {
    const sockets: ReturnType<typeof hangingSocket>[] = []
    const { client, details } = withClient(() => {
      const socket = hangingSocket()
      sockets.push(socket)
      return socket
    })
    client.connect({ host: '100.0.0.1', port: 1 })
    vi.advanceTimersByTime(AFTER_DEADLINE)

    const after = details.length
    sockets[0].fail() // the abandoned one, long after we gave up on it
    expect(details).toHaveLength(after)
  })
})
