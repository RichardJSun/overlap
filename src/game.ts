import Phaser from "phaser";
import type { Transport } from "./net/transport.ts";
import { EndingScene } from "./scenes/Ending.ts";
import { GuideScene } from "./scenes/Guide.ts";
import { RunnerScene } from "./scenes/Runner.ts";
import type { Role } from "./shared/protocol.ts";

/** Data every play scene receives from `scene.start`. `local` means both roles share this window. */
export type SceneData = { transport: Transport; room?: string; local?: boolean };

/** Mounts one Phaser game for one role in its own pane inside `parent`. */
export function startGame(parent: HTMLElement, role: Role, transport: Transport, room?: string, local = false): Phaser.Game {
  const pane = document.createElement("div");
  pane.dataset.role = role;
  parent.appendChild(pane);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: pane,
    backgroundColor: "#0b1020",
    scale: { mode: Phaser.Scale.RESIZE },
    render: { antialias: true },
    scene: [],
  });
  game.scene.add("runner", RunnerScene);
  game.scene.add("guide", GuideScene);
  game.scene.add("ending", EndingScene);
  game.scene.start(role, { transport, room, local } satisfies SceneData);
  // Phaser only re-measures on window resize; split panes and rotation change the pane alone.
  new ResizeObserver(() => game.scale.refresh()).observe(pane);
  return game;
}
