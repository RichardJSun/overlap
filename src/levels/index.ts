import { loadLevel, type LevelJson } from "../shared/level.ts";
import d1 from "./d1.json";

/** Districts in play order. */
export const LEVELS = [d1 as LevelJson].map(loadLevel);
