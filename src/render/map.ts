import Phaser from "phaser";
import { TILE, type Level } from "../shared/level.ts";

type Block = { x: number; y: number; w: number; h: number };
type Rect = { x: number; y: number; w: number; h: number };

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

/** Static district art plus the sprites whose state changes: lamps, gates, substations, exit. */
export class MapView {
  readonly base: Phaser.GameObjects.Container;
  readonly gates: { x: number; y: number; color: number; img: Phaser.GameObjects.Container }[] = [];
  private lamps = new Map<string, Phaser.GameObjects.Image>();
  private subs = new Map<string, Phaser.GameObjects.Image>();
  private exit: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, private level: Level, opts: { glyphs: boolean }) {
    const add = (x: number, y: number, key: string) => scene.add.image(x * TILE + TILE / 2, y * TILE + TILE / 2, key);
    const items: Phaser.GameObjects.GameObject[] = [];
    for (let y = 0; y < level.h; y++)
      for (let x = 0; x < level.w; x++) {
        const c = level.at(x, y);
        items.push(add(x, y, c === "#" ? "wall" : c === "~" ? "gap" : c === "E" ? "exit" : "street"));
      }
    this.exit = items[level.exit.y * level.w + level.exit.x] as Phaser.GameObjects.Image;
    for (const s of level.substations) { const img = add(s.x, s.y, "substation"); this.subs.set(s.id, img); items.push(img); }
    for (const l of level.lights) {
      const img = add(l.x, l.y, "lamp-off"); this.lamps.set(l.id, img); items.push(img);
      if (opts.glyphs) items.push(add(l.x, l.y, `glyph-${l.color}`).setPosition(l.x * TILE + 25, l.y * TILE + 25).setAlpha(0.9));
    }
    this.base = scene.add.container(0, 0, items);
    for (const g of level.gates) {
      const parts: Phaser.GameObjects.GameObject[] = [scene.add.image(TILE / 2, TILE / 2, `${g.kind}-${g.color}`)];
      if (opts.glyphs) parts.push(scene.add.image(TILE - 7, 7, `glyph-${g.color}`));
      this.gates.push({ ...g, img: scene.add.container(g.x * TILE, g.y * TILE, parts) });
    }
  }

  setLamp(id: string, on: boolean) {
    const l = this.level.lights.find((l) => l.id === id);
    if (l) this.lamps.get(id)?.setTexture(on ? `lamp-${l.color}` : "lamp-off");
  }
  setPowered(id: string, on = true) { this.subs.get(id)?.setTexture(on ? "substation-on" : "substation"); }
  setExitOpen(open: boolean) { this.exit.setTexture(open ? "exit-open" : "exit"); }
  setDepth(d: number) { this.base.setDepth(d); this.gates.forEach((g) => g.img.setDepth(d + 1)); return this; }
  destroy() { this.base.destroy(); this.gates.forEach((g) => g.img.destroy()); }
}
