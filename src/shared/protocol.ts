// The contract between all tracks. Change it only from the main session, with a note in docs/DEVLOG.md.
export type Role = "runner" | "guide";
export type Vec = { x: number; y: number };
/** The Guide's quick signals, shown over the Runner's head. */
export type Emote = "wait" | "go" | "flare";
export const EMOTES: Emote[] = ["wait", "go", "flare"];

export type Msg =
  | { t: "hello"; role: Role }
  | { t: "peer"; connected: boolean } // server -> client
  | { t: "snapshot"; s: Snapshot } // runner -> server -> guide
  | { t: "runner_move"; p: Vec }
  | { t: "drones"; d: { id: string; p: Vec }[] }
  | { t: "ping"; id: string; p: Vec; danger?: boolean } // danger: "stop, don't go here"
  | { t: "light"; id: string; on: boolean }
  | { t: "substation"; id: string }
  | { t: "district"; index: number }
  | { t: "lantern"; c: number } // runner picked up a filter
  | { t: "flare"; p: Vec } // runner flashed their lantern so the guide can find them
  | { t: "emote"; e: Emote } // guide -> runner: wait, go, or "flare so I can see you"
  | { t: "breaker"; rule: string } // runner -> guide: every district is done; both go to the main breaker
  | { t: "rule"; rule: string } // guide -> runner: the guide installed a new breaker rule
  | { t: "lever"; result: "closed" | "locked" | "tripped" } // runner -> guide: what happened when the runner pulled it
  | { t: "ending"; ms?: number; caught?: number }; // run time and drone catches, for the credits

export type Snapshot = {
  district: number;
  runner: Vec;
  lightsOn: string[];
  substationsPowered: string[];
  drones: { id: string; p: Vec }[];
  lantern: number;
};
