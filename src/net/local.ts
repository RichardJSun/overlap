import type { Msg } from "../shared/protocol.ts";
import type { NetStatus, Transport } from "./transport.ts";

class LocalEndpoint implements Transport {
  other!: LocalEndpoint;
  private listeners: ((m: Msg) => void)[] = [];
  private inbox: Msg[] = [];
  private closed = false;

  send(m: Msg) {
    if (this.closed) return;
    // Deliver async (like a socket) and as a copy, so neither side can mutate the other's state.
    const copy = structuredClone(m);
    queueMicrotask(() => this.other.receive(copy));
  }
  receive(m: Msg) {
    if (this.listeners.length) this.listeners.forEach((cb) => cb(m));
    else this.inbox.push(m);
  }
  onMessage(cb: (m: Msg) => void) {
    this.listeners.push(cb);
    const queued = this.inbox.splice(0);
    queueMicrotask(() => queued.forEach(cb));
  }
  onPeer(cb: (connected: boolean) => void) { cb(true); }
  onStatus(cb: (s: NetStatus) => void) { cb("online"); }
  close() { this.closed = true; this.listeners = []; }
}

/** Two in-memory endpoints wired to each other: [runner side, guide side]. */
export function localPair(): [Transport, Transport] {
  const a = new LocalEndpoint(), b = new LocalEndpoint();
  a.other = b; b.other = a;
  return [a, b];
}
