import {
  parseServerFrameLoose,
  PROTOCOL_VERSION,
  type ClientFrame,
  type ServerFrame,
} from "./frames";
import type { Identity } from "./identity";

/**
 * The connection to a claude-term host.
 *
 * Reachable only over the tailnet, so there is no relay and no cloud: this dials
 * the Mac directly. Confidentiality comes from WireGuard; what happens here is
 * proving *which* device this is, by signing a nonce the host just chose. No
 * token is ever sent.
 */

export interface Connection {
  host: string;
  port: number;
  /** what the host called itself, for the settings screen */
  hostName?: string;
}

export type ClientStatus =
  "idle" | "connecting" | "pairing" | "ready" | "error";

export interface ClientEvents {
  onStatus: (status: ClientStatus, detail?: string) => void;
  onFrame: (frame: ServerFrame) => void;
}

/** Injected so the same client runs under Node in tests. */
export type SocketFactory = (url: string) => WebSocketLike;

export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  onopen: ((event?: unknown) => void) | null;
  onclose: ((event?: unknown) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
}

/** Backoff for a phone that keeps waking up on a different network. */
const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
const PING_MS = 25_000;

/**
 * What to say when the socket never even opened. Two causes look identical from
 * here and both are invisible: Tailscale being off on either end, and — the one
 * that cost an afternoon — iOS having reset this app's **Local Network**
 * permission, which a reinstall does silently. With it denied, not a single
 * packet leaves the phone and the old message was an endless "reconnecting".
 */
const UNREACHABLE =
  "can't reach the Mac — check Tailscale, and Local Network in iOS Settings";

/** Retries spent before blaming reachability; the first blips are ordinary. */
const UNREACHABLE_AFTER = 2;

export class CompanionClient {
  private socket: WebSocketLike | null = null;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pairingCode: string | null = null;
  private closedByUs = false;
  /** The host answered on this attempt (its challenge arrived), so a later
   *  failure is about the code or the key — not about being unreachable. */
  private heardHost = false;

  status: ClientStatus = "idle";

  constructor(
    private readonly identity: Identity,
    private readonly events: ClientEvents,
    private readonly makeSocket: SocketFactory = (url) =>
      new WebSocket(url) as unknown as WebSocketLike,
    private readonly deviceName = "phone",
    private readonly pushToken: () => string | null = () => null,
  ) {}

  /** Connect and authenticate with a key the host already trusts. */
  connect(connection: Connection): void {
    this.pairingCode = null;
    this.open(connection);
  }

  /** Connect and enrol, using a code the host is showing right now. */
  pair(connection: Connection, code: string): void {
    this.pairingCode = code;
    this.open(connection);
  }

  disconnect(): void {
    this.closedByUs = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
    this.setStatus("idle");
  }

  send(frame: ClientFrame): void {
    if (this.status !== "ready") return;
    try {
      this.socket?.send(JSON.stringify(frame));
    } catch {
      // the socket went away between the check and the send; the reconnect
      // handles it
    }
  }

  /** Tell the host whether this session is on screen, so it can skip a push. */
  reportForeground(foreground: boolean, tabId: string | null): void {
    this.send({ type: "appState", foreground, tabId });
  }

  private open(connection: Connection): void {
    this.closedByUs = false;
    this.heardHost = false;
    this.clearTimers();
    this.socket?.close();
    this.setStatus(this.pairingCode ? "pairing" : "connecting");

    let socket: WebSocketLike;
    try {
      socket = this.makeSocket(`ws://${connection.host}:${connection.port}`);
    } catch (err) {
      this.fail(connection, String(err));
      return;
    }
    this.socket = socket;

    socket.onmessage = (event) => {
      const frame = parseServerFrameLoose(String(event.data));
      if (frame) this.handle(frame);
    };
    socket.onerror = () => {
      // onclose always follows, and carries the retry
    };
    socket.onclose = () => {
      this.clearTimers();
      if (this.closedByUs) return;
      this.setStatus(
        "connecting",
        this.unreachable() ? UNREACHABLE : "reconnecting",
      );
      this.scheduleRetry(connection);
    };
  }

  private handle(frame: ServerFrame): void {
    // Anything at all means the Mac is there and talking to us.
    this.heardHost = true;
    if (frame.type === "challenge") {
      if (frame.protocol !== PROTOCOL_VERSION) {
        this.closedByUs = true;
        this.socket?.close();
        this.setStatus(
          "error",
          `host speaks protocol ${frame.protocol}, this app speaks ${PROTOCOL_VERSION}`,
        );
        return;
      }
      const signature = this.identity.sign(frame.nonce);
      const pushToken = this.pushToken() ?? undefined;
      if (this.pairingCode) {
        this.raw({
          type: "pair",
          protocol: PROTOCOL_VERSION,
          deviceId: this.identity.deviceId,
          name: this.deviceName,
          publicKey: this.identity.publicKey,
          code: this.pairingCode,
          signature,
          ...(pushToken ? { pushToken } : {}),
        });
      } else {
        this.raw({
          type: "auth",
          protocol: PROTOCOL_VERSION,
          deviceId: this.identity.deviceId,
          signature,
          ...(pushToken ? { pushToken } : {}),
        });
      }
      return;
    }

    if (frame.type === "ready") {
      // a pairing code is spent the moment it works
      this.pairingCode = null;
      this.retries = 0;
      this.setStatus("ready");
      this.startPing();
    }

    if (frame.type === "error" && this.status !== "ready") {
      // refused during the handshake: retrying would only burn the code again
      this.closedByUs = true;
      this.setStatus("error", frame.message);
      this.socket?.close();
      return;
    }

    this.events.onFrame(frame);
  }

  /** Bypasses the ready check, for handshake frames. */
  private raw(frame: ClientFrame): void {
    try {
      this.socket?.send(JSON.stringify(frame));
    } catch {
      /* the close handler picks it up */
    }
  }

  /** Never heard from the host, and past the point where a blip explains it. */
  private unreachable(): boolean {
    return !this.heardHost && this.retries >= UNREACHABLE_AFTER;
  }

  private scheduleRetry(connection: Connection): void {
    if (this.pairingCode) {
      // never re-send a pairing code on our own initiative. A code that was
      // never even offered to the host is not what went wrong, so say what did.
      this.setStatus(
        "error",
        this.heardHost ? "pairing did not complete" : UNREACHABLE,
      );
      return;
    }
    const delay = RETRY_MS[Math.min(this.retries, RETRY_MS.length - 1)];
    this.retries++;
    this.retryTimer = setTimeout(() => this.open(connection), delay);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => this.send({ type: "ping" }), PING_MS);
  }

  private clearTimers(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.retryTimer = null;
    this.pingTimer = null;
  }

  private fail(connection: Connection, detail: string): void {
    this.setStatus("error", detail);
    this.scheduleRetry(connection);
  }

  private setStatus(status: ClientStatus, detail?: string): void {
    this.status = status;
    this.events.onStatus(status, detail);
  }
}
