import { DurableObject } from "cloudflare:workers";

type Role = "runner" | "guide";
const other = (r: Role): Role => (r === "runner" ? "guide" : "runner");
const MAX_MSG = 4096;

/** Relay only: forwards each message to the other role's socket and keeps the last snapshot for late joiners. */
export class Room extends DurableObject {
  async fetch(req: Request): Promise<Response> {
    const role = new URL(req.url).searchParams.get("role");
    if (role !== "runner" && role !== "guide") return new Response("role must be runner or guide", { status: 400 });

    const { 0: client, 1: server } = new WebSocketPair();
    // One socket per role: a new one replaces the old.
    for (const old of this.ctx.getWebSockets(role)) {
      old.serializeAttachment({ role, replaced: true });
      try { old.close(4000, "replaced"); } catch { /* already closing */ }
    }
    this.ctx.acceptWebSocket(server, [role]);
    server.serializeAttachment({ role });

    const peers = this.open(other(role));
    server.send(JSON.stringify({ t: "peer", connected: peers.length > 0 }));
    for (const p of peers) p.send(JSON.stringify({ t: "peer", connected: true }));

    if (role === "guide") {
      const s = await this.ctx.storage.get("snapshot");
      if (s) server.send(JSON.stringify({ t: "snapshot", s }));
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string" || raw.length > MAX_MSG) return;
    let m: { t?: unknown; s?: unknown };
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== "string" || m.t === "peer" || m.t === "hello") return;
    const { role } = ws.deserializeAttachment() as { role: Role };
    if (m.t === "snapshot") {
      if (role !== "runner") return; // only the runner owns world state
      await this.ctx.storage.put("snapshot", m.s);
    }
    for (const p of this.open(other(role))) p.send(raw);
  }

  async webSocketClose(ws: WebSocket, code: number) {
    const { role, replaced } = ws.deserializeAttachment() as { role: Role; replaced?: boolean };
    try { ws.close(code === 1005 ? 1000 : code, "bye"); } catch { /* already closed */ }
    if (replaced || this.open(role).some((w) => w !== ws)) return;
    for (const p of this.open(other(role))) p.send(JSON.stringify({ t: "peer", connected: false }));
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws, 1011);
  }

  private open(role: Role) {
    return this.ctx.getWebSockets(role).filter((w) => w.readyState === WebSocket.OPEN && !(w.deserializeAttachment() as { replaced?: boolean })?.replaced);
  }
}

export default {
  async fetch(req, _env, ctx) {
    const m = new URL(req.url).pathname.match(/^\/room\/([A-Za-z0-9]{4})$/);
    if (!m || req.headers.get("Upgrade")?.toLowerCase() !== "websocket") return new Response("Not found", { status: 404 });
    const room = ctx.exports.Room;
    return room.get(room.idFromName(m[1].toUpperCase())).fetch(req);
  },
} satisfies ExportedHandler<Env>;
