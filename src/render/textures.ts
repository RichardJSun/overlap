import Phaser from "phaser";
import { hex } from "../shared/color.ts";
import { TILE } from "../shared/level.ts";

export const PAL = {
  night: 0x0b1020, wall: 0x1b2238, wallEdge: 0x2c3758, street: 0x141a2e, warm: 0xffd38a, text: 0xe8ecff,
};

/**
 * Every procedural texture the game uses. Keys:
 *   street, wall, gap, exit, exit-open, substation, substation-on, runner, guide, ping, soft,
 *   lamp-off, lamp-<mask>, bridge-<mask>, door-<mask>, drone-<mask>, glyph-<mask>   (mask 1..7)
 */
export function makeTextures(scene: Phaser.Scene) {
  if (scene.textures.exists("street")) return;
  const g = scene.make.graphics({}, false);
  const T = TILE;
  const tex = (key: string, w: number, h: number, draw: () => void) => { g.clear(); draw(); g.generateTexture(key, w, h); };

  tex("street", T, T, () => {
    g.fillStyle(0x5a6690).fillRect(0, 0, T, T);
    g.fillStyle(0x6a77a6).fillRect(1, 1, T - 2, T - 2);
    g.fillStyle(0x7a88b8, 0.6).fillRect(4, 14, 3, 3).fillRect(20, 6, 2, 2).fillRect(24, 24, 3, 2);
  });
  tex("wall", T, T, () => {
    g.fillStyle(0x8a96c8).fillRect(0, 0, T, T);
    g.fillStyle(0xa2b0e8).fillRect(0, 0, T, 4);
    g.fillStyle(0x6e7aa8).fillRect(0, T - 3, T, 3);
    g.fillStyle(0xd8c890, 0.5).fillRect(7, 10, 5, 6).fillRect(20, 10, 5, 6).fillRect(7, 20, 5, 6);
  });
  tex("gap", T, T, () => {
    g.fillStyle(0x070a14).fillRect(0, 0, T, T);
    g.lineStyle(1, 0x24305a, 0.8).lineBetween(4, 10, 14, 10).lineBetween(16, 22, 28, 22);
  });
  tex("exit", T, T, () => {
    g.fillStyle(0x6a77a6).fillRect(0, 0, T, T);
    g.lineStyle(3, 0x9aa3c8).strokeRect(4, 4, T - 8, T - 8);
    g.lineBetween(8, 8, T - 8, T - 8).lineBetween(T - 8, 8, 8, T - 8);
  });
  tex("exit-open", T, T, () => {
    g.fillStyle(0x6a77a6).fillRect(0, 0, T, T);
    g.fillStyle(PAL.warm).fillTriangle(8, 6, 8, T - 6, T - 6, T / 2);
  });
  tex("substation", T, T, () => {
    g.fillStyle(0x2a3050).fillRect(3, 3, T - 6, T - 6);
    g.lineStyle(2, 0x9aa3c8).strokeRect(3, 3, T - 6, T - 6);
    g.fillStyle(0x9aa3c8).fillTriangle(18, 6, 10, 18, 16, 18).fillTriangle(16, 14, 22, 14, 14, 26);
  });
  tex("substation-on", T, T, () => {
    g.fillStyle(0x5a4a20).fillRect(3, 3, T - 6, T - 6);
    g.lineStyle(2, PAL.warm).strokeRect(3, 3, T - 6, T - 6);
    g.fillStyle(PAL.warm).fillTriangle(18, 6, 10, 18, 16, 18).fillTriangle(16, 14, 22, 14, 14, 26);
  });
  tex("runner", T, T, () => {
    g.fillStyle(0x000000, 0.35).fillEllipse(T / 2, T - 5, 18, 6);
    g.fillStyle(0xe8ecff).fillCircle(T / 2, 10, 5);
    g.fillStyle(0xc8d0f0).fillRoundedRect(T / 2 - 6, 15, 12, 12, 3);
    g.fillStyle(0xffe9b0).fillCircle(T / 2 + 9, 19, 3);
  });
  tex("guide", T, T, () => {
    g.fillStyle(0x000000, 0.35).fillEllipse(T / 2, T - 5, 18, 6);
    g.fillStyle(0xe8ecff).fillCircle(T / 2, 10, 5);
    g.fillStyle(0x8ab4a0).fillRoundedRect(T / 2 - 6, 15, 12, 12, 3);
    g.lineStyle(2, 0x4dff88).strokeCircle(T / 2, 10, 7);
  });
  tex("ping", 64, 64, () => {
    g.lineStyle(4, 0xffffff).strokeCircle(32, 32, 26);
    g.fillStyle(0xffffff).fillCircle(32, 32, 6);
  });
  tex("lamp-off", T, T, () => lamp(g, 0x50587a, false));
  // Soft radial dot for glows (concentric discs approximate a gradient).
  tex("soft", 64, 64, () => { for (let r = 32; r > 0; r -= 2) g.fillStyle(0xffffff, 0.06).fillCircle(32, 32, r); });

  for (let c = 1; c < 8; c++) {
    const col = hex(c);
    tex(`lamp-${c}`, T, T, () => lamp(g, col, true));
    tex(`glyph-${c}`, 12, 12, () => glyph(g, c, 0xffffff));
    tex(`bridge-${c}`, T, T, () => {
      g.fillStyle(col, 0.85).fillRect(0, 4, T, T - 8);
      g.fillStyle(0x000000, 0.25);
      for (let x = 3; x < T; x += 7) g.fillRect(x, 4, 2, T - 8);
      g.lineStyle(2, 0xffffff, 0.7).lineBetween(0, 5, T, 5).lineBetween(0, T - 5, T, T - 5);
    });
    tex(`door-${c}`, T, T, () => {
      g.fillStyle(col, 0.35).fillRect(2, 0, T - 4, T);
      g.lineStyle(2, col, 1).strokeRect(3, 1, T - 6, T - 2);
      g.lineStyle(1, 0xffffff, 0.6);
      for (let y = 6; y < T; y += 6) g.lineBetween(6, y, T - 6, y);
    });
    tex(`drone-${c}`, T, T, () => {
      g.fillStyle(col, 0.25).fillCircle(T / 2, T / 2, 14);
      g.fillStyle(0x10131f).fillCircle(T / 2, T / 2, 9);
      g.lineStyle(2, col).strokeCircle(T / 2, T / 2, 9);
      g.fillStyle(col).fillCircle(T / 2, T / 2, 3);
      g.lineStyle(2, 0x9aa3c8).lineBetween(4, 4, 10, 10).lineBetween(T - 4, 4, T - 10, 10).lineBetween(4, T - 4, 10, T - 10).lineBetween(T - 4, T - 4, T - 10, T - 10);
    });
  }
  g.destroy();
}

function lamp(g: Phaser.GameObjects.Graphics, col: number, on: boolean) {
  const T = TILE;
  if (on) g.fillStyle(col, 0.35).fillCircle(T / 2, 9, 9);
  g.fillStyle(0x2c3758).fillRect(T / 2 - 2, 12, 4, T - 16);
  g.fillStyle(0x2c3758).fillRect(T / 2 - 6, T - 6, 12, 3);
  g.fillStyle(col).fillCircle(T / 2, 9, 5);
}

/** Colorblind glyph per mask: red = triangle, green = circle, blue = square, mixes overlay them. */
function glyph(g: Phaser.GameObjects.Graphics, c: number, col: number) {
  g.lineStyle(2, col, 1);
  if (c & 0b100) g.strokeTriangle(6, 1, 11, 11, 1, 11);
  if (c & 0b010) g.strokeCircle(6, 6, 4);
  if (c & 0b001) g.strokeRect(2, 2, 8, 8);
}
