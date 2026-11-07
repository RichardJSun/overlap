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
import { Bedroom } from "./bedroom.ts";
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
  private hint?: HTMLDivElement;

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

    state.spread = 1.2; // by the time we're on the street, the white has already come apart

    // Cold open: the field tech asleep, the phone ringing on the nightstand.
    const room = new Bedroom(this.game.canvas.parentElement!);
    this.events.once("shutdown", () => room.destroy());
    this.say("Incoming call", "Dispatch · City Power & Light");
    this.hintText("Press any key to answer · Esc to skip");
    sfx.ring();
    const ringer = this.time.addEvent({ delay: 2200, loop: true, callback: () => sfx.ring() });
    const answer = () => {
      if (room.answered) return;
      ringer.remove();
      sfx.unlock();
      sfx.pickup();
      this.time.delayedCall(250, () => sfx.radio());
      room.set("answered");
      this.say("20:43 · Dispatch", "Sorry to wake you. Canal Street's lights just split into colors, and now they're going out.");
      this.hintText("Press any key to skip");
      this.time.delayedCall(1300, () => room.set("split"));
      this.time.delayedCall(3500, () => room.set("dying"));
      this.time.delayedCall(5200, () => { room.set("out"); this.street(parts, alive, state, map, level); });
    };
    this.time.delayedCall(10000, answer); // nobody at the keys: pick up anyway

    const onInput = (esc: boolean) => { sfx.unlock(); if (esc || room.answered) this.finish(); else answer(); };
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => onInput(e.key === "Escape"));
    this.input.on("pointerdown", () => onInput(false));
    this.events.once("shutdown", () => this.text?.remove());
  }

  /** On the street: the separated colors die one by one, the cameras cut out, then BLACKOUT. */
  private street(parts: WhitePart[], alive: Set<WhitePart>, state: { amb: number; spread: number; windows: boolean }, map: MapView, level: Level) {
    this.say("20:44 · Dispatch", "I can't see a thing down there. Grab your lantern.");
    const order = [...parts].sort((p, q) => (q.c.x + q.c.y) - (p.c.x + p.c.y) || p.src.color - q.src.color);
    order.forEach((p, i) => this.time.delayedCall(900 + i * 110, () => {
      alive.delete(p);
      if (i % 3 === 0) sfx.lightOff();
      this.time.delayedCall(60, () => alive.add(p));
      this.time.delayedCall(120, () => alive.delete(p));
    }));
    const dark = 900 + order.length * 110 + 200;
    this.time.delayedCall(dark, () => {
      this.staticBurst(900);
      state.windows = false;
      level.substations.forEach((s) => map.setPowered(s.id, false));
      map.setExitOpen(false);
      this.tweens.add({ targets: state, amb: 0, duration: 900, ease: "Quad.easeIn" });
    });
    this.time.delayedCall(dark + 1100, () => this.say("BLACKOUT", "21:00 · Every camera in the district is down. The streetlights still see, so use them to get the field tech through.", true));
    this.time.delayedCall(dark + 3800, () => this.finish());
  }

  private hintText(t: string) { if (this.hint) this.hint.textContent = t; }

  private say(stamp: string, line: string, big = false) {
    if (!this.text) {
      this.text = document.createElement("div");
      this.text.style.cssText = "position:absolute;left:0;right:0;bottom:12%;padding:0 20px;text-align:center;pointer-events:none;color:#e8ecff;text-shadow:0 2px 12px #000";
      this.game.canvas.parentElement!.appendChild(this.text);
      const hint = (this.hint = document.createElement("div"));
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
      : `display:inline-block;padding-bottom:4px;border-bottom:1px solid #ffd38a;font:600 13px/1 ui-monospace,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.06em;text-transform:uppercase;color:#ffd38a`;
    body.style.cssText = big ? "margin-top:12px;font:16px/1.4 system-ui,sans-serif;color:#a9b1d6" : "margin-top:10px;font:500 clamp(16px,1.6vw,20px)/1.4 system-ui,sans-serif";
    this.text.replaceChildren(top, body);
  }

  /** The camera feeds die: a burst of analog static over the whole pane, fading out. */
  private staticBurst(ms: number) {
    const pane = this.game.canvas.parentElement!;
    const c = document.createElement("canvas");
    c.width = 160; c.height = 100;
    c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;pointer-events:none;mix-blend-mode:screen";
    pane.appendChild(c);
    const g = c.getContext("2d")!, img = g.createImageData(c.width, c.height), t0 = performance.now();
    const frame = () => {
      const k = (performance.now() - t0) / ms;
      if (k >= 1 || this.done) { c.remove(); return; }
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 255 * (Math.random() < 0.08 ? 1 : 0.55);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255 * (1 - k) * 0.85;
      }
      // A rolling bright band, like a monitor losing sync.
      const band = Math.floor(((performance.now() - t0) / 3) % c.height);
      for (let x = 0; x < c.width; x++) for (let y = band; y < Math.min(c.height, band + 6); y++) img.data[(y * c.width + x) * 4 + 3] = 255 * (1 - k);
      g.putImageData(img, 0, 0);
      requestAnimationFrame(frame);
    };
    frame();
    sfx.radio();
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(this.info.role, this.info));
  }
}
