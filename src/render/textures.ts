import Phaser from "phaser";
import { hex } from "../shared/color.ts";
import { TILE } from "../shared/level.ts";

export const PAL = {
  night: 0x0b1020, wall: 0x1b2238, wallEdge: 0x2c3758, street: 0x141a2e, warm: 0xffd38a, text: 0xe8ecff,
};

// Lightmap color per primary (blue, green, red bits). Off-channels are the palette's, scaled down so
// that overlaps stay saturated: red + blue sums to magenta instead of washing out to pink-white.
const PRIM = [[0.135, 0.245, 1], [0.135, 1, 0.24], [1, 0.135, 0.165]];
export function lightTint(c: number) {
  const rgb = [0, 0, 0];
  for (let b = 0; b < 3; b++) if (c & (1 << b)) for (let i = 0; i < 3; i++) rgb[i] += PRIM[b][i];
  return rgb.reduce((a, v) => (a << 8) | Math.round(Math.min(1, v) * 255), 0);
}

/** Light falloff at t = distance / radius: bright core, flat enough that the last lit tile reads, zero at the edge. */
export function falloff(t: number) {
  const s = Math.min(1, Math.max(0, (1 - t) / 0.3));
  return (1 - 0.55 * t) * s * s * (3 - 2 * s);
}

type G = Phaser.GameObjects.Graphics;
const INK = 0x0b1020;

/**
 * Every procedural texture the game uses. Keys:
 *   street, wall, gap, exit, exit-open, substation, substation-on, runner, guide, ping, soft, pointer,
 *   light-falloff, ripple, win-on,
 *   lamp-off, lamp-off-<mask>, lamp-<mask>, bridge-<mask>, door-<mask>, drone-<mask>, glyph-<mask>, filter-<mask>   (mask 1..7)
 * MapView bakes the district itself; street, wall and gap are single-tile stand-ins in the same albedo.
 */
export function makeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("street")) return;
  const g = scene.make.graphics({}, false);
  const T = TILE, C = T / 2;
  const tex = (key: string, w: number, h: number, draw: () => void) => { g.clear(); draw(); g.generateTexture(key, w, h); };

  tex("street", T, T, () => g.fillStyle(0x626160).fillRect(0, 0, T, T).fillStyle(0x6e6c6a).fillRect(5, 14, 2, 1).fillRect(21, 6, 2, 1).fillRect(24, 25, 1, 1));
  tex("wall", T, T, () => {
    g.fillStyle(0x252c48).fillRect(0, 0, T, T).fillStyle(0x9aa7e0).fillRect(0, 0, T, 2).fillRect(0, T - 13, T, 2);
    g.fillStyle(0x3b4366).fillRect(0, T - 11, T, 11).fillStyle(0x10131f).fillRect(6, T - 8, 7, 5).fillRect(19, T - 8, 7, 5);
  });
  tex("gap", T, T, () => g.fillStyle(0x1a4282).fillRect(0, 0, T, T).lineStyle(1, 0x4a80cc).lineBetween(4, 10, 14, 10).lineBetween(16, 22, 28, 22));
  tex("ripple", T, T, () => {
    g.lineStyle(1, 0xa8d0ff, 0.9).lineBetween(3, 8, 11, 8).lineBetween(17, 15, 28, 15).lineBetween(6, 24, 15, 24);
    g.lineStyle(1, 0xa8d0ff, 0.45).lineBetween(12, 9, 15, 9).lineBetween(20, 25, 24, 25);
  });
  tex("win-on", 7, 5, () => g.fillStyle(PAL.warm).fillRect(0, 0, 7, 5).fillStyle(0xfff3d6).fillRect(0, 0, 3, 2).fillStyle(0xd9a85a).fillRect(0, 4, 7, 1));
  tex("exit", T, T, () => exit(g, false));
  tex("exit-open", T, T, () => exit(g, true));
  tex("substation", T, T, () => substation(g, false));
  tex("substation-on", T, T, () => substation(g, true));
  tex("runner", T, T, () => {
    g.fillStyle(0x000000, 0.35).fillEllipse(C, T - 5, 18, 6);
    g.fillStyle(0xe8ecff).fillCircle(C, 10, 5);
    g.fillStyle(0xc8d0f0).fillRoundedRect(C - 6, 15, 12, 12, 3);
    g.fillStyle(0xffe9b0, 0.35).fillCircle(C + 9, 19, 5).fillStyle(0xffe9b0).fillCircle(C + 9, 19, 3);
  });
  tex("guide", T, T, () => {
    g.fillStyle(0x000000, 0.35).fillEllipse(C, T - 5, 18, 6);
    g.fillStyle(0xe8ecff).fillCircle(C, 10, 5);
    g.fillStyle(0x8ab4a0).fillRoundedRect(C - 6, 15, 12, 12, 3);
    g.lineStyle(2, 0x4dff88).strokeCircle(C, 10, 7);
  });
  tex("ping", 64, 64, () => {
    g.lineStyle(4, 0xffffff).strokeCircle(32, 32, 26);
    g.fillStyle(0xffffff).fillCircle(32, 32, 6);
  });
  tex("lamp-off", T, T, () => lamp(g, 0, false));
  // Opaque white-to-black falloff for light pools, and a transparent soft dot for glows.
  radial(scene, "light-falloff", 256, (t) => { const v = Math.round(falloff(t) * 255); return [v, v, v, 255]; });
  radial(scene, "soft", 64, (t) => [255, 255, 255, Math.round(Math.max(0, 1 - t) ** 2 * 255)]);

  // Tutorial pointer: an amber chevron that bobs over the tile to look at.
  tex("pointer", T, T, () => {
    g.fillStyle(0xffd38a, 0.25).fillTriangle(4, 6, T - 4, 6, C, T - 2);
    g.fillStyle(0xffd38a).fillTriangle(8, 8, T - 8, 8, C, T - 6);
    g.fillStyle(0x0b1020).fillTriangle(13, 10, T - 13, 10, C, 17);
  });

  for (let c = 1; c < 8; c++) {
    const col = hex(c), pale = mix(col, 0xffffff, 0.5);
    tex(`lamp-${c}`, T, T, () => lamp(g, c, true));
    tex(`lamp-off-${c}`, T, T, () => lamp(g, c, false));
    tex(`glyph-${c}`, 16, 16, () => glyph(g, c));
    // Light-made bridge spanning left to right (MapView turns it for a canal that runs sideways):
    // a glowing plank deck between two white rails, with water showing above and below.
    tex(`bridge-${c}`, T, T, () => {
      g.fillStyle(col, 0.3).fillRect(0, 3, T, T - 6);
      g.fillStyle(mix(col, 0x000000, 0.45)).fillRect(0, 8, T, T - 16);
      for (let x = 0; x < T; x += 6) g.fillStyle(mix(col, 0x000000, 0.15)).fillRect(x + 1, 9, 4, T - 18).fillStyle(pale).fillRect(x + 1, 9, 4, 1);
      for (const y of [6.5, T - 6.5]) {
        g.lineStyle(5, col, 0.6).lineBetween(0, y, T, y).lineStyle(2, 0xffffff).lineBetween(0, y, T, y);
        for (const x of [8, 24]) g.fillStyle(INK).fillRect(x - 2.5, y - 3.5, 5, 7).fillStyle(0xffffff).fillRect(x - 1.5, y - 2.5, 3, 5);
      }
    });
    // Light-made door: posts at both curbs with glowing bars strung across the street between them.
    tex(`door-${c}`, T, T, () => {
      g.fillStyle(col, 0.32).fillRect(0, 3, T, T - 6);
      for (const y of [8, 16, 24]) g.lineStyle(7, col, 0.6).lineBetween(4, y, T - 4, y).lineStyle(3, pale).lineBetween(4, y, T - 4, y).lineStyle(1, 0xffffff).lineBetween(4, y, T - 4, y);
      for (const x of [0, T - 6]) {
        g.fillStyle(INK).fillRect(x, 2, 6, T - 4).fillStyle(0x59607e).fillRect(x + 1, 3, 4, T - 6).fillStyle(0xb8c0e0).fillRect(x + 1, 3, 4, 1);
        for (const y of [8, 16, 24]) g.fillStyle(0xffffff).fillRect(x + 1.5, y - 1.5, 3, 3);
      }
    });
    tex(`drone-${c}`, T, T, () => {
      g.fillStyle(col, 0.25).fillCircle(C, C, 14);
      g.fillStyle(0x10131f).fillCircle(C, C, 9);
      g.lineStyle(2, col).strokeCircle(C, C, 9);
      g.fillStyle(col).fillCircle(C, C, 3);
      g.lineStyle(2, 0x9aa3c8).lineBetween(4, 4, 10, 10).lineBetween(T - 4, 4, T - 10, 10).lineBetween(4, T - 4, 10, T - 10).lineBetween(T - 4, T - 4, T - 10, T - 10);
    });
    // Lantern filter: a faceted gem lying on the street, lit facet top-left, with the color's glyph and a glint.
    tex(`filter-${c}`, T, T, () => {
      g.fillStyle(0x000000, 0.45).fillEllipse(C, T - 4, 20, 5);
      g.fillStyle(col, 0.22).fillCircle(C, 14, 14);
      const top = [C, 2], right = [T - 4, 14], bot = [C, T - 5], left = [4, 14], mid = [C, 12];
      g.fillStyle(INK).fillPoints(pts([C, 0, T - 2, 14, C, T - 3, 2, 14]), true);
      g.fillStyle(mix(col, 0xffffff, 0.45)).fillPoints(pts([...top, ...mid, ...left]), true);
      g.fillStyle(col).fillPoints(pts([...top, ...right, ...mid]), true);
      g.fillStyle(mix(col, 0x000000, 0.4)).fillPoints(pts([...right, ...bot, ...mid]), true);
      g.fillStyle(mix(col, 0x000000, 0.2)).fillPoints(pts([...bot, ...left, ...mid]), true);
      shapes(g, c, C, 15, 5, 2, INK);
      g.lineStyle(1, 0xffffff).lineBetween(10, 4, 10, 12).lineBetween(6, 8, 14, 8);
      g.fillStyle(0xffffff).fillCircle(10, 8, 1.5);
    });
  }
  g.destroy();
}

/** Linear blend from `a` toward `b` by k. */
const mix = (a: number, b: number, k: number) => [16, 8, 0].reduce((o, s) => o | (Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k) << s), 0);
const pts = (xy: number[]) => xy.flatMap((v, i) => (i % 2 ? [] : [new Phaser.Math.Vector2(v, xy[i + 1])]));

/** Canvas texture whose pixel at normalized radius t (0 center, 1 edge) is `px(t)` as RGBA. */
function radial(scene: Phaser.Scene, key: string, size: number, px: (t: number) => number[]) {
  const ct = scene.textures.createCanvas(key, size, size)!;
  const img = ct.context.createImageData(size, size), h = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) img.data.set(px(Math.hypot(x + 0.5 - h, y + 0.5 - h) / h), (y * size + x) * 4);
  ct.context.putImageData(img, 0, 0);
  ct.refresh();
}

/**
 * The mask's colorblind shapes, nested outermost first: blue = square, red = triangle, green = circle.
 * `fill` fills the outermost shape; every shape is outlined in `line`.
 */
function shapes(g: G, c: number, cx: number, cy: number, r: number, lw: number, line: number, fill?: number) {
  const kinds = [c & 1 && "sq", c & 4 && "tri", c & 2 && "ci"].filter(Boolean);
  kinds.forEach((k, i) => {
    const fillIt = i === 0 && fill !== undefined;
    if (fillIt) g.fillStyle(fill);
    g.lineStyle(lw, line);
    if (k === "sq") { const s = r * 1.6; if (fillIt) g.fillRect(cx - s / 2, cy - s / 2, s, s); g.strokeRect(cx - s / 2, cy - s / 2, s, s); }
    if (k === "tri") {
      const p = [cx, cy - r * 1.05, cx + r * 1.05, cy + r * 0.8, cx - r * 1.05, cy + r * 0.8] as const;
      if (fillIt) g.fillTriangle(...p);
      g.strokeTriangle(...p);
      cy += r * 0.25; // the next shape sits in the triangle's wider lower half
    }
    if (k === "ci") { if (fillIt) g.fillCircle(cx, cy, r * 0.95); g.strokeCircle(cx, cy, r * 0.95); }
    r *= 0.58;
  });
}

/**
 * Streetlight seen from above at an angle: footing, pole, and a big head shaped like the mask's glyph.
 * On, the head is filled with its color and haloed. Off, it is dark glass outlined in the color it would give.
 * Mask 0 is the generic dead lamp.
 */
function lamp(g: G, c: number, on: boolean) {
  const C = TILE / 2, hy = 11, col = c ? hex(c) : 0x7d87b2;
  g.fillStyle(0x000000, 0.45).fillEllipse(C + 1, TILE - 3, 14, 5);
  g.fillStyle(INK).fillRect(C - 2.5, hy + 6, 5, TILE - hy - 9).fillStyle(0xa2abd0).fillRect(C - 1, hy + 6, 2, TILE - hy - 9);
  g.fillStyle(INK).fillCircle(C, TILE - 4, 3.5).fillStyle(0x6a7398).fillCircle(C, TILE - 4, 2.5);
  if (on) g.fillStyle(col, 0.22).fillCircle(C, hy, 15).fillStyle(col, 0.4).fillCircle(C, hy, 11.5);
  shapes(g, c || 2, C, hy, 9, 5, INK);
  if (on) {
    shapes(g, c, C, hy, 9, 1.5, mix(col, 0xffffff, 0.6), col);
    g.fillStyle(0xffffff, 0.9).fillCircle(C - 3, hy - 3, 2.2);
  } else shapes(g, c || 2, C, hy, 9, 2.5, col, 0x161a2a);
}

/** Colorblind glyph per mask on a badge in the mask's color: red = triangle, green = circle, blue = square. */
function glyph(g: G, c: number) {
  g.fillStyle(INK).fillRoundedRect(0, 0, 16, 16, 4);
  g.fillStyle(hex(c)).fillRoundedRect(1, 1, 14, 14, 3);
  shapes(g, c, 8, 8.5, 5, 2, INK);
}

/** Power box filling the tile with a big lightning bolt: dead grey, or warm with a bright bolt once powered. */
function substation(g: G, on: boolean) {
  const T = TILE, C = T / 2;
  if (on) g.fillStyle(PAL.warm, 0.3).fillCircle(C, C, 16);
  g.fillStyle(INK).fillRoundedRect(1, 2, T - 2, T - 3, 4);
  g.fillStyle(on ? 0xd9a24a : 0x6b7086).fillRoundedRect(2, 3, T - 4, T - 5, 3);
  g.fillStyle(on ? 0xffe2a6 : 0x9399ad).fillRect(4, 3, T - 8, 2).fillStyle(on ? 0x8a5f1c : 0x494e62).fillRect(4, T - 4, T - 8, 2);
  for (const x of [4, T - 7]) for (let y = 8; y < T - 6; y += 4) g.fillStyle(on ? 0x8a5f1c : 0x464b5e).fillRect(x, y, 3, 2);
  g.fillStyle(on ? 0x4a2e06 : 0x3a3f52).fillCircle(C, C + 1, 10.5);
  const bolt = pts([18, 5, 9, 18, 15, 18, 12.5, 28, 23.5, 13.5, 17.5, 13.5, 21, 5]);
  g.lineStyle(3, INK).strokePoints(bolt, true, true);
  g.fillStyle(on ? 0xfff6dc : 0xb4b9c8).fillPoints(bolt, true);
  if (on) g.lineStyle(1, PAL.warm).strokePoints(bolt, true, true);
}

/** EXIT in a 3x5 pixel font, 13 px wide, top-left at (x, y). */
function exitSign(g: G, x: number, y: number, col: number) {
  const rows = ["111 101 1 111", "100 101 1 010", "110 010 1 010", "100 101 1 010", "111 101 1 010"];
  g.fillStyle(col);
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch === "1") g.fillRect(x + i, y + j, 1, 1); }));
}

/** Exit: a shut steel double door under a dark EXIT sign; open, the doorway and sign burn warm with an arrow in. */
function exit(g: G, open: boolean) {
  const T = TILE, C = T / 2;
  if (open) g.fillStyle(PAL.warm, 0.3).fillRect(0, 0, T, T);
  g.fillStyle(INK).fillRect(3, 1, T - 6, T - 1);
  g.fillStyle(open ? PAL.warm : 0xb4bad0).fillRect(4, 2, T - 8, T - 2);
  g.fillStyle(open ? 0x3a2608 : 0x151927).fillRect(6, 4, T - 12, 7);
  exitSign(g, 9.5, 5, open ? 0xfff3d6 : 0x646a82);
  if (open) {
    g.fillStyle(0xffe9b8).fillRect(6, 12, T - 12, T - 13);
    g.fillStyle(0xb07a2a).fillRect(6, 12, 3, T - 13).fillRect(T - 9, 12, 3, T - 13);
    g.fillStyle(0x3a2608).fillTriangle(C, 13, C - 7, 21, C + 7, 21).fillRect(C - 2.5, 21, 5, 8);
  } else {
    g.fillStyle(0x2c3144).fillRect(6, 12, T - 12, T - 13);
    g.fillStyle(INK).fillRect(C - 0.5, 12, 1, T - 13);
    g.fillStyle(0xa9b0cc).fillRect(8, 20, 6, 2).fillRect(T - 14, 20, 6, 2);
  }
}
