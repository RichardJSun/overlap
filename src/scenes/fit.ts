import type Phaser from "phaser";
import { TILE, type Level } from "../shared/level.ts";

export const HUD_TOP = 44;

/** Zoom and center the camera so the whole district fits between the HUD bars. */
export function fitCamera(cam: Phaser.Cameras.Scene2D.Camera, level: Level, w: number, h: number, top: number, bottom: number) {
  const mw = level.w * TILE, mh = level.h * TILE, pad = 8;
  const z = Math.min((w - pad * 2) / mw, (h - top - bottom - pad * 2) / mh);
  cam.setZoom(z);
  // Shift the center so the map sits in the free band between the bars.
  cam.centerOn(mw / 2, mh / 2 - (top - bottom) / 2 / z);
}
