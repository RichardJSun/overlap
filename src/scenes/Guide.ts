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
import { hex, NAMES, type ColorMask } from "../shared/color.ts";
import { budgetFor, droneVisible, onCamera, sources, TILE, type Level } from "../shared/level.ts";
import { lightField } from "../shared/lighting.ts";
import type { Msg, Snapshot, Vec } from "../shared/protocol.ts";
import { fitCamera, HUD_TOP } from "./fit.ts";

const PING_COOLDOWN = 2000;
const FLARE_MS = 2500;
const HUD_BOTTOM = 64;

/** The Guide: sees the city and the drones, owns streetlights and pings, sees the Runner only on camera. */
export class GuideScene extends Phaser.Scene {
  private net!: Transport;
  private data_!: SceneData;
  private hud!: Hud;
  private status: NetStatus = "connecting";
  private peer = false;

  private di = 0;
  private level!: Level;
  private runnerPos: Vec = { x: 0, y: 0 };
  private lantern: ColorMask = 4;
  private lightsOn = new Set<string>();
  private powered = new Set<string>();
  private lastPing = -Infinity;
  private flareUntil = -Infinity;
  private seen = false;
  private lastSeenAt = 0;
  private lastSeenPos: Vec = { x: 0, y: 0 };
  private clockStart: number | null = null;
  private awake = false;
  private tutor!: Tutor;
  private coach = { pinged: false, flared: false };

  private map?: MapView;
  private lightLayer?: LightLayer;
  private runner!: Phaser.GameObjects.Image;
  private lanternRing!: Phaser.GameObjects.Image;
  private ghost!: Phaser.GameObjects.Image;
  private ghostLabel!: Phaser.GameObjects.Text;
  private trail: Phaser.GameObjects.Arc[] = [];
  private drones = new Map<string, { img: Phaser.GameObjects.Image; warn: Phaser.GameObjects.Image; color: number; tile: Vec }>();

  constructor() { super("guide"); }

  init(data: SceneData) { this.data_ = data; this.net = data.transport; }

  create() {
    makeTextures(this);
    addPost(this, "guide");
    this.hud = new Hud(this.game.canvas.parentElement!, "guide", this.data_.room);
    this.events.once("shutdown", () => this.hud.destroy());
    this.tutor = new Tutor(this, this.hud, "guide");
    this.net.onMessage((m) => this.onMsg(m));
    this.net.onStatus((s) => { this.status = s; this.hud.net(s, this.peer); });
    this.net.onPeer((c) => {
      this.peer = c;
      this.hud.net(this.status, c);
      if (c && this.clockStart === null) this.clockStart = this.time.now;
    });
    this.lanternRing = this.add.image(0, 0, "ping").setDepth(19).setScale(0.55).setAlpha(0.9);
    this.runner = this.add.image(0, 0, "runner").setDepth(20);
    this.ghost = this.add.image(0, 0, "runner").setDepth(18).setAlpha(0.28).setTint(0x7d87b2);
    this.ghostLabel = this.add.text(0, 0, "", { fontFamily: "ui-monospace, Menlo, monospace", fontSize: "15px", color: "#a9b1d6", stroke: "#0b1020", strokeThickness: 4 }).setOrigin(0.5, 2.2).setDepth(18).setResolution(2);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.tap(p));
    this.scale.on("resize", () => this.fit());
    this.loadDistrict(0);
  }

  private fit() { if (this.level) fitCamera(this.cameras.main, this.level, this.scale.width, this.scale.height, HUD_TOP, HUD_BOTTOM); }

  private get budget() { return budgetFor(this.level, this.powered.size); }

  private loadDistrict(i: number) {
    this.di = i;
    this.level = LEVELS[i];
    this.map?.destroy();
    this.lightLayer?.destroy();
    this.drones.forEach((d) => { d.img.destroy(); d.warn.destroy(); });
    this.drones.clear();
    this.trail.forEach((t) => t.destroy());
    this.trail = [];
    this.lightsOn.clear();
    this.powered.clear();
    this.lantern = this.level.lantern;
    this.map = new MapView(this, this.level, { glyphs: true }).setDepth(0);
    this.map.base.setAlpha(0.55);
    for (const f of this.level.filters) this.map.base.add(this.add.image(f.x * TILE + TILE / 2, f.y * TILE + TILE / 2, `filter-${f.color}`));
    this.lightLayer = new LightLayer(this, this.level, 0x000000, 0).setDepth(10);
    this.lightLayer.rt.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45);
    for (const d of this.level.drones) {
      const img = this.add.image(0, 0, `drone-${d.color}`).setDepth(15);
      // Pulsing amber ring = "the runner can't see this drone right now".
      const warn = this.add.image(0, 0, "ping").setTint(0xffd38a).setScale(0.62).setDepth(16);
      this.tweens.add({ targets: warn, alpha: { from: 0.95, to: 0.25 }, scale: { from: 0.55, to: 0.75 }, duration: 520, yoyo: true, repeat: -1 });
      this.drones.set(d.id, { img, warn, color: d.color, tile: { ...d.path[0] } });
      this.placeDrone(d.id, d.path[0], false);
    }
    this.moveRunner(this.level.start, false);
    this.lastSeenAt = this.time.now;
    this.lastSeenPos = { ...this.level.start };
    this.fit();
    this.coach = { pinged: false, flared: false };
    this.tutor.setDistrict(i);
    this.hud.district(i, this.level.name, this.level.intro);
    this.hud.hint(`Tap a streetlight to switch it · tap elsewhere to ping · you see the Runner only under a lit streetlight or in a powered block${this.level.drones.length ? " · amber ring: a drone the Runner can't see" : ""}`);
    this.redraw();
  }

  /** The control room sees the runner through its streetlight cameras, powered blocks, or a flare. */
  private get onCam() { return this.time.now < this.flareUntil || onCamera(this.level, this.runnerPos, this.lightsOn, this.powered); }

  private redraw() {
    const seen = this.onCam;
    if (this.seen && !seen) this.lastSeenAt = this.time.now;
    if (seen) this.lastSeenPos = { ...this.runnerPos };
    this.seen = seen;
    this.runner.setVisible(seen);
    this.lanternRing.setVisible(seen).setTint(hex(this.lantern));
    // The ghost stays where the cameras last saw the runner; it must not follow the hidden sprite.
    const gx = this.lastSeenPos.x * TILE + TILE / 2, gy = this.lastSeenPos.y * TILE + TILE / 2;
    this.ghost.setVisible(!seen).setPosition(gx, gy);
    this.ghostLabel.setVisible(!seen).setPosition(gx, gy);
    // The lantern's own pool would give the runner away, so it shows only while they're on camera.
    const lit = sources(this.level, this.runnerPos, this.lightsOn, this.lantern);
    const glow = this.level.substations.filter((s) => this.powered.has(s.id)).map((s) => s.block);
    this.lightLayer!.draw(seen ? lit : lit.slice(1), glow);
    const field = lightField(this.level, lit);
    for (const d of this.drones.values()) d.warn.setVisible(seen && !droneVisible(field[d.tile.y * this.level.w + d.tile.x], d.color));
    this.hud.budget(this.lightsOn.size, this.budget);
    const left = this.level.substations.length - this.powered.size;
    this.hud.objective(`${left ? `Get the Runner to the substation ⚡ · ${this.powered.size}/${this.level.substations.length}` : "Guide the Runner to the exit"} · lantern ${NAMES[this.lantern]}`, !left);
  }

  private tap(p: Phaser.Input.Pointer) {
    sfx.unlock();
    if (!this.data_.local && !this.awake) { this.awake = true; sfx.ambient((this.di + this.powered.size / this.level.substations.length) / LEVELS.length); }
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const fx = w.x / TILE, fy = w.y / TILE;
    if (fx < 0 || fy < 0 || fx >= this.level.w || fy >= this.level.h) return;
    // Streetlights are small on a phone, so a touch snaps to one within a tile and a half.
    const reach = p.wasTouch ? 1.5 : 0.9;
    const lamp = this.level.lights
      .map((l) => ({ l, d: Math.hypot(l.x + 0.5 - fx, l.y + 0.5 - fy) }))
      .filter((c) => c.d < reach)
      .sort((a, b) => a.d - b.d)[0]?.l;
    if (lamp) return this.toggle(lamp.id);
    const tile = { x: Math.floor(fx), y: Math.floor(fy) };
    if (this.time.now - this.lastPing < PING_COOLDOWN) { this.hud.toast("Ping recharging…", 900); return; }
    this.lastPing = this.time.now;
    this.coach.pinged = true;
    this.hud.ping(PING_COOLDOWN);
    this.net.send({ t: "ping", id: Math.random().toString(36).slice(2, 8), p: tile });
    if (!this.data_.local) sfx.ping();
    this.showPing(tile);
  }

  private toggle(id: string) {
    const on = !this.lightsOn.has(id);
    if (on && this.lightsOn.size >= this.budget) {
      sfx.denied();
      this.hud.budget(this.lightsOn.size, this.budget, true);
      this.hud.toast(`Power budget is ${this.budget}. Switch another streetlight off first.`);
      return;
    }
    if (on) this.lightsOn.add(id); else this.lightsOn.delete(id);
    this.map!.setLamp(id, on);
    this.net.send({ t: "light", id, on });
    if (!this.data_.local) { if (on) sfx.lightOn(); else sfx.lightOff(); }
    this.redraw();
  }

  private showPing(p: Vec, tint = 0xffffff) {
    const ring = this.add.image(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, "ping").setDepth(30).setScale(0.3).setTint(tint);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 700, repeat: 2, onComplete: () => ring.destroy() });
  }

  private moveRunner(p: Vec, animate = true) {
    const jumped = Math.abs(p.x - this.runnerPos.x) + Math.abs(p.y - this.runnerPos.y) > 1;
    if (animate && jumped) this.hud.toast("The Runner was caught and sent back to the checkpoint.");
    if (animate && this.seen && !jumped) {
      const dot = this.add.circle(this.runner.x, this.runner.y, 4, 0xe8ecff, 0.6).setDepth(19);
      this.trail.push(dot);
      this.tweens.add({ targets: dot, alpha: 0, scale: 0.3, duration: 2500, onComplete: () => { dot.destroy(); this.trail = this.trail.filter((t) => t !== dot); } });
    }
    this.runnerPos = { ...p };
    const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE / 2;
    this.tweens.killTweensOf([this.runner, this.lanternRing]);
    if (animate && !jumped) this.tweens.add({ targets: [this.runner, this.lanternRing], x, y, duration: 120 });
    else { this.runner.setPosition(x, y); this.lanternRing.setPosition(x, y); }
  }

  private placeDrone(id: string, p: Vec, animate = true) {
    const d = this.drones.get(id);
    if (!d) return;
    d.tile = { ...p };
    const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE / 2;
    if (animate) this.tweens.add({ targets: [d.img, d.warn], x, y, duration: 200 });
    else { d.img.setPosition(x, y); d.warn.setPosition(x, y); }
  }

  private applySnapshot(s: Snapshot) {
    if (s.district !== this.di || !this.level) this.loadDistrict(s.district);
    this.lightsOn = new Set(s.lightsOn);
    this.level.lights.forEach((l) => this.map!.setLamp(l.id, this.lightsOn.has(l.id)));
    this.powered = new Set(s.substationsPowered);
    this.level.substations.forEach((sub) => this.map!.setPowered(sub.id, this.powered.has(sub.id)));
    this.map!.setExitOpen(this.powered.size === this.level.substations.length);
    s.drones.forEach((d) => this.placeDrone(d.id, d.p, false));
    this.lantern = s.lantern ?? this.level.lantern;
    this.moveRunner(s.runner, false);
    this.redraw();
  }

  private onMsg(m: Msg) {
    switch (m.t) {
      case "snapshot": return this.applySnapshot(m.s);
      case "runner_move": this.moveRunner(m.p); return this.redraw();
      case "drones": m.d.forEach((d) => this.placeDrone(d.id, d.p)); return this.redraw();
      case "lantern":
        this.lantern = m.c;
        return this.redraw();
      case "flare":
        this.moveRunner(m.p, false);
        this.flareUntil = this.time.now + FLARE_MS;
        this.coach.flared = true;
        this.showPing(m.p, 0xffd38a);
        this.hud.toast("Flare! The Runner is here.", 1600);
        if (!this.data_.local) sfx.ping();
        return this.redraw();
      case "substation":
        this.powered.add(m.id);
        this.map!.setPowered(m.id);
        if (this.powered.size === this.level.substations.length) { this.map!.setExitOpen(true); this.hud.toast("All blocks powered. Guide them to the exit."); }
        else this.hud.toast(`Block restored. Power budget is now ${this.budget}.`);
        if (!this.data_.local) sfx.substation();
        if (!this.data_.local && this.awake) sfx.ambient((this.di + this.powered.size / this.level.substations.length) / LEVELS.length);
        return this.redraw();
      case "district":
        this.hud.card(`District ${this.di + 1} restored`, `Next: ${LEVELS[m.index].name}`);
        this.loadDistrict(m.index);
        this.cameras.main.fadeIn(500, 11, 16, 32);
        return;
      case "ending":
        this.scene.start("ending", { ...this.data_, role: "guide", district: this.di, stats: m.ms === undefined ? undefined : { ms: m.ms, caught: m.caught ?? 0 } });
        return;
    }
  }

  update(time: number) {
    if (this.clockStart === null && this.data_.local) this.clockStart = time;
    const s = this.clockStart === null ? -1 : Math.floor((time - this.clockStart) / 1000);
    this.hud.clock(s < 0 ? "--:--" : `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
    this.input.setDefaultCursor(time - this.lastPing >= PING_COOLDOWN ? "crosshair" : "wait");
    if (!this.level) return;
    // A flare runs out, or the guide just switched the camera that was watching the runner.
    if (this.onCam !== this.seen) this.redraw();
    const warned = [...this.drones.values()].find((d) => d.warn.visible);
    // The coach only knows what the guide knows: where the runner was last seen.
    this.tutor.update({
      level: this.level, runner: this.lastSeenPos, moved: 0, ...this.coach, lampsOn: this.lightsOn.size, powered: this.powered.size,
      seen: this.seen, bridgeOpen: false, filterInView: null, unseenDrone: warned ? warned.tile : null, visible: () => true,
    });
    if (!this.seen) this.ghostLabel.setText(`last seen ${Math.round((time - this.lastSeenAt) / 1000)}s ago`);
  }
}
