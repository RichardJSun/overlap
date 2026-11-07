import type { ColorMask } from "./color.ts";

/** Anything with a width, height, and a light-blocking test. */
export type Grid = { w: number; h: number; solid(x: number, y: number): boolean };
export type LightSource = { x: number; y: number; color: ColorMask; radius: number };

const STEP = 0.1;

/** True when nothing solid sits strictly between the two tile centers. */
export function lineOfSight(g: Grid, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0, dy = y1 - y0;
  const n = Math.ceil(Math.hypot(dx, dy) / STEP);
  for (let i = 1; i < n; i++) {
    const tx = Math.floor(x0 + 0.5 + (dx * i) / n), ty = Math.floor(y0 + 0.5 + (dy * i) / n);
    if ((tx === x0 && ty === y0) || (tx === x1 && ty === y1)) continue;
    if (g.solid(tx, ty)) return false;
  }
  return true;
}

/** Tiles one source lights, as a per-tile color (0 = unlit). Wall faces in view are lit too. */
export function sourceField(g: Grid, s: LightSource): Uint8Array {
  const f = new Uint8Array(g.w * g.h);
  const r = s.radius;
  for (let y = Math.max(0, Math.floor(s.y - r)); y <= Math.min(g.h - 1, Math.ceil(s.y + r)); y++)
    for (let x = Math.max(0, Math.floor(s.x - r)); x <= Math.min(g.w - 1, Math.ceil(s.x + r)); x++)
      if (Math.hypot(x - s.x, y - s.y) <= r && lineOfSight(g, s.x, s.y, x, y)) f[y * g.w + x] = s.color;
  return f;
}

/** Light at every tile: the OR of every source that reaches it. */
export function lightField(g: Grid, sources: LightSource[]): Uint8Array {
  const f = new Uint8Array(g.w * g.h);
  for (const s of sources) {
    const sf = sourceField(g, s);
    for (let i = 0; i < f.length; i++) f[i] |= sf[i];
  }
  return f;
}
