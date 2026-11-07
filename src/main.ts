import { startGame } from "./game.ts";
import { localPair } from "./net/local.ts";
import { WebSocketTransport } from "./net/ws.ts";
import type { Role } from "./shared/protocol.ts";
import { showTitle } from "./title.ts";

const q = new URLSearchParams(location.search);
const app = document.getElementById("app")!;
const room = q.get("room")?.toUpperCase();
const role: Role = q.get("role") === "guide" ? "guide" : "runner";

if (q.has("local")) {
  // One screen, both roles: the showcase fallback and the main dev loop.
  const [runnerSide, guideSide] = localPair();
  app.classList.add("split");
  startGame(app, "runner", runnerSide);
  startGame(app, "guide", guideSide);
} else if (room) {
  startGame(app, role, new WebSocketTransport(room, role), room);
} else {
  showTitle(app, (r, transport, code) => startGame(app, r, transport, code));
}
