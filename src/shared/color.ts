export const R = 0b100, G = 0b010, B = 0b001;
export type ColorMask = number; // 0..7
export const NAMES = ["black", "blue", "green", "cyan", "red", "magenta", "yellow", "white"];
export const mix = (...cs: ColorMask[]) => cs.reduce((a, c) => a | c, 0);
export const reveals = (lit: ColorMask, required: ColorMask) =>
  required !== 0 && (lit & required) === required;

/** Display color per mask. Base lights come from the palette; mixes are picked to read clearly. */
const HEX = [0x000000, 0x4d8bff, 0x4dff88, 0x4dffff, 0xff4d5e, 0xff4dff, 0xffe14d, 0xffffff];
export const hex = (c: ColorMask) => HEX[c & 7];
export const css = (c: ColorMask) => "#" + hex(c).toString(16).padStart(6, "0");
