import type { Msg, Role } from "../shared/protocol.ts";
import type { NetStatus, Transport } from "./transport.ts";

const MAX_QUEUE = 200;
const MIN_DELAY = 500;
const MAX_DELAY = 5000;
const REPLACED = 4000; // server closed us because the same role joined from another tab or device

/** Same-origin WebSocket to the Room relay, with auto-reconnect. */
export class WebSocketTransport implements Transport {
  private ws?: WebSocket;
  private status: NetStatus = "connecting";
  private peer = false;
  private inbox: Msg[] = [];
  private outbox: Msg[] = [];
  private msgCbs: ((m: Msg) => void)[] = [];
  private peerCbs: ((c: boolean) => void)[] = [];
  private statusCbs: ((s: NetStatus) => void)[] = [];
  private delay = MIN_DELAY;
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;

  constructor(readonly room: string, readonly role: Role) {
    this.connect();
  }

  private connect() {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/room/${this.room}?role=${this.role}`);
    this.ws = ws;
    ws.onopen = () => {
      this.delay = MIN_DELAY;
      ws.send(JSON.stringify({ t: "hello", role: this.role } satisfies Msg));
      for (const m of this.outbox.splice(0)) ws.send(JSON.stringify(m));
      this.setStatus("online");
    };
    ws.onmessage = (e) => {
      let m: Msg;
      try { m = JSON.parse(e.data); } catch { return; }
      if (!m || typeof m.t !== "string") return;
      if (m.t === "peer") this.setPeer(m.connected);
      else if (this.msgCbs.length) this.msgCbs.forEach((cb) => cb(m));
      else this.inbox.push(m);
    };
    ws.onclose = (e) => {
      this.ws = undefined;
      this.setPeer(false);
      if (this.closed || e.code === REPLACED) return;
      this.setStatus("reconnecting");
      this.timer = setTimeout(() => this.connect(), this.delay);
      this.delay = Math.min(this.delay * 2, MAX_DELAY);
    };
  }

  private setPeer(c: boolean) {
    if (c === this.peer) return;
    this.peer = c;
    this.peerCbs.forEach((cb) => cb(c));
  }

  private setStatus(s: NetStatus) {
    if (s === this.status) return;
    this.status = s;
    this.statusCbs.forEach((cb) => cb(s));
  }

  send(m: Msg) {
    if (this.closed) return;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else if (this.outbox.push(m) > MAX_QUEUE) this.outbox.shift(); // keep the newest
  }

  onMessage(cb: (m: Msg) => void) {
    this.msgCbs.push(cb);
    const queued = this.inbox.splice(0);
    queueMicrotask(() => queued.forEach(cb));
  }

  onPeer(cb: (connected: boolean) => void) {
    this.peerCbs.push(cb);
    cb(this.peer);
  }

  onStatus(cb: (s: NetStatus) => void) {
    this.statusCbs.push(cb);
    cb(this.status);
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    this.msgCbs = [];
    this.peerCbs = [];
    this.statusCbs = [];
    this.ws?.close(1000);
  }
}
