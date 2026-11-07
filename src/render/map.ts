import Phaser from "phaser";
import { TILE, type Level } from "../shared/level.ts";
import { PAL } from "./textures.ts";

type Block = { x: number; y: number; w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number };
type G = Phaser.GameObjects.Graphics;

/** Height in px of the south facade strip drawn on a wall tile that faces a street. */
export const FACADE = 11;
const winCache = new WeakMap<Block, Rect[]>();

/** Facade windows (pixel rects) on the street-facing walls inside `b`. Shared by the art and the lightmap. */
export function windowsIn(level: Level, b: Block): Rect[] {
  let out = winCache.get(b);
  if (out) return out;
  out = [];
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++)
      if (level.solid(x, y) && !level.solid(x, y + 1)) for (const ox of [6, 19]) out.push({ x: x * TILE + ox, y: y * TILE + TILE - 8, w: 7, h: 5 });
  winCache.set(b, out);
  return out;
}

// Albedo: brighter than the palette, because the runner's lightmap multiplies it back down.
const A = {
  // Streets are the lightest, warmest thing on the map; roofs are dark with a crisp lit outline; water is blue.
  street: 0x626160, speckHi: 0x6e6c6a, speckLo: 0x575654, crack: 0x4a4947, lane: 0xc9b277, curb: 0x938d82, contact: 0x46433f,
  roof: 0x252c48, roofEdge: 0x9aa7e0, roofShade: 0x1b2136, facade: 0x3b4366, glass: 0x10131f, sill: 0x6a739a, foot: 0x14182a,
  unit: 0x353e60, dark: 0x161b2e, water: 0x1a4282, ripple: 0x4a80cc, sparkle: 0xa8d0ff, bank: 0x938d82, joint: 0x5f5a52,
};
let uid = 0;

/** Deterministic per-tile random stream, so the city looks the same on both clients. */
function rng(x: number, y: number) {
  let s = (x * 374761393 + y * 668265263) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Static district art plus the sprites whose state changes: lamps, gates, substations, exit. */
export class MapView {
  readonly base: Phaser.GameObjects.Container;
  readonly gates: { x: number; y: number; color: number; img: Phaser.GameObjects.Container }[] = [];
  private lamps = new Map<string, { img: Phaser.GameObjects.Image; on: boolean; timers: Phaser.Time.TimerEvent[] }>();
  private subs = new Map<string, { img: Phaser.GameObjects.Image; on: boolean; extras: Phaser.GameObjects.GameObject[] }>();
  private exit: Phaser.GameObjects.Image;
  private tex: Phaser.Textures.DynamicTexture;
  private depth = 0;

  constructor(private scene: Phaser.Scene, private level: Level, opts: { glyphs: boolean }) {
    const T = TILE;
    const add = (x: number, y: number, key: string) => scene.add.image(x * T + T / 2, y * T + T / 2, key);
    this.tex = scene.textures.addDynamicTexture(`city-${uid++}`, level.w * T, level.h * T)!;
    const g = scene.make.graphics({}, false);
    paintCity(g, level);
    this.tex.draw(g).render();
    g.destroy();
    const items: Phaser.GameObjects.GameObject[] = [scene.add.image(0, 0, this.tex).setOrigin(0)];
    // Slow shimmer on the canal: a ripple overlay per water tile, breathing out of phase.
    for (let y = 0; y < level.h; y++)
      for (let x = 0; x < level.w; x++) {
        if (level.at(x, y) !== "~") continue;
        const r = rng(x, y + 99), img = add(x, y, "ripple").setAlpha(0.1).setFlipX(r() < 0.5);
        scene.tweens.add({ targets: img, alpha: 0.75, x: img.x + 3, duration: 1600 + r() * 1400, delay: r() * 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
        items.push(img);
      }
    this.exit = add(level.exit.x, level.exit.y, "exit");
    items.push(this.exit);
    for (const s of level.substations) { const img = add(s.x, s.y, "substation"); this.subs.set(s.id, { img, on: false, extras: [] }); items.push(img); }
    for (const l of level.lights) {
      // The lamp head carries its color and glyph shape, so it needs no separate badge.
      const img = add(l.x, l.y, `lamp-off-${l.color}`); this.lamps.set(l.id, { img, on: false, timers: [] }); items.push(img);
    }
    this.base = scene.add.container(0, 0, items);
    for (const gt of level.gates) {
      const img = scene.add.image(T / 2, T / 2, `${gt.kind}-${gt.color}`);
      // Both textures span left to right. Turn a bridge unless there is water above and below it (a north-south
      // canal, even a wide one), and turn a door whose street runs east-west between buildings.
      const water = (dy: number) => level.at(gt.x, gt.y + dy) === "~";
      if (gt.kind === "bridge" ? !(water(-1) && water(1)) : level.solid(gt.x, gt.y - 1) && level.solid(gt.x, gt.y + 1)) img.setAngle(90);
      scene.tweens.add({ targets: img, alpha: 0.82, duration: 700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
      const parts: Phaser.GameObjects.GameObject[] = [img];
      if (opts.glyphs) parts.push(scene.add.image(T - 8, 8, `glyph-${gt.color}`));
      this.gates.push({ ...gt, img: scene.add.container(gt.x * T, gt.y * T, parts) });
    }
  }

  /** Switch a streetlight sprite. Turning on flickers briefly, like a sodium lamp catching. */
  setLamp(id: string, on: boolean) {
    const l = this.level.lights.find((l) => l.id === id), lamp = this.lamps.get(id);
    if (!l || !lamp || lamp.on === on) return;
    lamp.on = on;
    lamp.timers.forEach((t) => t.remove());
    lamp.timers = [];
    const tex = (v: boolean) => lamp.img.setTexture(v ? `lamp-${l.color}` : `lamp-off-${l.color}`);
    tex(on);
    if (on) lamp.timers = [[50, false], [110, true], [170, false], [230, true]].map(([ms, v]) => this.scene.time.delayedCall(ms as number, () => tex(v as boolean)));
  }

  /** Power a substation: the box warms up and hums, a pulse rolls out, and the block's windows come on. */
  setPowered(id: string, on = true) {
    const sub = this.subs.get(id), s = this.level.substations.find((s) => s.id === id);
    if (!sub || !s || sub.on === on) return;
    sub.on = on;
    sub.img.setTexture(on ? "substation-on" : "substation");
    this.scene.tweens.killTweensOf(sub.extras);
    sub.extras.forEach((o) => o.destroy());
    sub.extras = [];
    if (!on) return;
    const sc = this.scene, x = sub.img.x, y = sub.img.y;
    const hum = sc.add.image(x, y, "soft").setTint(PAL.warm).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25);
    sc.tweens.add({ targets: hum, alpha: 0.55, scale: 1.15, duration: 480, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const pulse = sc.add.image(x, y, "ping").setTint(PAL.warm).setScale(0.3).setDepth(this.depth + 12).setBlendMode(Phaser.BlendModes.ADD);
    sc.tweens.add({ targets: pulse, scale: 4, alpha: 0, duration: 900, ease: "Quad.easeOut", onComplete: () => pulse.destroy() });
    const wins = windowsIn(this.level, s.block).map((w) => {
      const img = sc.add.image(w.x + w.w / 2, w.y + w.h / 2, "win-on").setAlpha(0);
      sc.tweens.add({ targets: img, alpha: 1, delay: 150 + Math.random() * 1100, duration: 90, yoyo: Math.random() < 0.3, repeat: 0, onComplete: () => img.setAlpha(1) });
      return img;
    });
    sub.extras = [hum, ...wins];
    this.base.add([hum, ...wins]);
    this.base.bringToTop(sub.img);
  }

  setExitOpen(open: boolean) { this.exit.setTexture(open ? "exit-open" : "exit"); }
  setDepth(d: number) { this.depth = d; this.base.setDepth(d); this.gates.forEach((g) => g.img.setDepth(d + 1)); return this; }
  destroy() {
    this.lamps.forEach((l) => l.timers.forEach((t) => t.remove()));
    this.scene.tweens.killTweensOf([...this.base.list, ...this.gates.map((g) => g.img.list[0])]);
    this.base.destroy(); this.gates.forEach((g) => g.img.destroy());
    this.tex.destroy();
  }
}

/** Bakes streets, roofs, facades and water for the whole district into one Graphics. */
function paintCity(g: G, level: Level) {
  for (let y = 0; y < level.h; y++)
    for (let x = 0; x < level.w; x++) {
      const c = level.at(x, y), r = rng(x, y), px = x * TILE, py = y * TILE;
      if (c === "#") roof(g, level, x, y, px, py, r);
      else if (c === "~") water(g, level, x, y, px, py, r);
      else street(g, level, x, y, px, py, r);
    }
  for (const w of windowsIn(level, { x: 0, y: 0, w: level.w, h: level.h })) {
    g.fillStyle(A.glass).fillRect(w.x, w.y, w.w, w.h);
    g.fillStyle(A.sill).fillRect(w.x, w.y + w.h, w.w, 1).fillRect(w.x, w.y, 2, 1);
  }
}

function street(g: G, level: Level, x: number, y: number, px: number, py: number, r: () => number) {
  const T = TILE, at = (dx: number, dy: number) => level.at(x + dx, y + dy);
  const open = (c: string) => c !== "#" && c !== "~";
  g.fillStyle(A.street).fillRect(px, py, T, T);
  for (let i = 0; i < 14; i++) g.fillStyle(r() < 0.5 ? A.speckHi : A.speckLo).fillRect(px + Math.floor(r() * 31), py + Math.floor(r() * 31), 1 + Math.floor(r() * 2), 1);
  if (r() < 0.18) { // hairline crack
    let cx = px + 4 + r() * 24, cy = py + 4 + r() * 24;
    g.lineStyle(1, A.crack);
    for (let i = 0; i < 3; i++) { const nx = cx + (r() - 0.5) * 12, ny = cy + (r() - 0.5) * 12; g.lineBetween(cx, cy, nx, ny); cx = nx; cy = ny; }
  }
  const walls = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => at(dx, dy) === "#"); // N E S W
  if (walls[0] && walls[2] && open(at(-1, 0)) && open(at(1, 0))) for (let i = 0; i < 2; i++) g.fillStyle(A.lane).fillRect(px + 3 + i * 16, py + 15, 10, 2);
  else if (walls[1] && walls[3] && open(at(0, -1)) && open(at(0, 1))) for (let i = 0; i < 2; i++) g.fillStyle(A.lane).fillRect(px + 15, py + 3 + i * 16, 2, 10);
  else if (!walls.some(Boolean) && r() < 0.12) { // manhole
    const cx = px + 9 + r() * 14, cy = py + 9 + r() * 14;
    g.fillStyle(A.contact).fillCircle(cx, cy, 6).lineStyle(1, A.curb).strokeCircle(cx, cy, 6);
    g.lineStyle(1, A.speckLo).lineBetween(cx - 4, cy - 2, cx + 4, cy - 2).lineBetween(cx - 4, cy + 2, cx + 4, cy + 2);
  }
  // Curbs where the street meets a building; a contact shadow under south-facing facades.
  if (walls[0]) g.fillStyle(A.contact).fillRect(px, py, T, 3);
  if (walls[1]) g.fillStyle(A.curb).fillRect(px + T - 2, py, 2, T);
  if (walls[2]) g.fillStyle(A.curb).fillRect(px, py + T - 2, T, 2);
  if (walls[3]) g.fillStyle(A.curb).fillRect(px, py, 2, T);
  // Stone embankment along the canal.
  const bank = (bx: number, by: number, w: number, h: number, horiz: boolean) => {
    g.fillStyle(A.bank).fillRect(bx, by, w, h).fillStyle(A.joint);
    for (let i = 4; i < T; i += 8) horiz ? g.fillRect(bx + i, by, 1, h) : g.fillRect(bx, by + i, w, 1);
  };
  if (at(1, 0) === "~") bank(px + T - 3, py, 3, T, false);
  if (at(-1, 0) === "~") bank(px, py, 3, T, false);
  if (at(0, 1) === "~") bank(px, py + T - 3, T, 3, true);
  if (at(0, -1) === "~") bank(px, py, T, 3, true);
}

function roof(g: G, level: Level, x: number, y: number, px: number, py: number, r: () => number) {
  const T = TILE, solid = (dx: number, dy: number) => level.solid(x + dx, y + dy);
  const facade = !solid(0, 1), top = facade ? T - FACADE : T;
  g.fillStyle(A.roof).fillRect(px, py, T, T);
  for (let i = 0; i < 6; i++) g.fillStyle(r() < 0.5 ? A.roofShade : A.unit, 0.5).fillRect(px + Math.floor(r() * 30), py + Math.floor(r() * (top - 2)), 2, 1);
  // Parapet: a lit edge toward open air with a shaded band just inside it.
  if (!solid(0, -1)) g.fillStyle(A.roofEdge).fillRect(px, py, T, 2).fillStyle(A.roofShade).fillRect(px, py + 2, T, 2);
  if (!solid(-1, 0)) g.fillStyle(A.roofEdge).fillRect(px, py, 2, top).fillStyle(A.roofShade).fillRect(px + 2, py, 2, top);
  if (!solid(1, 0)) g.fillStyle(A.roofShade).fillRect(px + T - 4, py, 2, top).fillStyle(A.roofEdge).fillRect(px + T - 2, py, 2, top);
  if (facade) {
    g.fillStyle(A.roofShade).fillRect(px, py + top - 4, T, 2).fillStyle(A.roofEdge).fillRect(px, py + top - 2, T, 2);
    g.fillStyle(A.facade).fillRect(px, py + top, T, FACADE).fillStyle(A.foot).fillRect(px, py + T - 1, T, 1);
    return;
  }
  if (!solid(0, -1) || !solid(-1, 0) || !solid(1, 0)) return;
  const k = r();
  if (k < 0.2) { // AC unit with a fan
    const ux = px + 5 + r() * 12, uy = py + 6 + r() * 10;
    g.fillStyle(A.dark).fillRect(ux + 1, uy + 1, 12, 9).fillStyle(A.unit).fillRect(ux, uy, 12, 9).fillStyle(A.roofEdge).fillRect(ux, uy, 12, 1);
    g.fillStyle(A.dark).fillCircle(ux + 6, uy + 5, 3);
  } else if (k < 0.34) { // vent
    const vx = px + 8 + r() * 16, vy = py + 8 + r() * 14;
    g.fillStyle(A.unit).fillCircle(vx, vy, 4).fillStyle(A.dark).fillCircle(vx, vy, 2.5);
  } else if (k < 0.44) { // skylight
    const sx = px + 6 + r() * 12, sy = py + 7 + r() * 12;
    g.fillStyle(A.dark).fillRect(sx, sy, 11, 7).lineStyle(1, A.sill).lineBetween(sx + 2, sy + 5, sx + 6, sy + 1);
  }
}

function water(g: G, level: Level, x: number, y: number, px: number, py: number, r: () => number) {
  const T = TILE, bank = (dx: number, dy: number) => level.at(x + dx, y + dy) !== "~";
  g.fillStyle(A.water).fillRect(px, py, T, T);
  g.lineStyle(1, A.ripple);
  for (let i = 0; i < 3; i++) { const rx = px + 2 + r() * 20, ry = py + 4 + i * 9 + r() * 4, w = 5 + r() * 8; g.lineBetween(rx, ry, rx + w, ry); }
  if (r() < 0.5) g.fillStyle(A.sparkle).fillRect(px + Math.floor(r() * 30), py + Math.floor(r() * 30), 1, 1);
  g.fillStyle(0x0d2550);
  if (bank(-1, 0)) g.fillRect(px, py, 3, T);
  if (bank(1, 0)) g.fillRect(px + T - 3, py, 3, T);
  if (bank(0, -1)) g.fillRect(px, py, T, 3);
}
