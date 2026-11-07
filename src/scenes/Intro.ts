import Phaser from "phaser";
import { sfx } from "../audio/sfx.ts";
import type { SceneData } from "../game.ts";
import { LEVELS } from "../levels/index.ts";
import { LightLayer } from "../render/lights.ts";
import { MapView } from "../render/map.ts";
import { addPost } from "../render/post.ts";
import { makeTextures } from "../render/textures.ts";
import type { ColorMask } from "../shared/color.ts";
import type { LightSource } from "../shared/lighting.ts";
import type { Role } from "../shared/protocol.ts";
import { fitCamera } from "./fit.ts";

const LIT = 0x4a5068; // ambient while the grid is up: a night city, so the colored pools stand out
const POOL_COLORS: ColorMask[] = [4, 2, 1, 5, 6, 3, 4, 1, 2, 6, 5];

/**
 * Opening shot: the first street with its power on and full of colored light. The color drains out,
 * the lights die one by one, and the city goes black. Then the game starts. Any key or tap skips it.
 */
export class IntroScene extends Phaser.Scene {
  private info!: SceneData & { role: Role };
  private done = false;
  private text?: HTMLDivElement;

  constructor() { super("intro"); }

  init(data: SceneData & { role: Role }) { this.info = data; this.done = false; }

  create() {
    makeTextures(this);
    addPost(this, "ending");
    const level = LEVELS[0];
    const map = new MapView(this, level, { glyphs: false }).setDepth(0);
    level.substations.forEach((s) => map.setPowered(s.id));
    level.lights.forEach((l) => map.setLamp(l.id, true));
    map.setExitOpen(true);
    const fit = () => fitCamera(this.cameras.main, level, this.scale.width, this.scale.height, 0, 0);
    fit();
    this.scale.on("resize", fit);

    // A street full of colored light: pools on spaced-out street tiles, plus the district's own lamps.
    const pools: LightSource[] = [];
    for (let y = 1; y < level.h - 1 && pools.length < POOL_COLORS.length; y++)
      for (let x = 1; x < level.w - 1 && pools.length < POOL_COLORS.length; x++)
        if (level.at(x, y) === "." && (x * 7 + y * 13) % 17 === 0) pools.push({ x, y, color: POOL_COLORS[pools.length], radius: 3 });
    const lamps: LightSource[] = level.lights.map((l) => ({ ...l }));
    const alive = new Set<LightSource>([...pools, ...lamps]);
    const blocks = level.substations.map((s) => s.block);
    const layer = new LightLayer(this, level, LIT).setDepth(10);
    const state = { amb: 1, gray: 0, windows: true };
    const tint = this.cameras.main.filters.external.addColorMatrix();

    this.events.on("update", () => {
      const a = state.amb, k = (c: number) => Math.round(((LIT >> c) & 0xff) * a);
      layer.draw([...alive].filter((s) => s.radius > 0), state.windows ? blocks : [], (k(16) << 16) | (k(8) << 8) | k(0));
      tint.colorMatrix.reset();
      tint.colorMatrix.saturate(-state.gray);
    });

    this.say("Canal Street, 8:40 PM.", "The grid is up, and every color is out on the street.");
    // 1. The color drains out of the grid.
    this.time.delayedCall(1800, () => {
      this.say("Then the grid started to fail.", "");
      this.tweens.add({ targets: state, gray: 0.92, duration: 1700, ease: "Sine.easeIn" });
    });
    // 2. The lights die one by one, each with a stutter.
    const order = [...alive].sort((p, q) => (q.x + q.y) - (p.x + p.y));
    order.forEach((s, i) => this.time.delayedCall(3300 + i * 170, () => {
      alive.delete(s);
      sfx.lightOff();
      this.time.delayedCall(70, () => alive.add(s));
      this.time.delayedCall(140, () => alive.delete(s));
    }));
    const dark = 3300 + order.length * 170 + 200;
    this.time.delayedCall(dark, () => {
      state.windows = false;
      level.substations.forEach((s) => map.setPowered(s.id, false));
      level.lights.forEach((l) => map.setLamp(l.id, false));
      map.setExitOpen(false);
      this.tweens.add({ targets: state, amb: 0, duration: 900, ease: "Quad.easeIn" });
    });
    // 3. Blackout, then play.
    this.time.delayedCall(dark + 1100, () => this.say("BLACKOUT", "Bring the color back, block by block. Together.", true));
    this.time.delayedCall(dark + 3600, () => this.finish());

    const skip = () => { sfx.unlock(); this.finish(); };
    this.input.keyboard?.once("keydown", skip);
    this.input.once("pointerdown", skip);
    this.events.once("shutdown", () => this.text?.remove());
  }

  private say(title: string, sub: string, big = false) {
    if (!this.text) {
      this.text = document.createElement("div");
      this.text.style.cssText = "position:absolute;left:0;right:0;bottom:12%;text-align:center;pointer-events:none;color:#e8ecff;text-shadow:0 2px 12px #000;transition:opacity .5s";
      this.game.canvas.parentElement!.appendChild(this.text);
      const hint = document.createElement("div");
      hint.textContent = "Press any key to skip";
      hint.style.cssText = "position:absolute;right:14px;bottom:12px;font:12px system-ui,sans-serif;color:#7d87b2;pointer-events:none";
      this.text.appendChild(hint);
    }
    const el = this.text;
    el.querySelectorAll(".line").forEach((n) => n.remove());
    const line = (t: string, css: string) => { const d = document.createElement("div"); d.className = "line"; d.textContent = t; d.style.cssText = css; el.insertBefore(d, el.lastChild); };
    line(title, big
      ? `font:700 clamp(44px,8vw,96px)/1 "DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow",system-ui,sans-serif;letter-spacing:.12em;color:#ffd38a`
      : `font:700 clamp(20px,2.6vw,30px)/1.15 "DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow",system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase`);
    if (sub) line(sub, "margin-top:10px;font:15px/1.4 system-ui,sans-serif;color:#a9b1d6");
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(this.info.role, this.info));
  }
}
