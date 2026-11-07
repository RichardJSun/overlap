import { describe, expect, it } from "vitest";
import { reveals } from "../src/shared/color.ts";
import { loadLevel, solve, validateLevel, type Level } from "../src/shared/level.ts";
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
  it("has five districts", () => expect(LEVELS.length).toBe(5));

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

    it(`${name} drones each fly under a streetlight camera, and some light can show their color`, () => {
      const lanterns = [level.lantern, ...level.filters.map((f) => f.color)];
      for (const dr of level.drones) {
        const tiles = legTiles(dr.path);
        const cams = level.lights.filter((l) => tiles.some((t) => level.lightFields.get(l.id)![t.y * level.w + t.x]));
        expect(cams.length, `${dr.id} camera`).toBeGreaterThan(0);
        // A drone in a Runner color shows only in the Runner's own glass; the Guide can only ping it.
        // A mixed-color drone can need the lantern and a streetlight overlapping.
        const shows = cams.some((l) => reveals(l.color, dr.color)) || lanterns.some((c) => reveals(c, dr.color) || cams.some((l) => reveals(l.color | c, dr.color)));
        expect(shows, `${dr.id} color`).toBe(true);
      }
    });

    level.gates.forEach((g, i) => {
      it(`${name} needs the ${g.kind} at ${g.x},${g.y}`, () => expect(solve(withoutGate(level, i))).toBe(-1));
    });

    level.filters.forEach((f, i) => {
      it(`${name} needs the filter at ${f.x},${f.y}`, () => {
        const n = solve(loadLevel({ ...level, filters: level.filters.filter((_, k) => k !== i) }));
        expect(n === -1 || n > solve(level), `solved in ${n} without it`).toBe(true);
      });
    });
  });

  it("validator rejects a streetlight that shares a color with the Runner's lantern or glass", () => {
    const d1 = LEVELS[0];
    const red = { ...d1, lights: [...d1.lights, { id: "L2", x: 2, y: 1, color: 4, radius: 3 }] };
    expect(validateLevel(red).join()).toMatch(/streetlight L2 is red.*the glass must give colors the city lacks/);
    const blueGlass = { ...d1, filters: [{ x: 3, y: 1, color: 1 }] };
    expect(validateLevel(blueGlass).join()).toMatch(/streetlight L1 is blue/);
    expect(validateLevel(d1)).toEqual([]);
  });

  it("district 3 needs both lights on at once for the cyan bridge", () => {
    expect(solve(LEVELS[2], { maxLights: 1 })).toBe(-1);
  });

  it("district 5 needs two streetlights at once, for the cyan bridge and the white door", () => {
    expect(solve(LEVELS[4], { maxLights: 1 })).toBe(-1);
  });

  it("district 5 has a mixed-color drone that only the lantern and a streetlight together can show", () => {
    const level = LEVELS[4];
    const mixed = level.drones.filter((d) => ![1, 2, 4].includes(d.color));
    expect(mixed.length).toBeGreaterThan(0);
    for (const d of mixed) {
      expect(reveals(level.lantern, d.color)).toBe(false);
      expect(level.lights.some((l) => reveals(l.color, d.color))).toBe(false);
    }
  });

  it("later districts need longer solutions than the tutorial", () => {
    const steps = LEVELS.map((l) => solve(l));
    for (const n of steps.slice(1)) expect(n).toBeGreaterThan(steps[0]);
  });
});
