import { describe, expect, it } from "vitest";
import { B, G, R, mix, reveals } from "../src/shared/color.ts";
import { lightField, type Grid } from "../src/shared/lighting.ts";
import { dronePos, loadLevel, solve, validateLevel, type LevelJson } from "../src/shared/level.ts";
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
