import Phaser from "phaser";
import { sfx } from "../audio/sfx.ts";
import type { SceneData } from "../game.ts";
import { Hud } from "../hud.ts";
import { Tutor } from "../tutorial.ts";
import { LEVELS } from "../levels/index.ts";
import type { NetStatus, Transport } from "../net/transport.ts";
import { LightLayer } from "../render/lights.ts";
import { MapView } from "../render/map.ts";
import { addPost } from "../render/post.ts";
import { makeTextures } from "../render/textures.ts";
import { NAMES, reveals, type ColorMask } from "../shared/color.ts";
import { dronePos, droneVisible, lanternRadius, passable, sources, TILE, type Level } from "../shared/level.ts";
import { lightField } from "../shared/lighting.ts";
import type { Msg, Vec } from "../shared/protocol.ts";
import { bands, fitCamera } from "./fit.ts";

const STEP_MS = 120;
const FLARE_COOLDOWN = 4000;
const DIRS: Record<string, Vec> = {
  ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
};

export type RunStats = { ms: number; caught: number };

/** The Runner: authoritative for its own position, lantern, drones, substations, and the district index. */
export class RunnerScene extends Phaser.Scene {
  private net!: Transport;
  private data_!: SceneData;
  private hud!: Hud;
  private status: NetStatus = "connecting";
  private peer = false;

  private di = 0;
  private level!: Level;
  private pos: Vec = { x: 0, y: 0 };
  private lantern: ColorMask = 4;
  private checkpoint = { pos: { x: 0, y: 0 }, lantern: 4 as ColorMask };
  private lightsOn = new Set<string>();
  private powered = new Set<string>();
  private field!: Uint8Array;
  private moving = false;
  private held: Vec[] = [];
  private queued: Vec[] = []; // a tap shorter than one frame still moves one tile
  private target: Vec | null = null;
  private t0 = 0;
  private runStart = -1; // set on the first frame: a scene's clock reads stale inside create()
  private caught = 0;
  private invulnUntil = 0;
  private lastFlare = -Infinity;
  private transitioning = false;
  private awake = false;
  private tutor!: Tutor;
  private coach = { moved: 0, flared: false, pinged: false, bridgeOpen: false };

  private map?: MapView;
  private lightLayer?: LightLayer;
  private runner!: Phaser.GameObjects.Image;
  private filterImgs: Phaser.GameObjects.Image[] = [];
  /** Warm light around the exit once it opens, so "the exit is lit" is something you can see. */
  private exitGlow = { x: 0, y: 0, w: 3, h: 3 };
  private drones: { def: Level["drones"][number]; img: Phaser.GameObjects.Image; tile: Vec }[] = [];
  private dronesDirty = false;
  private lastDroneSend = 0;

  constructor() { super("runner"); }

  init(data: SceneData) {
    this.data_ = data;
    this.net = data.transport;
    this.di = 0;
    this.held = [];
    this.queued = [];
    this.target = null;
    this.caught = 0;
  }

  create() {
    makeTextures(this);
    addPost(this, "runner");
    this.hud = new Hud(this.game.canvas.parentElement!, "runner", this.data_.room, this.data_.local);
    this.events.once("shutdown", () => this.hud.destroy());
    this.tutor = new Tutor(this, this.hud, "runner");
    const kb = this.input.keyboard!;
    kb.on("keydown", (e: KeyboardEvent) => {
      this.wake();
      if (e.code === "Space") { e.preventDefault(); if (!e.repeat) this.flare(); return; }
      const d = DIRS[e.code];
      if (!d) return;
      e.preventDefault();
      this.target = null;
      if (e.repeat) return;
      if (this.queued.length < 3) this.queued.push(d);
      if (!this.held.includes(d)) this.held.push(d);
    });
    kb.on("keyup", (e: KeyboardEvent) => { const d = DIRS[e.code]; if (d) this.held = this.held.filter((h) => h !== d); });
    this.game.events.on(Phaser.Core.Events.BLUR, () => (this.held = []));
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.wake();
      const w = this.cameras.main.getWorldPoint(p.x, p.y);
      const t = { x: Math.floor(w.x / TILE), y: Math.floor(w.y / TILE) };
      if (t.x === this.pos.x && t.y === this.pos.y) return this.flare(); // tap yourself to flare
      if (t.x >= 0 && t.y >= 0 && t.x < this.level.w && t.y < this.level.h) this.target = t;
    });

    this.runner = this.add.image(0, 0, "runner").setDepth(20);
    this.scale.on("resize", () => this.fit());
    // ?district=N starts at district N (for testing and for showing one puzzle).
    const d = Number(new URLSearchParams(location.search).get("district")) - 1;
    this.loadDistrict(d >= 0 && d < LEVELS.length ? d : 0);
    // Listen only once a level is loaded: a peer that is already connected triggers a snapshot at once.
    this.net.onMessage((m) => this.onMsg(m));
    this.net.onStatus((s) => { this.status = s; this.hud.net(s, this.peer); });
    this.net.onPeer((c) => {
      this.peer = c;
      this.hud.net(this.status, c);
      if (c) this.sendSnapshot();
    });
  }

  private fit() { if (this.level) fitCamera(this.cameras.main, this.level, this.scale.width, this.scale.height, ...bands(this.level, this.scale.width, this.scale.height, 8)); }

  /** First gesture unlocks audio (iOS rule); the ambient pad can only start after that. */
  private wake() {
    sfx.unlock();
    if (this.awake) return;
    this.awake = true;
    sfx.ambient(this.progress);
  }

  private loadDistrict(i: number) {
    this.di = i;
    this.level = LEVELS[i];
    this.map?.destroy();
    this.lightLayer?.destroy();
    this.drones.forEach((d) => d.img.destroy());
    this.filterImgs.forEach((f) => f.destroy());
    this.lightsOn.clear();
    this.powered.clear();
    this.map = new MapView(this, this.level, { glyphs: true }).setDepth(0);
    // Pitch black outside every light: the Runner sees nothing the light doesn't reach.
    this.lightLayer = new LightLayer(this, this.level, 0x000000);
    this.lightLayer.setDepth(10);
    this.filterImgs = this.level.filters.map((f) => this.add.image(f.x * TILE + TILE / 2, f.y * TILE + TILE / 2, `filter-${f.color}`).setDepth(2));
    this.drones = this.level.drones.map((def) => ({ def, img: this.add.image(0, 0, `drone-${def.color}`).setDepth(15).setVisible(false), tile: { ...def.path[0] } }));
    this.pos = { ...this.level.start };
    this.exitGlow = { x: this.level.exit.x - 1, y: this.level.exit.y - 1, w: 3, h: 3 };
    this.lantern = this.level.lantern;
    this.checkpoint = { pos: { ...this.pos }, lantern: this.lantern };
    this.runner.setPosition(this.pos.x * TILE + TILE / 2, this.pos.y * TILE + TILE / 2);
    this.t0 = this.time.now;
    this.moving = false;
    this.refreshField();
    this.fit();
    this.hud.district(i, this.level.name, this.level.intro, this.level.introLabel);
    this.updateObjective();
    if (this.level.intro) sfx.radio();
    this.coach = { moved: 0, flared: false, pinged: false, bridgeOpen: false };
    this.tutor.setDistrict(i);
    if (this.awake) sfx.ambient(this.progress);
  }

  private refreshField() {
    this.field = lightField(this.level, sources(this.level, this.pos, this.lightsOn, this.lantern, this.reach));
    for (const g of this.map!.gates) g.img.setVisible(reveals(this.field[g.y * this.level.w + g.x], g.color));
  }

  private updateObjective() {
    const left = this.level.substations.length - this.powered.size;
    this.hud.objective(`${left ? `Power the substations ⚡ ${this.powered.size}/${this.level.substations.length}` : "Reach the exit"}`, !left);
  }

  /** How much of the whole city is back on, 0..1, for the ambient pad. */
  private get progress() { return (this.di + this.powered.size / this.level.substations.length) / LEVELS.length; }

  /** How far the lantern reaches right now, in tiles. */
  private get reach() { return lanternRadius(this.powered.size); }

  private get exitOpen() { return this.powered.size === this.level.substations.length; }

  private canEnter(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.level.w || y >= this.level.h) return false;
    return passable(this.level, x, y, this.field[y * this.level.w + x], this.exitOpen);
  }

  /** Why the runner can't step onto (x, y), in words, or null when there's nothing to say. */
  private blockedReason(x: number, y: number): string | null {
    const c = this.level.at(x, y), g = this.level.gateAt(x, y);
    if (c === "E") return "The exit is dark. Power every substation first.";
    if (g?.kind === "bridge") return `A bridge is here, but it only exists in ${NAMES[g.color]} light.`;
    if (g?.kind === "door") return `A door of ${NAMES[g.color]} light blocks the way.`;
    if (c === "~") return "The canal is too deep to cross here.";
    return null;
  }

  private tryMove(d: Vec) {
    const nx = this.pos.x + d.x, ny = this.pos.y + d.y;
    if (!this.canEnter(nx, ny)) {
      this.target = null;
      const why = this.blockedReason(nx, ny);
      if (why) this.hud.toast(why);
      this.moving = true;
      this.tweens.add({ targets: this.runner, x: this.runner.x + d.x * 4, y: this.runner.y + d.y * 4, duration: 60, yoyo: true, onComplete: () => (this.moving = false) });
      return;
    }
    this.moving = true;
    this.coach.moved++;
    this.pos = { x: nx, y: ny };
    this.refreshField();
    this.net.send({ t: "runner_move", p: this.pos });
    sfx.step();
    this.tweens.add({
      targets: this.runner, x: nx * TILE + TILE / 2, y: ny * TILE + TILE / 2, duration: STEP_MS, ease: "Sine.easeInOut",
      onComplete: () => { this.moving = false; this.arrived(); },
    });
  }

  private setLantern(c: ColorMask) {
    if (c === this.lantern) return;
    this.lantern = c;
    this.refreshField();
    this.net.send({ t: "lantern", c });
  }

  private arrived() {
    const f = this.level.filterAt(this.pos.x, this.pos.y);
    if (f && f.color !== this.lantern) {
      this.setLantern(f.color);
      sfx.lightOn();
      this.cameras.main.flash(220, ...rgb(f.color));
      this.hud.toast(`Your lantern is ${NAMES[f.color]} now.`);
    }
    const s = this.level.substations.find((s) => s.x === this.pos.x && s.y === this.pos.y);
    if (s && !this.powered.has(s.id)) {
      this.powered.add(s.id);
      this.refreshField(); // the lantern reaches farther now
      this.checkpoint = { pos: { ...this.pos }, lantern: this.lantern };
      this.map!.setPowered(s.id);
      this.net.send({ t: "substation", id: s.id });
      sfx.substation();
      sfx.ambient(this.progress);
      this.cameras.main.flash(220, 255, 211, 138); // a pulse, not a blackout-white frame
      if (this.exitOpen) {
        this.map!.setExitOpen(true);
        this.time.delayedCall(900, () => sfx.exitOpen());
        this.hud.toast("Block restored. The exit is open.");
      } else this.hud.toast("Block restored. Your lantern reaches farther, and your Guide has more power.");
      this.updateObjective();
    }
    if (this.pos.x === this.level.exit.x && this.pos.y === this.level.exit.y && this.exitOpen) this.nextDistrict();
  }

  private nextDistrict() {
    if (this.transitioning) return;
    this.transitioning = true;
    const next = this.di + 1;
    this.hud.card("Power restored", this.level.restored ?? this.level.name);
    this.time.delayedCall(1100, () => this.cameras.main.fadeOut(450, 11, 16, 32));
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.transitioning = false;
      if (next >= LEVELS.length) {
        const stats: RunStats = { ms: Math.round(this.time.now - this.runStart), caught: this.caught };
        this.net.send({ t: "ending", ...stats });
        this.scene.start("ending", { ...this.data_, role: "runner", district: this.di, stats });
        return;
      }
      this.net.send({ t: "district", index: next });
      this.loadDistrict(next);
      this.sendSnapshot();
      this.cameras.main.fadeIn(450, 11, 16, 32);
    });
  }

  private respawn(reason: string) {
    this.tweens.killTweensOf(this.runner);
    this.moving = false;
    this.target = null;
    this.caught++;
    this.pos = { ...this.checkpoint.pos };
    this.setLantern(this.checkpoint.lantern);
    this.runner.setPosition(this.pos.x * TILE + TILE / 2, this.pos.y * TILE + TILE / 2);
    this.refreshField();
    this.net.send({ t: "runner_move", p: this.pos });
    this.invulnUntil = this.time.now + 1200;
    sfx.respawn();
    this.cameras.main.flash(250, 255, 77, 94);
    this.cameras.main.shake(180, 0.006);
    this.hud.toast(reason);
  }

  /** Flash the lantern so the Guide's cameras catch the Runner for a moment, wherever they are. */
  private flare() {
    if (this.transitioning) return;
    if (this.time.now - this.lastFlare < FLARE_COOLDOWN) { this.hud.toast("Flare recharging…", 900); return; }
    this.lastFlare = this.time.now;
    this.coach.flared = true;
    this.net.send({ t: "flare", p: this.pos });
    sfx.ping();
    const ring = this.add.image(this.runner.x, this.runner.y, "ping").setDepth(30).setScale(0.3).setTint(0xffd38a).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 700, ease: "Quad.easeOut", onComplete: () => ring.destroy() });
  }

  private sendSnapshot() {
    this.net.send({
      t: "snapshot",
      s: { district: this.di, runner: this.pos, lightsOn: [...this.lightsOn], substationsPowered: [...this.powered], drones: this.drones.map((d) => ({ id: d.def.id, p: d.tile })), lantern: this.lantern },
    });
  }

  private onMsg(m: Msg) {
    if (m.t === "light") {
      if (!this.level.lights.some((l) => l.id === m.id)) return;
      if (m.on) this.lightsOn.add(m.id); else this.lightsOn.delete(m.id);
      this.map!.setLamp(m.id, m.on);
      this.refreshField();
      if (m.on) sfx.lightOn(); else sfx.lightOff();
      // Standing on a bridge or door that just lost its light.
      if (!this.canEnter(this.pos.x, this.pos.y)) this.respawn(this.level.at(this.pos.x, this.pos.y) === "~" ? "The bridge vanished under you." : "The door closed on you.");
    } else if (m.t === "ping") {
      if (m.danger) { this.showDanger(m.p); sfx.denied(); return; }
      this.showPing(m.p);
      this.coach.pinged = true;
      sfx.ping();
    }
  }

  private showPing(p: Vec) {
    const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE / 2;
    const ring = this.add.image(x, y, "ping").setDepth(30).setScale(0.3).setTint(0xffffff);
    const dot = this.add.image(x, y, "ping").setDepth(30).setScale(0.45).setAlpha(0.9);
    this.tweens.add({ targets: ring, scale: 1.1, alpha: 0, duration: 750, repeat: 3 });
    this.tweens.add({ targets: dot, scale: 0.35, yoyo: true, repeat: 5, duration: 250 });
    this.time.delayedCall(3000, () => { ring.destroy(); dot.destroy(); });
  }

  /** The guide's warning: something dangerous here, don't walk in. */
  private showDanger(p: Vec) {
    const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE / 2;
    const ring = this.add.image(x, y, "ping").setDepth(30).setScale(0.5).setTint(0xff4d5e);
    const mark = this.add.text(x, y, "!", { fontFamily: "ui-monospace, Menlo, monospace", fontSize: "26px", fontStyle: "bold", color: "#ff4d5e", stroke: "#0b1020", strokeThickness: 5 }).setOrigin(0.5).setDepth(31);
    this.tweens.add({ targets: ring, scale: 0.8, alpha: 0.4, duration: 260, yoyo: true, repeat: 5 });
    this.time.delayedCall(3000, () => { ring.destroy(); mark.destroy(); });
    this.hud.toast("Danger! Your Guide warns you off that spot.", 1800);
  }

  /** Next step toward a tapped tile: BFS over what the runner can currently walk on. */
  private stepToward(t: Vec): Vec | null {
    const { w, h } = this.level;
    const start = this.pos.y * w + this.pos.x, goal = t.y * w + t.x;
    if (start === goal) return null;
    const prev = new Int32Array(w * h).fill(-1);
    prev[start] = start;
    const q = [start];
    while (q.length) {
      const c = q.shift()!;
      if (c === goal) break;
      const cx = c % w, cy = (c - cx) / w;
      for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
        const nx = cx + d.x, ny = cy + d.y, n = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || prev[n] !== -1 || !this.canEnter(nx, ny)) continue;
        prev[n] = c;
        q.push(n);
      }
    }
    if (prev[goal] === -1) return null;
    let c = goal;
    while (prev[c] !== start) c = prev[c];
    return { x: (c % w) - this.pos.x, y: Math.floor(c / w) - this.pos.y };
  }

  update(time: number) {
    if (this.runStart < 0) this.runStart = time;
    if (!this.level || this.transitioning) return;
    const t = (time - this.t0) / 1000;
    const rx = this.runner.x / TILE - 0.5, ry = this.runner.y / TILE - 0.5;
    let nearest = Infinity;
    for (const d of this.drones) {
      const p = dronePos(d.def, t);
      d.img.setPosition(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2).setRotation(time / 300);
      const tile = { x: Math.round(p.x), y: Math.round(p.y) };
      if (tile.x !== d.tile.x || tile.y !== d.tile.y) { d.tile = tile; this.dronesDirty = true; }
      const visible = droneVisible(this.field[tile.y * this.level.w + tile.x], d.def.color);
      d.img.setVisible(visible);
      const dist = Math.hypot(p.x - rx, p.y - ry);
      if (visible) nearest = Math.min(nearest, dist);
      if (dist < 0.5 && time > this.invulnUntil) { this.respawn("A security drone caught you."); return; }
    }
    sfx.drone(nearest === Infinity ? 0 : Math.max(0, 1 - nearest / 6));
    if (this.dronesDirty && time - this.lastDroneSend >= 200) {
      this.dronesDirty = false;
      this.lastDroneSend = time;
      this.net.send({ t: "drones", d: this.drones.map((d) => ({ id: d.def.id, p: d.tile })) });
    }
    // Filters show only where light reaches, like everything else in the dark.
    this.level.filters.forEach((f, i) => this.filterImgs[i].setVisible(this.field[f.y * this.level.w + f.x] !== 0));

    if (!this.moving) {
      const d = this.queued.shift() ?? this.held.at(-1) ?? (this.target ? this.stepToward(this.target) : null);
      if (d) this.tryMove(d); else this.target = null;
    }

    const at = (p: Vec) => this.field[p.y * this.level.w + p.x];
    this.coach.bridgeOpen ||= this.level.gates.some((g) => g.kind === "bridge" && reveals(at(g), g.color));
    this.tutor.update({
      level: this.level, runner: this.pos, ...this.coach, lampsOn: this.lightsOn.size, powered: this.powered.size, seen: true,
      filterInView: this.level.filters.find((f) => at(f) && f.color !== this.lantern) ?? null,
      unseenDrone: null,
      visible: (p) => at(p) !== 0,
    });

    const glow = this.level.substations.filter((s) => this.powered.has(s.id)).map((s) => s.block);
    if (this.exitOpen) glow.push(this.exitGlow);
    // A flare throws the light wider for a moment. It's only for show: gates and drones follow the real reach.
    const surge = Math.max(0, 1 - (time - this.lastFlare) / 1100);
    const lit = sources(this.level, { x: rx, y: ry }, this.lightsOn, this.lantern, this.reach * (1 + surge * Math.sin(Math.min(1, (time - this.lastFlare) / 250) * Math.PI / 2)));
    this.lightLayer!.draw(lit, glow);
  }
}

const rgb = (c: ColorMask): [number, number, number] => [c & 4 ? 255 : 77, c & 2 ? 255 : 77, c & 1 ? 255 : 94];
