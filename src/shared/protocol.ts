// The contract between all tracks. Change it only from the main session, with a note in docs/DEVLOG.md.
export type Role = "runner" | "guide";
export type Vec = { x: number; y: number };

export type Msg =
  | { t: "hello"; role: Role }
  | { t: "peer"; connected: boolean } // server -> client
  | { t: "snapshot"; s: Snapshot } // runner -> server -> guide
  | { t: "runner_move"; p: Vec }
  | { t: "drones"; d: { id: string; p: Vec }[] }
  | { t: "ping"; id: string; p: Vec }
  | { t: "light"; id: string; on: boolean }
  | { t: "substation"; id: string }
  | { t: "district"; index: number }
  | { t: "lantern"; c: number } // runner picked up a filter
  | { t: "flare"; p: Vec } // runner flashed their lantern so the guide can find them
  | { t: "ending" };

export type Snapshot = {
  district: number;
  runner: Vec;
  lightsOn: string[];
  substationsPowered: string[];
  drones: { id: string; p: Vec }[];
  lantern: number;
};
