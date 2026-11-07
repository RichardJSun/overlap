import type { Msg } from "../shared/protocol.ts";

export type NetStatus = "connecting" | "online" | "reconnecting";

/**
 * A two-party message pipe. Implementations must:
 * - buffer incoming messages until the first `onMessage` listener is registered,
 * - call a newly registered `onPeer` / `onStatus` listener at once with the current value,
 * - accept `send` at any time (queue while not connected).
 */
export interface Transport {
  send(m: Msg): void;
  onMessage(cb: (m: Msg) => void): void;
  onPeer(cb: (connected: boolean) => void): void;
  onStatus(cb: (s: NetStatus) => void): void;
  close(): void;
}
