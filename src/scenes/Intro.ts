import Phaser from "phaser";
import { sfx } from "../audio/sfx.ts";
import type { SceneData } from "../game.ts";
import { LEVELS } from "../levels/index.ts";
import { LightLayer } from "../render/lights.ts";
import { MapView } from "../render/map.ts";
import { addPost } from "../render/post.ts";
import { makeTextures } from "../render/textures.ts";
import type { ColorMask } from "../shared/color.ts";
import type { Level } from "../shared/level.ts";
import type { LightSource } from "../shared/lighting.ts";
import type { Role } from "../shared/protocol.ts";
import { fitCamera } from "./fit.ts";

const LIT = 0x4a5068; // ambient while the grid is up: a night city, so the colored pools stand out

export type WhitePart = { src: LightSource; c: { x: number; y: number }; dx: number; dy: number };

/** A few white streetlights on street tiles, each built from a red, a green and a blue light on one spot. */
export function whiteLights(level: Level, count = 5): WhitePart[] {
  const centers: { x: number; y: number }[] = [];
  for (let y = 1; y < level.h - 1 && centers.length < count; y++)
    for (let x = 1; x < level.w - 1 && centers.length < count; x++)
      if (level.at(x, y) === "." && (x * 7 + y * 13) % 23 === 0 && centers.every((c) => Math.hypot(c.x - x, c.y - y) > 5)) centers.push({ x, y });
  const dirs: [ColorMask, number, number][] = [[4, 0, -1], [2, 0.87, 0.5], [1, -0.87, 0.5]];
  return centers.flatMap((c) => dirs.map(([color, dx, dy]) => ({ src: { x: c.x, y: c.y, color, radius: 3 }, c, dx, dy })));
}

/** Pull each white light's three colors `k` tiles apart (0 = white again). */
export function spreadApart(parts: WhitePart[], k: number) {
  for (const p of parts) { p.src.x = p.c.x + p.dx * k; p.src.y = p.c.y + p.dy * k; }
}

/**
 * Opening shot: the first street with its power on and every streetlight white. White is red, green
 * and blue together; when the grid fails each light comes apart into its three colors, those die one
 * by one, and the city goes black. Then the game starts. Any key or tap skips it.
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

    // White streetlights, each really a red, a green and a blue light on the same spot.
    level.lights.forEach((l) => map.setLamp(l.id, false));
    const parts = whiteLights(level);
    const alive = new Set(parts);
    const blocks = level.substations.map((s) => s.block);
    const layer = new LightLayer(this, level, LIT).setDepth(10);
    const state = { amb: 1, spread: 0, windows: true };

    this.events.on("update", () => {
      const a = state.amb, k = (c: number) => Math.round(((LIT >> c) & 0xff) * a);
      spreadApart(parts, state.spread);
      layer.draw([...alive].map((p) => p.src), state.windows ? blocks : [], (k(16) << 16) | (k(8) << 8) | k(0));
    });

    this.say("20:40 · City Power & Light", "Canal Street is running on white light. The switchboard is quiet.");
    // 1. The grid fails and the white comes apart into red, green and blue.
    this.time.delayedCall(2400, () => {
      this.say("20:43", "Calls from Canal Street. Every streetlight has split into red, green and blue.");
      this.tweens.add({ targets: state, spread: 1.2, duration: 1600, ease: "Cubic.easeOut" });
    });
    // 2. The separated colors die one by one, each with a stutter.
    const order = [...parts].sort((p, q) => (q.c.x + q.c.y) - (p.c.x + p.c.y) || p.src.color - q.src.color);
    order.forEach((p, i) => this.time.delayedCall(4400 + i * 120, () => {
      if (i === 0) this.say("20:44", "The colors are going out one at a time.");
      alive.delete(p);
      if (i % 3 === 0) sfx.lightOff();
      this.time.delayedCall(60, () => alive.add(p));
      this.time.delayedCall(120, () => alive.delete(p));
    }));
    const dark = 4400 + order.length * 120 + 200;
    this.time.delayedCall(dark, () => {
      state.windows = false;
      level.substations.forEach((s) => map.setPowered(s.id, false));
      map.setExitOpen(false);
      this.tweens.add({ targets: state, amb: 0, duration: 900, ease: "Quad.easeIn" });
    });
    // 3. Blackout, then play.
    this.time.delayedCall(dark + 1100, () => this.say("BLACKOUT", "One field tech is out there with a lantern. Dispatch has the map and the streetlights.", true));
    this.time.delayedCall(dark + 3600, () => this.finish());

    const skip = () => { sfx.unlock(); this.finish(); };
    this.input.keyboard?.once("keydown", skip);
    this.input.once("pointerdown", skip);
    this.events.once("shutdown", () => this.text?.remove());
  }

  private say(stamp: string, line: string, big = false) {
    if (!this.text) {
      this.text = document.createElement("div");
      this.text.style.cssText = "position:absolute;left:0;right:0;bottom:12%;padding:0 20px;text-align:center;pointer-events:none;color:#e8ecff;text-shadow:0 2px 12px #000";
      this.game.canvas.parentElement!.appendChild(this.text);
      const hint = document.createElement("div");
      hint.textContent = "Press any key to skip";
      hint.style.cssText = "position:absolute;right:14px;bottom:12px;font:12px system-ui,sans-serif;color:#7d87b2;pointer-events:none";
      this.game.canvas.parentElement!.appendChild(hint);
      this.events.once("shutdown", () => hint.remove());
    }
    const din = `"DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow",system-ui,sans-serif`;
    const top = document.createElement("div"), body = document.createElement("div");
    top.textContent = stamp;
    body.textContent = line;
    top.style.cssText = big
      ? `font:700 clamp(44px,8vw,96px)/1 ${din};letter-spacing:.12em;color:#ffd38a`
      : `display:inline-block;padding:3px 8px 1px;background:#1b2238;font:700 14px/1.2 ${din};letter-spacing:.14em;text-transform:uppercase;color:#ffd38a`;
    body.style.cssText = big ? "margin-top:12px;font:16px/1.4 system-ui,sans-serif;color:#a9b1d6" : "margin-top:10px;font:500 clamp(16px,1.6vw,20px)/1.4 system-ui,sans-serif";
    this.text.replaceChildren(top, body);
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(this.info.role, this.info));
  }
}
