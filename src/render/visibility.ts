import type { Grid } from "../shared/lighting.ts";

const RAYS = 360;
const BLEED = 0.18; // tiles a ray pushes into the wall it hits, so lit wall faces glow

/**
 * Visibility polygon around (cx, cy) in tile units (tile centers are at +0.5), clipped to `radius`.
 * Returns ray hit distances, one per ray, so callers can draw scaled copies for soft falloff.
 */
export function castRays(g: Grid, cx: number, cy: number, radius: number): Float32Array {
  const out = new Float32Array(RAYS);
  for (let i = 0; i < RAYS; i++) {
    const a = (i / RAYS) * Math.PI * 2;
    out[i] = Math.min(radius, march(g, cx, cy, Math.cos(a), Math.sin(a), radius) + BLEED);
  }
  return out;
}

/** Flat [x0, y0, x1, y1, ...] polygon in pixels from ray distances, scaled by `k`. */
export function polygon(dist: Float32Array, cx: number, cy: number, tile: number, k = 1): { x: number; y: number }[] {
  const pts = new Array(dist.length);
  for (let i = 0; i < dist.length; i++) {
    const a = (i / dist.length) * Math.PI * 2, d = dist[i] * k;
    pts[i] = { x: (cx + Math.cos(a) * d) * tile, y: (cy + Math.sin(a) * d) * tile };
  }
  return pts;
}

/** Grid DDA: distance along the ray to the first solid tile, capped at `max`. */
function march(g: Grid, ox: number, oy: number, dx: number, dy: number, max: number): number {
  let x = Math.floor(ox), y = Math.floor(oy);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
  const tdx = dx === 0 ? Infinity : Math.abs(1 / dx), tdy = dy === 0 ? Infinity : Math.abs(1 / dy);
  let tx = dx === 0 ? Infinity : (dx > 0 ? x + 1 - ox : ox - x) * tdx;
  let ty = dy === 0 ? Infinity : (dy > 0 ? y + 1 - oy : oy - y) * tdy;
  for (;;) {
    let t: number;
    if (tx < ty) { t = tx; tx += tdx; x += sx; } else { t = ty; ty += tdy; y += sy; }
    if (t >= max) return max;
    if (x < 0 || y < 0 || x >= g.w || y >= g.h || g.solid(x, y)) return t;
  }
}
