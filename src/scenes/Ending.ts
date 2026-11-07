import Phaser from "phaser";
import { sfx } from "../audio/sfx.ts";
import { showCredits } from "../credits.ts";
import type { SceneData } from "../game.ts";
import { LEVELS } from "../levels/index.ts";
import { MapView } from "../render/map.ts";
import { addPost } from "../render/post.ts";
import { makeTextures, PAL } from "../render/textures.ts";
import { TILE } from "../shared/level.ts";
import type { Role } from "../shared/protocol.ts";
import { fitCamera } from "./fit.ts";

/** Both clients show this same view: the city sweeps back on, then both characters stand together. */
export class EndingScene extends Phaser.Scene {
  private info!: SceneData & { role: Role; district: number };
  private credits?: HTMLDivElement;

  constructor() { super("ending"); }

  init(data: SceneData & { role: Role; district: number }) { this.info = data; }

  create() {
    makeTextures(this);
    addPost(this, "ending");
    const level = LEVELS[Math.min(this.info.district, LEVELS.length - 1)];
    const map = new MapView(this, level, { glyphs: false });
    level.lights.forEach((l) => map.setLamp(l.id, true));
    level.substations.forEach((s) => map.setPowered(s.id));
    map.setExitOpen(true);
    const fit = () => fitCamera(this.cameras.main, level, this.scale.width, this.scale.height, 0, 120);
    fit();
    this.scale.on("resize", fit);

    // Darkness tiles fade out in order of distance from the last substation: the power sweep.
    const origin = level.substations.at(-1)!;
    const maxD = Math.hypot(level.w, level.h);
    for (let y = 0; y < level.h; y++)
      for (let x = 0; x < level.w; x++) {
        const d = Math.hypot(x - origin.x, y - origin.y);
        const dark = this.add.rectangle(x * TILE + TILE / 2, y * TILE + TILE / 2, TILE + 1, TILE + 1, PAL.night, 0.94).setDepth(5);
        this.tweens.add({ targets: dark, alpha: 0, delay: 400 + (d / maxD) * 2600, duration: 500, ease: "Quad.easeOut" });
      }
    const warm = this.add.rectangle(0, 0, level.w * TILE, level.h * TILE, PAL.warm, 0).setOrigin(0).setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: warm, fillAlpha: 0.12, delay: 1800, duration: 2500 });

    const ex = level.exit.x * TILE + TILE / 2, ey = level.exit.y * TILE + TILE / 2;
    const runner = this.add.image(ex - 14, ey, "runner").setDepth(10).setAlpha(0).setScale(1.6);
    const guide = this.add.image(ex + 14, ey, "guide").setDepth(10).setAlpha(0).setScale(1.6);
    this.tweens.add({ targets: [runner, guide], alpha: 1, delay: 3400, duration: 800 });
    this.tweens.add({ targets: [runner, guide], y: ey - 3, delay: 4200, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    sfx.ending();
    sfx.drone(0);
    sfx.ambient(1);
    this.time.delayedCall(3600, () => this.showCredits());
    this.events.once("shutdown", () => this.credits?.remove());
  }

  private showCredits() {
    this.credits = showCredits(this.game.canvas.parentElement!, () => location.assign(this.info.local ? "?local=1" : location.pathname));
  }
}
