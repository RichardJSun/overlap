import { describe, expect, it } from "vitest";
import { reveals } from "../src/shared/color.ts";
import { loadLevel, solve, type Level } from "../src/shared/level.ts";
import { LEVELS } from "../src/levels/index.ts";

/** Tiles a drone visits along each axis-aligned leg of its loop, endpoints included. */
const legTiles = (path: { x: number; y: number }[]) =>
  path.flatMap((p, i) => {
    const q = path[(i + 1) % path.length];
    const n = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
    return Array.from({ length: n + 1 }, (_, k) => ({ x: p.x + Math.sign(q.x - p.x) * k, y: p.y + Math.sign(q.y - p.y) * k }));
  });

/** The same level with one gate bricked up. */
const withoutGate = (level: Level, i: number) => {
  const g = level.gates[i];
  const map = level.map.map((row, y) => (y === g.y ? row.slice(0, g.x) + "#" + row.slice(g.x + 1) : row));
  return loadLevel({ ...level, map, gates: level.gates.filter((_, k) => k !== i) });
};

describe("district data", () => {
  it("has three districts", () => expect(LEVELS.length).toBe(3));

  LEVELS.forEach((level, d) => {
    const name = `district ${d + 1} (${level.name})`;

    it(`${name} is 24x16 with a solid border`, () => {
      expect([level.w, level.h]).toEqual([24, 16]);
      level.map.forEach((row, y) => {
        if (y === 0 || y === level.h - 1) expect(row).toBe("#".repeat(level.w));
        else expect(row[0] + row[level.w - 1]).toBe("##");
      });
    });

    it(`${name} has no white lights and streetlight radii 3..5`, () => {
      for (const l of level.lights) {
        expect(l.color).not.toBe(7);
        expect(l.radius).toBeGreaterThanOrEqual(3);
        expect(l.radius).toBeLessThanOrEqual(5);
      }
    });

    it(`${name} drones fly over streets and water, never through buildings`, () => {
      for (const dr of level.drones) for (const t of legTiles(dr.path)) expect(level.at(t.x, t.y), `${dr.id} at ${t.x},${t.y}`).not.toBe("#");
    });

    it(`${name} drones can each be exposed by some streetlight`, () => {
      for (const dr of level.drones) {
        const tiles = legTiles(dr.path);
        const exposed = level.lights.some((l) => reveals(l.color, dr.color) && tiles.some((t) => level.lightFields.get(l.id)![t.y * level.w + t.x]));
        expect(exposed, dr.id).toBe(true);
      }
    });

    level.gates.forEach((g, i) => {
      it(`${name} needs the ${g.kind} at ${g.x},${g.y}`, () => expect(solve(withoutGate(level, i))).toBe(-1));
    });
  });

  it("district 3 needs both lights on at once for the cyan bridge", () => {
    expect(solve(LEVELS[2], { maxLights: 1 })).toBe(-1);
  });

  it("later districts need longer solutions than the tutorial", () => {
    const steps = LEVELS.map((l) => solve(l));
    expect(steps[1]).toBeGreaterThan(steps[0]);
    expect(steps[2]).toBeGreaterThan(steps[0]);
  });
});
