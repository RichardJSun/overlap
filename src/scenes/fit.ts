import type Phaser from "phaser";
import { TILE, type Level } from "../shared/level.ts";

export const HUD_TOP = 44;

const PAD = 8;
const zoomFor = (level: Level, w: number, h: number, top: number, bottom: number) =>
  Math.min((w - PAD * 2) / (level.w * TILE), (h - top - bottom - PAD * 2) / (level.h * TILE));

/** Space to keep clear above and below the map. The map drops below the coach box and above the goal line whenever that costs no zoom. */
export function bands(level: Level, w: number, h: number, bottom: number): [number, number] {
  const clear: [number, number] = [150, bottom + 40];
  return zoomFor(level, w, h, ...clear) >= zoomFor(level, w, h, HUD_TOP, bottom) ? clear : [HUD_TOP, bottom];
}

/** Zoom and center the camera so the whole district fits between the HUD bars. */
export function fitCamera(cam: Phaser.Cameras.Scene2D.Camera, level: Level, w: number, h: number, top: number, bottom: number) {
  const mw = level.w * TILE, mh = level.h * TILE;
  const z = zoomFor(level, w, h, top, bottom);
  cam.setZoom(z);
  // Shift the center so the map sits in the free band between the bars.
  cam.centerOn(mw / 2, mh / 2 - (top - bottom) / 2 / z);
}
