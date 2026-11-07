import type { Msg, Role } from "../shared/protocol.ts";
import type { NetStatus, Transport } from "./transport.ts";

/** Stub. The network track implements the same-origin WebSocket transport here. */
export class WebSocketTransport implements Transport {
  constructor(readonly room: string, readonly role: Role) {}
  send(_m: Msg) {}
  onMessage(_cb: (m: Msg) => void) {}
  onPeer(cb: (connected: boolean) => void) { cb(false); }
  onStatus(cb: (s: NetStatus) => void) { cb("connecting"); }
  close() {}
}
