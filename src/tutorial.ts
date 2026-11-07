import Phaser from "phaser";
import type { Hud } from "./hud.ts";
import { TILE, type Level } from "./shared/level.ts";
import type { Role, Vec } from "./shared/protocol.ts";

/** What the coach needs to know each frame. Flags like `flared` are sticky for the district. */
export type TutorCtx = {
  level: Level;
  runner: Vec; // the runner's tile (for the guide: where they are, even off camera)
  moved: number;
  flared: boolean;
  pinged: boolean; // guide sent / runner received a ping
  lampsOn: number;
  powered: number;
  bridgeOpen: boolean; // sticky: a bridge has been revealed at least once this district
  seen: boolean; // guide: runner on camera
  filterInView: Vec | null;
  unseenDrone: Vec | null;
  /** Whether this player can see tile p. The runner's pointer never marks a tile that's still dark. */
  visible: (p: Vec) => boolean;
};

type Step = { text: string; target?: (c: TutorCtx) => Vec | undefined; done: (c: TutorCtx) => boolean; when?: (c: TutorCtx) => boolean };

const bridge = (c: TutorCtx) => c.level.gates.find((g) => g.kind === "bridge");
const sub = (c: TutorCtx) => c.level.substations[0];

/** District 1 walks each role through its half of the game, one step at a time. */
const TUTORIAL: Record<Role, Step[]> = {
  runner: [
    { text: "Walk with the arrow keys or WASD, or tap a tile. You only see what your lantern lights.", target: (c) => c.runner, done: (c) => c.moved >= 4 },
    { text: "Your Guide sees the whole city, but sees you only under a lit streetlight. Press Space (or tap yourself) to flare and show them where you are.", target: (c) => c.runner, done: (c) => c.flared },
    { text: "Talk to your Guide. Their pings show up even in the dark, so head where they point.", done: (c) => c.pinged || c.moved >= 14 },
    { text: "A bridge crosses the canal, but only in magenta light. Red lantern + blue streetlight = magenta. Walk to the canal and ask your Guide for blue!", target: (c) => bridge(c), done: (c) => c.bridgeOpen || c.powered > 0 },
    { text: "Cross, then find the substation ⚡. You can't see it, but your Guide can, so follow their pings.", target: (c) => sub(c), done: (c) => c.powered > 0 },
    { text: "The block is back on and the exit is lit. Ask your Guide the way, then go!", target: (c) => c.level.exit, done: () => false },
  ],
  guide: [
    { text: "You run the grid. You can see the city and its drones, but you only see the Runner under a lit streetlight or in a powered block. Ask them to flare, or press Flare? on your console.", target: (c) => c.runner, done: (c) => c.flared || c.seen },
    { text: "Tap any tile to ping it. The Runner sees pings even in the dark. Ping the bridge over the canal.", target: (c) => bridge(c), done: (c) => c.pinged },
    { text: "Tap the blue streetlight to switch it on. Blue + the Runner's red lantern = magenta, and the bridge appears.", target: (c) => c.level.lights[0], done: (c) => c.lampsOn > 0 },
    { text: "The streetlight is a camera too, so you'll see the Runner when they're in its light. Guide them to the substation ⚡.", target: (c) => sub(c), done: (c) => c.powered > 0 },
    { text: "Each substation gives you more power. Now talk them to the exit. Wait and Go on your console show up over the Runner's head.", target: (c) => c.level.exit, done: () => false },
  ],
};

/** Later districts: one-off tips that show the first time their situation comes up. */
const HINTS: Record<Role, Step[]> = {
  runner: [
    { text: "Colored glass! Walk over a filter to change your lantern's color. Your Guide has to plan around it.", target: (c) => c.filterInView ?? undefined, when: (c) => !!c.filterInView, done: () => false },
  ],
  guide: [
    { text: "An amber ring marks a drone the Runner can't see. Light it in its own color, or right-click (hold on a phone) to send a danger ping.", target: (c) => c.unseenDrone ?? undefined, when: (c) => !!c.unseenDrone, done: () => false },
  ],
};
const HINT_MS = 7000;

/** Shows the current coaching step in the HUD and bounces a pointer over its target tile. */
export class Tutor {
  private steps: Step[] = [];
  private tutorial = false;
  private shown?: Step;
  private hintUntil = 0;
  private seenHints = new Set<Step>();
  private holdUntil = -1; // district 1 lets the radio call play before the first step
  private hold = 0;

  constructor(private scene: Phaser.Scene, private hud: Hud, private role: Role) {}

  setDistrict(di: number) {
    this.tutorial = di === 0;
    this.steps = this.tutorial ? TUTORIAL[this.role] : HINTS[this.role];
    this.hold = this.tutorial ? 5500 : 0;
    this.holdUntil = -1;
    this.show(undefined);
  }

  update(c: TutorCtx) {
    const now = this.scene.time.now;
    if (this.holdUntil < 0) this.holdUntil = now + this.hold;
    if (now < this.holdUntil) return;
    let step: Step | undefined;
    if (this.tutorial) {
      const i = this.steps.findIndex((s) => !s.done(c));
      step = i >= 0 && (this.steps[i].when?.(c) ?? true) ? this.steps[i] : undefined;
      if (step !== this.shown) this.show(step, step ? `${i + 1}/${this.steps.length}` : "");
    } else {
      if (this.shown && now > this.hintUntil) this.show(undefined);
      if (!this.shown) {
        step = this.steps.find((s) => !this.seenHints.has(s) && (s.when?.(c) ?? true));
        if (step) { this.seenHints.add(step); this.hintUntil = now + HINT_MS; this.show(step, "Tip"); }
      }
      step = this.shown;
    }
    const t0 = step?.target?.(c);
    const t = t0 && c.visible(t0) ? t0 : undefined;
    // The note's leader line ends on the tile, in pane pixels.
    const cam = this.scene.cameras.main;
    this.hud.leader(t ? { x: (t.x * TILE + TILE / 2 - cam.worldView.x) * cam.zoom, y: (t.y * TILE + TILE / 2 - cam.worldView.y) * cam.zoom } : null);
  }

  private show(step: Step | undefined, label = "") {
    this.shown = step;
    this.hud.coach(step?.text ?? null, label);
  }

  destroy() { this.hud.leader(null); }
}
