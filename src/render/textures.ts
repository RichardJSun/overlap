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

/**
 * Every procedural texture the game uses. Keys:
 *   street, wall, gap, exit, exit-open, substation, substation-on, runner, guide, ping, soft,
 *   light-falloff, ripple, win-on,
 *   lamp-off, lamp-<mask>, bridge-<mask>, door-<mask>, drone-<mask>, glyph-<mask>   (mask 1..7)
 * MapView bakes the district itself; street, wall and gap are single-tile stand-ins in the same albedo.
 */
export function makeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("street")) return;
  const g = scene.make.graphics({}, false);
  const T = TILE, C = T / 2;
  const tex = (key: string, w: number, h: number, draw: () => void) => { g.clear(); draw(); g.generateTexture(key, w, h); };

  tex("street", T, T, () => g.fillStyle(0x63687d).fillRect(0, 0, T, T).fillStyle(0x6f748a).fillRect(5, 14, 2, 1).fillRect(21, 6, 2, 1).fillRect(24, 25, 1, 1));
  tex("wall", T, T, () => {
    g.fillStyle(0x474e6b).fillRect(0, 0, T, T).fillStyle(0x7b86b2).fillRect(0, 0, T, 2).fillRect(0, T - 13, T, 2);
    g.fillStyle(0x343a54).fillRect(0, T - 11, T, 11).fillStyle(0x1a1f30).fillRect(6, T - 8, 7, 5).fillRect(19, T - 8, 7, 5);
  });
  tex("gap", T, T, () => g.fillStyle(0x1c2440).fillRect(0, 0, T, T).lineStyle(1, 0x34426c).lineBetween(4, 10, 14, 10).lineBetween(16, 22, 28, 22));
  tex("ripple", T, T, () => {
    g.lineStyle(1, 0x8ea4e0, 0.8).lineBetween(3, 8, 11, 8).lineBetween(17, 15, 28, 15).lineBetween(6, 24, 15, 24);
    g.lineStyle(1, 0x8ea4e0, 0.4).lineBetween(12, 9, 15, 9).lineBetween(20, 25, 24, 25);
  });
  tex("win-on", 7, 5, () => g.fillStyle(PAL.warm).fillRect(0, 0, 7, 5).fillStyle(0xfff3d6).fillRect(0, 0, 3, 2).fillStyle(0xd9a85a).fillRect(0, 4, 7, 1));
  // Exit: a sealed service hatch, then an open one with a warm glow and an arrow.
  tex("exit", T, T, () => {
    g.fillStyle(0x2c3147).fillRect(4, 4, T - 8, T - 8).lineStyle(2, 0x9aa3c8).strokeRect(5, 5, T - 10, T - 10);
    g.lineStyle(3, 0x9aa3c8).lineBetween(9, 9, T - 9, T - 9).lineBetween(T - 9, 9, 9, T - 9);
  });
  tex("exit-open", T, T, () => {
    g.fillStyle(PAL.warm, 0.25).fillRect(1, 1, T - 2, T - 2).fillStyle(0x1a1206).fillRect(5, 5, T - 10, T - 10);
    g.lineStyle(2, PAL.warm).strokeRect(5, 5, T - 10, T - 10);
    g.fillStyle(PAL.warm).fillTriangle(10, 9, 10, T - 9, T - 9, C).fillStyle(0xfff3d6).fillTriangle(12, 13, 12, T - 13, 18, C);
  });
  // Substation: a dead grey transformer box; powered, it runs warm with lit insulators.
  const substation = (on: boolean) => {
    const box = on ? 0xc9a463 : 0x6a7085, fin = on ? 0x9c7a3c : 0x50566a, ins = on ? 0xfff3d6 : 0x80869a;
    if (on) g.fillStyle(PAL.warm, 0.22).fillCircle(C, C, 15);
    g.fillStyle(on ? 0x5a4a2a : 0x3f4458).fillRect(3, 3, T - 6, T - 6).lineStyle(1, on ? PAL.warm : 0x5b6178).strokeRect(3.5, 3.5, T - 7, T - 7);
    g.fillStyle(0x1a1d28, 0.6).fillRect(8, 11, 18, 15).fillStyle(box).fillRect(7, 10, 18, 15);
    g.fillStyle(fin);
    for (let x = 9; x < 24; x += 3) g.fillRect(x, 13, 1, 10);
    for (const x of [10, 16, 22]) g.fillStyle(fin).fillRect(x - 1, 6, 2, 4).fillStyle(ins).fillCircle(x, 6, 2);
    g.fillStyle(on ? 0x5a3e10 : 0x3f4458).fillRect(12, 15, 8, 8).fillStyle(on ? PAL.warm : 0x8a90a4).fillTriangle(17, 15, 13, 20, 16, 20).fillTriangle(15, 19, 19, 19, 15, 23);
  };
  tex("substation", T, T, () => substation(false));
  tex("substation-on", T, T, () => substation(true));
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
  tex("lamp-off", T, T, () => lamp(g, 0x50587a, false));
  // Opaque white-to-black falloff for light pools, and a transparent soft dot for glows.
  radial(scene, "light-falloff", 256, (t) => { const v = Math.round(falloff(t) * 255); return [v, v, v, 255]; });
  radial(scene, "soft", 64, (t) => [255, 255, 255, Math.round(Math.max(0, 1 - t) ** 2 * 255)]);

  for (let c = 1; c < 8; c++) {
    const col = hex(c), pale = mixWhite(col, 0.45);
    tex(`lamp-${c}`, T, T, () => lamp(g, col, true));
    tex(`glyph-${c}`, 16, 16, () => glyph(g, c));
    // Light-made bridge: a translucent deck with bright rails and the mask's stripe pattern.
    tex(`bridge-${c}`, T, T, () => {
      g.fillStyle(col, 0.3).fillRect(0, 3, T, T - 6).fillStyle(col, 0.55).fillRect(0, 6, T, T - 12);
      pattern(g, c, 0, 6, T, T - 6, pale);
      g.lineStyle(4, col, 0.45).lineBetween(0, 5, T, 5).lineBetween(0, T - 5, T, T - 5);
      g.lineStyle(2, 0xffffff, 0.95).lineBetween(0, 5, T, 5).lineBetween(0, T - 5, T, T - 5);
    });
    // Light-made door: two glowing posts and a translucent barrier carrying the same pattern.
    tex(`door-${c}`, T, T, () => {
      g.fillStyle(col, 0.4).fillRect(6, 1, T - 12, T - 2);
      pattern(g, c, 6, 1, T - 6, T - 1, pale);
      for (const x of [2, T - 6]) g.fillStyle(col, 0.5).fillRect(x - 1, 0, 6, T).fillStyle(pale).fillRect(x, 0, 4, T).fillStyle(0xffffff).fillRect(x + 1, 0, 2, T);
    });
    tex(`drone-${c}`, T, T, () => {
      g.fillStyle(col, 0.25).fillCircle(C, C, 14);
      g.fillStyle(0x10131f).fillCircle(C, C, 9);
      g.lineStyle(2, col).strokeCircle(C, C, 9);
      g.fillStyle(col).fillCircle(C, C, 3);
      g.lineStyle(2, 0x9aa3c8).lineBetween(4, 4, 10, 10).lineBetween(T - 4, 4, T - 10, 10).lineBetween(4, T - 4, 10, T - 10).lineBetween(T - 4, T - 4, T - 10, T - 10);
    });
  }
  g.destroy();
}

const mixWhite = (c: number, k: number) => [16, 8, 0].reduce((a, s) => a | (Math.round(((c >> s) & 255) * (1 - k) + 255 * k) << s), 0);

/** Canvas texture whose pixel at normalized radius t (0 center, 1 edge) is `px(t)` as RGBA. */
function radial(scene: Phaser.Scene, key: string, size: number, px: (t: number) => number[]) {
  const ct = scene.textures.createCanvas(key, size, size)!;
  const img = ct.context.createImageData(size, size), h = size / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) img.data.set(px(Math.hypot(x + 0.5 - h, y + 0.5 - h) / h), (y * size + x) * 4);
  ct.context.putImageData(img, 0, 0);
  ct.refresh();
}

/** Stripe pattern per mask bit inside a rect, so gates differ by more than hue: red diagonals, green dots, blue bars. */
function pattern(g: Phaser.GameObjects.Graphics, c: number, x0: number, y0: number, x1: number, y1: number, col: number) {
  if (c & 0b100) {
    const h = y1 - y0;
    g.lineStyle(2, col, 0.9);
    for (let k = x0 - h; k < x1; k += 8) {
      const a = Math.max(x0, k), b = Math.min(x1, k + h);
      if (b > a) g.lineBetween(a, y1 - (a - k), b, y1 - (b - k));
    }
  }
  if (c & 0b010) for (let y = y0 + 4; y < y1 - 1; y += 7) for (let x = x0 + 4; x < x1 - 1; x += 7) g.fillStyle(0xffffff, 0.95).fillCircle(x, y, 1.6);
  if (c & 0b001) for (let x = x0 + 3; x < x1; x += 6) g.fillStyle(col, 0.7).fillRect(x, y0, 2, y1 - y0);
}

/** Top-down streetlight: footing, pole, head. On, the bulb burns in its color with a halo. */
function lamp(g: Phaser.GameObjects.Graphics, col: number, on: boolean) {
  const C = TILE / 2;
  g.fillStyle(0x000000, 0.35).fillEllipse(C + 1, TILE - 5, 12, 5);
  g.fillStyle(0x3a4160).fillCircle(C, TILE - 6, 3.5);
  g.fillStyle(0x58618a).fillRect(C - 1.5, 12, 3, TILE - 18);
  if (on) g.fillStyle(col, 0.22).fillCircle(C, 9, 11).fillStyle(col, 0.45).fillCircle(C, 9, 7.5);
  g.fillStyle(on ? 0x8a93b8 : 0x4a5275).fillRoundedRect(C - 7, 4, 14, 9, 3);
  g.fillStyle(on ? col : 0x262b3e).fillCircle(C, 9, 4);
  if (on) g.fillStyle(0xffffff).fillCircle(C - 1, 8, 1.8);
  else g.fillStyle(0x5a6288).fillRect(C - 2, 7, 2, 1);
}

/** Colorblind glyph per mask on a badge in the mask's color: red = triangle, green = circle, blue = square. */
function glyph(g: Phaser.GameObjects.Graphics, c: number) {
  g.fillStyle(0x0b1020).fillRoundedRect(0, 0, 16, 16, 4);
  g.fillStyle(hex(c)).fillRoundedRect(1, 1, 14, 14, 3);
  g.lineStyle(2, 0x0b1020);
  if (c & 0b001) g.strokeRect(3.5, 3.5, 9, 9);
  if (c & 0b100) g.strokeTriangle(8, 2.5, 13.5, 12.5, 2.5, 12.5);
  if (c & 0b010) g.strokeCircle(8, c === 2 ? 8 : 9, c === 2 ? 4.5 : 2.6);
}
