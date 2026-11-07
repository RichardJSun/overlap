import Phaser from "phaser";
import type { Transport } from "./net/transport.ts";
import type { Role } from "./shared/protocol.ts";

/** Data every play scene receives from `scene.start`. */
export type SceneData = { transport: Transport; room?: string };

/** Mounts one Phaser game for one role in its own pane inside `parent`. */
export function startGame(parent: HTMLElement, role: Role, transport: Transport, room?: string): Phaser.Game {
  const pane = document.createElement("div");
  pane.dataset.role = role;
  parent.appendChild(pane);
  class Placeholder extends Phaser.Scene {
    create() { this.add.text(16, 16, `${role}${room ? " · " + room : ""}`, { color: "#e8ecff", fontSize: "20px" }); void transport; }
  }
  return new Phaser.Game({ type: Phaser.AUTO, parent: pane, backgroundColor: "#0b1020", scale: { mode: Phaser.Scale.RESIZE }, scene: [Placeholder] });
}
