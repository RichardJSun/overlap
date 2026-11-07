import { loadLevel, type LevelJson } from "../shared/level.ts";
import d1 from "./d1.json";
import d2 from "./d2.json";
import d3 from "./d3.json";

/** Districts in play order. */
export const LEVELS = [d1, d2, d3].map((j) => loadLevel(j as LevelJson));
