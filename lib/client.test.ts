import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PROTOCOL_VERSION } from "./frames";
import { CompanionClient, type WebSocketLike } from "./client";
import type { Identity } from "./identity";

/**
 * What the app says while it cannot reach the Mac.
 *
 * This mattered on a real phone: iOS resets an app's **Local Network**
 * permission on every reinstall, and with it denied not one packet leaves the
 * device. The app showed "reconnecting" forever and the host saw no TCP at all,
 * which took an afternoon to work out. The status line is the only place a
 * person can learn this, so it is worth a test.
 */

const identity: Identity = {
  deviceId: "device-1",
  publicKey: "key",
  sign: () => "signature",
};

/** A socket that never opens: `close()` it to simulate a failed connect. */
function deadSocket(): WebSocketLike & { fail: () => void } {
  const socket: WebSocketLike & { fail: () => void } = {
    send: () => {},
    close: () => {},
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    fail: () => socket.onclose?.(),
  };
  return socket;
}

/** A socket that answers with the host's challenge, as a reachable Mac does. */
function talkingSocket(): WebSocketLike & {
  greet: () => void;
  fail: () => void;
} {
  const socket: WebSocketLike & { greet: () => void; fail: () => void } = {
    send: () => {},
    close: () => {},
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    greet: () =>
      socket.onmessage?.({
        data: JSON.stringify({
          type: "challenge",
          nonce: "n",
          protocol: PROTOCOL_VERSION,
        }),
      }),
    fail: () => socket.onclose?.(),
  };
  return socket;
}

function withClient(makeSocket: () => WebSocketLike): {
  client: CompanionClient;
  details: (string | undefined)[];
} {
  const details: (string | undefined)[] = [];
  const client = new CompanionClient(
    identity,
    { onStatus: (_s, detail) => details.push(detail), onFrame: () => {} },
    () => makeSocket(),
  );
  return { client, details };
}

const HINT = /can't reach the Mac/;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("an unreachable host", () => {
  it('says "reconnecting" for the first blips, then names the likely cause', () => {
    let socket = deadSocket();
    const { client, details } = withClient(() => (socket = deadSocket()));
    client.connect({ host: "100.0.0.1", port: 1 });

    socket.fail();
    expect(details.at(-1)).toBe("reconnecting");

    // each retry re-dials and closes again; the hint arrives once a blip is
    // no longer a plausible explanation
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(60_000);
      socket.fail();
    }
    expect(details.at(-1)).toMatch(HINT);
  });

  it("blames the code, not the network, once the host has answered", () => {
    let socket = talkingSocket();
    const { client, details } = withClient(() => (socket = talkingSocket()));
    client.connect({ host: "100.0.0.1", port: 1 });

    for (let i = 0; i < 4; i++) {
      socket.greet();
      socket.fail();
      vi.advanceTimersByTime(60_000);
    }
    expect(details.every((d) => !d || !HINT.test(d))).toBe(true);
    // the trailing undefined is the next re-dial announcing itself
    expect(details.filter(Boolean).at(-1)).toBe("reconnecting");
  });

  // A pairing code is never re-sent on our own initiative, so this is the only
  // message the person waiting on the pair screen will get.
  it("does not blame a pairing code that never reached the host", () => {
    let socket = deadSocket();
    const { client, details } = withClient(() => (socket = deadSocket()));
    client.pair({ host: "100.0.0.1", port: 1 }, "ABCD2345");
    socket.fail();
    expect(details.at(-1)).toMatch(HINT);
    expect(details.at(-1)).not.toMatch(/pairing did not complete/);
  });

  it("still blames the pairing code when the host refused it", () => {
    let socket = talkingSocket();
    const { client, details } = withClient(() => (socket = talkingSocket()));
    client.pair({ host: "100.0.0.1", port: 1 }, "ABCD2345");
    socket.greet();
    socket.fail();
    expect(details.at(-1)).toBe("pairing did not complete");
  });
});
