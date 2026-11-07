import { reveals, type ColorMask } from "./color.ts";
import { sourceField, type Grid, type LightSource } from "./lighting.ts";
import type { Vec } from "./protocol.ts";

export const TILE = 32;
export const LANTERN_RADIUS = 4;

/**
 * Hand-authored district. `map` rows use:
 *   `#` wall (blocks movement and light)   `.` street   `~` gap (impassable unless a revealed bridge)
 *   `S` runner start (street)              `E` exit (street once every substation is powered)
 * Gates sit on `~` (bridge) or `.` (door). A hidden door blocks movement but not light.
 */
export type LevelJson = {
  name: string;
  intro?: string;
  lantern: ColorMask;
  budget: number;
  budgetPerSubstation: number;
  map: string[];
  lights: { id: string; x: number; y: number; color: ColorMask; radius: number }[];
  gates: { x: number; y: number; kind: "bridge" | "door"; color: ColorMask }[];
  substations: { id: string; x: number; y: number; block: { x: number; y: number; w: number; h: number } }[];
  drones: { id: string; color: ColorMask; speed: number; path: Vec[] }[];
  signs?: { x: number; y: number; text: string }[];
};

export type Level = LevelJson & Grid & {
  start: Vec;
  exit: Vec;
  at(x: number, y: number): string;
  gateAt(x: number, y: number): LevelJson["gates"][number] | undefined;
  /** Precomputed field per streetlight, keyed by id (streetlights never move). */
  lightFields: Map<string, Uint8Array>;
};

export function loadLevel(j: LevelJson): Level {
  const errs = validateLevel(j);
  if (errs.length) throw new Error(`Level "${j.name}" is invalid:\n  ${errs.join("\n  ")}`);
  const h = j.map.length, w = j.map[0].length;
  const find = (c: string) => {
    for (let y = 0; y < h; y++) { const x = j.map[y].indexOf(c); if (x >= 0) return { x, y }; }
    throw new Error(`missing ${c}`);
  };
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? "#" : j.map[y][x]);
  const gates = new Map(j.gates.map((g) => [g.y * w + g.x, g]));
  const level: Level = {
    ...j, w, h, start: find("S"), exit: find("E"), at,
    solid: (x, y) => at(x, y) === "#",
    gateAt: (x, y) => gates.get(y * w + x),
    lightFields: new Map(),
  };
  for (const l of j.lights) level.lightFields.set(l.id, sourceField(level, l));
  return level;
}

export function validateLevel(j: LevelJson): string[] {
  const e: string[] = [];
  const h = j.map?.length ?? 0, w = j.map?.[0]?.length ?? 0;
  if (!h || !w) return ["map is empty"];
  j.map.forEach((row, y) => { if (row.length !== w) e.push(`row ${y} has length ${row.length}, expected ${w}`); if (/[^#.~SE]/.test(row)) e.push(`row ${y} has unknown characters`); });
  const count = (c: string) => j.map.join("").split(c).length - 1;
  if (count("S") !== 1) e.push("map needs exactly one S");
  if (count("E") !== 1) e.push("map needs exactly one E");
  const at = (x: number, y: number) => j.map[y]?.[x];
  const inside = (x: number, y: number) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < w && y < h;
  const color = (c: number, what: string) => { if (!Number.isInteger(c) || c < 1 || c > 7) e.push(`${what} color ${c} is not 1..7`); };
  const ids = new Set<string>();
  const uniq = (id: string) => { if (ids.has(id)) e.push(`duplicate id ${id}`); ids.add(id); };
  color(j.lantern, "lantern");
  if (!(j.budget >= 0) || !(j.budgetPerSubstation >= 0)) e.push("budget values must be >= 0");
  for (const l of j.lights) {
    uniq(l.id); color(l.color, `light ${l.id}`);
    if (!inside(l.x, l.y)) e.push(`light ${l.id} is outside the map`);
    if (!(l.radius >= 1 && l.radius <= 6)) e.push(`light ${l.id} radius ${l.radius} out of range`);
  }
  for (const g of j.gates) {
    color(g.color, `gate at ${g.x},${g.y}`);
    if (!inside(g.x, g.y)) e.push(`gate at ${g.x},${g.y} is outside the map`);
    else if (g.kind === "bridge" && at(g.x, g.y) !== "~") e.push(`bridge at ${g.x},${g.y} must sit on ~`);
    else if (g.kind === "door" && at(g.x, g.y) !== ".") e.push(`door at ${g.x},${g.y} must sit on .`);
  }
  if (j.substations.length < 1 || j.substations.length > 2) e.push("a district needs 1 or 2 substations");
  for (const s of j.substations) {
    uniq(s.id);
    if (!inside(s.x, s.y) || at(s.x, s.y) !== ".") e.push(`substation ${s.id} must sit on a street tile`);
  }
  for (const d of j.drones) {
    uniq(d.id); color(d.color, `drone ${d.id}`);
    if (d.path.length < 2) e.push(`drone ${d.id} needs at least 2 waypoints`);
    d.path.forEach((p, i) => {
      const q = d.path[(i + 1) % d.path.length];
      if (!inside(p.x, p.y)) e.push(`drone ${d.id} waypoint ${i} is outside the map`);
      if (p.x !== q.x && p.y !== q.y) e.push(`drone ${d.id} leg ${i} is not axis-aligned`);
    });
    if (!(d.speed > 0)) e.push(`drone ${d.id} speed must be > 0`);
  }
  return e;
}

/** Light sources for the current state: the runner's lantern plus every streetlight that is on. */
export function sources(level: Level, runner: Vec, lightsOn: Iterable<string>): LightSource[] {
  const on = new Set(lightsOn);
  return [
    { x: runner.x, y: runner.y, color: level.lantern, radius: LANTERN_RADIUS },
    ...level.lights.filter((l) => on.has(l.id)),
  ];
}

export const budgetFor = (level: Level, powered: number) => level.budget + powered * level.budgetPerSubstation;

/** Whether the runner may stand on (x, y) given the light there. */
export function passable(level: Level, x: number, y: number, lit: ColorMask, exitOpen: boolean): boolean {
  const c = level.at(x, y);
  if (c === "#") return false;
  if (c === "E") return exitOpen;
  const g = level.gateAt(x, y);
  if (c === "~") return !!g && g.kind === "bridge" && reveals(lit, g.color);
  if (g?.kind === "door") return reveals(lit, g.color);
  return true;
}

/** Whether a drone of this color is visible to the runner under `lit`. */
export const droneVisible = (lit: ColorMask, color: ColorMask) => reveals(lit, color);

/** Position of a drone `t` seconds into its patrol loop (tile units, fractional between tiles). */
export function dronePos(d: LevelJson["drones"][number], t: number): Vec {
  const legs = d.path.map((p, i) => { const q = d.path[(i + 1) % d.path.length]; return { p, q, len: Math.abs(q.x - p.x) + Math.abs(q.y - p.y) }; });
  const total = legs.reduce((a, l) => a + l.len, 0);
  let s = ((t * d.speed) % total + total) % total;
  for (const l of legs) {
    if (s <= l.len) { const k = l.len ? s / l.len : 0; return { x: l.p.x + (l.q.x - l.p.x) * k, y: l.p.y + (l.q.y - l.p.y) * k }; }
    s -= l.len;
  }
  return { ...d.path[0] };
}

/**
 * BFS over (runner tile, set of lights on, substations powered). The guide may toggle lights at any
 * time within budget. Drones are timing hazards and are not modelled. Returns the number of steps
 * (moves + toggles) in a shortest solution, or -1 when the exit is unreachable.
 * `maxLights` caps the budget, e.g. 0 to prove the district needs the guide.
 */
export function solve(level: Level, opts: { maxLights?: number } = {}): number {
  const { w } = level;
  const ids = level.lights.map((l) => l.id);
  const fields = ids.map((id) => level.lightFields.get(id)!);
  const lantern = new Map<number, Uint8Array>();
  const lanternAt = (x: number, y: number) => {
    const k = y * w + x;
    let f = lantern.get(k);
    if (!f) lantern.set(k, (f = sourceField(level, { x, y, color: level.lantern, radius: LANTERN_RADIUS })));
    return f;
  };
  const subIdx = new Map(level.substations.map((s, i) => [s.y * w + s.x, i]));
  const allSubs = (1 << level.substations.length) - 1;
  const pop = (m: number) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };
  const key = (pos: number, lights: number, subs: number) => (pos * (1 << ids.length) + lights) * 4 + subs;

  const startPos = level.start.y * w + level.start.x;
  const seen = new Set<number>([key(startPos, 0, 0)]);
  let frontier: [number, number, number][] = [[startPos, 0, 0]];
  for (let depth = 0; frontier.length; depth++) {
    const next: [number, number, number][] = [];
    for (const [pos, lights, subs] of frontier) {
      const x = pos % w, y = (pos - x) / w;
      if (pos === level.exit.y * w + level.exit.x) return depth;
      const push = (p: number, l: number, s: number) => { const k = key(p, l, s); if (!seen.has(k)) { seen.add(k); next.push([p, l, s]); } };
      const budget = Math.min(budgetFor(level, pop(subs)), opts.maxLights ?? Infinity);
      for (let i = 0; i < ids.length; i++) {
        const bit = 1 << i;
        if (lights & bit) push(pos, lights & ~bit, subs);
        else if (pop(lights) < budget) push(pos, lights | bit, subs);
      }
      const lf = lanternAt(x, y);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, ni = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= level.h) continue;
        let lit = lf[ni];
        for (let i = 0; i < ids.length; i++) if (lights & (1 << i)) lit |= fields[i][ni];
        if (!passable(level, nx, ny, lit, subs === allSubs)) continue;
        const si = subIdx.get(ni);
        push(ni, lights, si === undefined ? subs : subs | (1 << si));
      }
    }
    frontier = next;
  }
  return -1;
}
