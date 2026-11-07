import type { Transport } from "./net/transport.ts";
import type { Role } from "./shared/protocol.ts";

/**
 * DOM title screen (owned by the network track). Renders into `root`, and calls `start` once the
 * player has picked a role and a room, then removes itself.
 */
export function showTitle(root: HTMLElement, start: (role: Role, transport: Transport, room: string) => void): void {
  void start;
  root.innerHTML = `<div style="margin:auto;text-align:center"><h1>Overlap</h1><p><a style="color:#e8ecff" href="?local=1">Play on one screen</a></p></div>`;
}
