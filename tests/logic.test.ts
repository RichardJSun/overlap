import { describe, expect, it } from "vitest";
import { B, G, R, mix, reveals } from "../src/shared/color.ts";
import { lightField, type Grid } from "../src/shared/lighting.ts";
import { dronePos, loadLevel, onCamera, solve, validateLevel, type LevelJson } from "../src/shared/level.ts";
import { LEVELS } from "../src/levels/index.ts";

const grid = (rows: string[]): Grid => ({ w: rows[0].length, h: rows.length, solid: (x, y) => rows[y]?.[x] === "#" });

describe("color", () => {
  it("mixes additively and reveals only full matches", () => {
    expect(mix(R, B)).toBe(0b101);
    expect(reveals(mix(R, B), mix(R, B))).toBe(true);
    expect(reveals(R, mix(R, B))).toBe(false);
    expect(reveals(0b111, G)).toBe(true);
    expect(reveals(0b111, 0)).toBe(false);
  });
});

describe("lighting", () => {
  const g = grid([".......", "...#...", "......."]);
  it("walls block light", () => {
    const f = lightField(g, [{ x: 1, y: 1, color: R, radius: 6 }]);
    expect(f[1 * 7 + 2]).toBe(R);
    expect(f[1 * 7 + 3]).toBe(R); // the wall face itself is lit
    expect(f[1 * 7 + 5]).toBe(0); // shadow behind the wall
  });
  it("respects radius", () => {
    const f = lightField(g, [{ x: 0, y: 0, color: R, radius: 2 }]);
    expect(f[0 * 7 + 2]).toBe(R);
    expect(f[0 * 7 + 3]).toBe(0);
  });
  it("overlaps OR together", () => {
    const f = lightField(g, [{ x: 0, y: 0, color: R, radius: 3 }, { x: 2, y: 0, color: B, radius: 3 }]);
    expect(f[0 * 7 + 1]).toBe(R | B);
  });
});

describe("drones", () => {
  it("patrol their loop", () => {
    const d = { id: "d", color: G, speed: 1, path: [{ x: 0, y: 0 }, { x: 3, y: 0 }] };
    expect(dronePos(d, 0)).toEqual({ x: 0, y: 0 });
    expect(dronePos(d, 3)).toEqual({ x: 3, y: 0 });
    expect(dronePos(d, 4.5)).toEqual({ x: 1.5, y: 0 });
  });
});

describe("levels", () => {
  it("validator catches broken data", () => {
    const bad = { name: "x", lantern: 9, budget: 1, budgetPerSubstation: 1, map: ["#S#", "##"], lights: [], gates: [], substations: [], drones: [] } as LevelJson;
    expect(validateLevel(bad).length).toBeGreaterThan(2);
    expect(() => loadLevel(bad)).toThrow();
  });
  it("has three districts", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(1);
  });
  LEVELS.forEach((level, i) => {
    it(`district ${i + 1} (${level.name}) is solvable within budget`, () => {
      expect(solve(level)).toBeGreaterThan(0);
    });
    it(`district ${i + 1} (${level.name}) cannot be solved without the guide`, () => {
      expect(solve(level, { maxLights: 0 })).toBe(-1);
    });
  });
});

describe("lantern filters", () => {
  // Blue lantern + red streetlight is magenta, which can't open the yellow door. Picking up the
  // green filter makes green + red = yellow.
  const corridor = (filters: LevelJson["filters"]): LevelJson => ({
    name: "corridor", lantern: 1, budget: 1, budgetPerSubstation: 0,
    map: ["###########", "#S.......E#", "###########"],
    lights: [{ id: "L", x: 7, y: 1, color: 4, radius: 2 }],
    gates: [{ x: 8, y: 1, kind: "door", color: 6 }],
    substations: [{ id: "P", x: 5, y: 1, block: { x: 4, y: 0, w: 3, h: 3 } }],
    drones: [], filters,
  });
  it("a filter recolors the lantern and opens a mix the old color couldn't", () => {
    expect(solve(loadLevel(corridor([{ x: 3, y: 1, color: 2 }])))).toBeGreaterThan(0);
    expect(solve(loadLevel(corridor([])))).toBe(-1);
    expect(solve(loadLevel(corridor([{ x: 3, y: 1, color: 2 }])), { maxLights: 0 })).toBe(-1);
  });
  it("validator rejects mixed-color filters and filters on gates", () => {
    expect(validateLevel(corridor([{ x: 3, y: 1, color: 6 }])).join()).toMatch(/must be red/);
    expect(validateLevel(corridor([{ x: 8, y: 1, color: 2 }])).join()).toMatch(/shares a tile/);
  });
});

describe("cameras", () => {
  const d1 = LEVELS[0];
  it("streetlights and powered blocks see the runner; the lantern alone doesn't", () => {
    expect(onCamera(d1, { x: 11, y: 7 }, ["L1"], [])).toBe(true);
    expect(onCamera(d1, { x: 2, y: 2 }, ["L1"], [])).toBe(false);
    expect(onCamera(d1, { x: 11, y: 7 }, [], [])).toBe(false);
    expect(onCamera(d1, { x: 17, y: 3 }, [], ["S1"])).toBe(true);
  });
});
