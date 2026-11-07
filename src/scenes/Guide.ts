import Phaser from "phaser";
import { sfx } from "../audio/sfx.ts";
import type { SceneData } from "../game.ts";
import { Hud } from "../hud.ts";
import { LEVELS } from "../levels/index.ts";
import type { NetStatus, Transport } from "../net/transport.ts";
import { LightLayer } from "../render/lights.ts";
import { MapView } from "../render/map.ts";
import { addPost } from "../render/post.ts";
import { makeTextures } from "../render/textures.ts";
import { budgetFor, droneVisible, sources, TILE, type Level } from "../shared/level.ts";
import { lightField } from "../shared/lighting.ts";
import type { Msg, Snapshot, Vec } from "../shared/protocol.ts";
import { fitCamera, HUD_TOP } from "./fit.ts";

const PING_COOLDOWN = 2000;
const HUD_BOTTOM = 64;

/** The Guide: sees everything, owns streetlights and pings. */
export class GuideScene extends Phaser.Scene {
  private net!: Transport;
  private data_!: SceneData;
  private hud!: Hud;
  private status: NetStatus = "connecting";
  private peer = false;

  private di = 0;
  private level!: Level;
  private runnerPos: Vec = { x: 0, y: 0 };
  private lightsOn = new Set<string>();
  private powered = new Set<string>();
  private lastPing = -Infinity;

  private map?: MapView;
  private lightLayer?: LightLayer;
  private runner!: Phaser.GameObjects.Image;
  private trail: Phaser.GameObjects.Arc[] = [];
  private drones = new Map<string, { img: Phaser.GameObjects.Image; warn: Phaser.GameObjects.Text; color: number; tile: Vec }>();

  constructor() { super("guide"); }

  init(data: SceneData) { this.data_ = data; this.net = data.transport; }

  create() {
    makeTextures(this);
    addPost(this, "guide");
    this.hud = new Hud(this.game.canvas.parentElement!, "guide", this.data_.room);
    this.events.once("shutdown", () => this.hud.destroy());
    this.net.onMessage((m) => this.onMsg(m));
    this.net.onStatus((s) => { this.status = s; this.hud.net(s, this.peer); });
    this.net.onPeer((c) => { this.peer = c; this.hud.net(this.status, c); });
    this.runner = this.add.image(0, 0, "runner").setDepth(20);
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
    this.map = new MapView(this, this.level, { glyphs: true }).setDepth(0);
    this.map.base.setAlpha(0.55);
    this.lightLayer = new LightLayer(this, this.level, 0x000000, 0).setDepth(10);
    this.lightLayer.rt.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45);
    for (const d of this.level.drones) {
      const img = this.add.image(0, 0, `drone-${d.color}`).setDepth(15);
      const warn = this.add.text(0, 0, "unseen", { fontFamily: "monospace", fontSize: "9px", color: "#ffd38a" }).setOrigin(0.5, 1.6).setDepth(16);
      this.drones.set(d.id, { img, warn, color: d.color, tile: { ...d.path[0] } });
      this.placeDrone(d.id, d.path[0], false);
    }
    this.moveRunner(this.level.start, false);
    this.fit();
    this.hud.district(i, this.level.name, this.level.intro);
    this.hud.hint("Tap a streetlight to switch it · tap anywhere else to ping");
    this.redraw();
  }

  private redraw() {
    const field = lightField(this.level, sources(this.level, this.runnerPos, this.lightsOn));
    const glow = this.level.substations.filter((s) => this.powered.has(s.id)).map((s) => s.block);
    this.lightLayer!.draw(sources(this.level, this.runnerPos, this.lightsOn), glow);
    // Tell the guide which drones the runner can't see right now.
    for (const d of this.drones.values()) {
      const seen = droneVisible(field[d.tile.y * this.level.w + d.tile.x], d.color);
      d.warn.setVisible(!seen);
    }
    this.hud.budget(this.lightsOn.size, this.budget);
  }

  private tap(p: Phaser.Input.Pointer) {
    sfx.unlock();
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const fx = w.x / TILE, fy = w.y / TILE;
    if (fx < 0 || fy < 0 || fx >= this.level.w || fy >= this.level.h) return;
    // Generous hit area for lamps so they're easy to hit on a phone.
    const lamp = this.level.lights
      .map((l) => ({ l, d: Math.hypot(l.x + 0.5 - fx, l.y + 0.5 - fy) }))
      .filter((c) => c.d < 0.9)
      .sort((a, b) => a.d - b.d)[0]?.l;
    if (lamp) return this.toggle(lamp.id);
    const tile = { x: Math.floor(fx), y: Math.floor(fy) };
    if (this.time.now - this.lastPing < PING_COOLDOWN) { this.hud.toast("Ping recharging…", 900); return; }
    this.lastPing = this.time.now;
    this.net.send({ t: "ping", id: Math.random().toString(36).slice(2, 8), p: tile });
    if (!this.data_.local) sfx.ping();
    this.showPing(tile);
  }

  private toggle(id: string) {
    const on = !this.lightsOn.has(id);
    if (on && this.lightsOn.size >= this.budget) {
      sfx.denied();
      this.hud.budget(this.lightsOn.size, this.budget, true);
      this.hud.toast(`Power budget is ${this.budget}. Switch another light off first.`);
      return;
    }
    if (on) this.lightsOn.add(id); else this.lightsOn.delete(id);
    this.map!.setLamp(id, on);
    this.net.send({ t: "light", id, on });
    if (!this.data_.local) { if (on) sfx.lightOn(); else sfx.lightOff(); }
    this.redraw();
  }

  private showPing(p: Vec) {
    const ring = this.add.image(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, "ping").setDepth(30).setScale(0.3);
    this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 700, repeat: 2, onComplete: () => ring.destroy() });
  }

  private moveRunner(p: Vec, animate = true) {
    if (animate) {
      const dot = this.add.circle(this.runner.x, this.runner.y, 4, 0xe8ecff, 0.6).setDepth(19);
      this.trail.push(dot);
      this.tweens.add({ targets: dot, alpha: 0, scale: 0.3, duration: 2500, onComplete: () => { dot.destroy(); this.trail = this.trail.filter((t) => t !== dot); } });
    }
    this.runnerPos = { ...p };
    const x = p.x * TILE + TILE / 2, y = p.y * TILE + TILE / 2;
    this.tweens.killTweensOf(this.runner);
    if (animate) this.tweens.add({ targets: this.runner, x, y, duration: 120 });
    else this.runner.setPosition(x, y);
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
    this.moveRunner(s.runner, false);
    this.redraw();
  }

  private onMsg(m: Msg) {
    switch (m.t) {
      case "snapshot": return this.applySnapshot(m.s);
      case "runner_move": this.moveRunner(m.p); return this.redraw();
      case "drones": m.d.forEach((d) => this.placeDrone(d.id, d.p)); return this.redraw();
      case "substation":
        this.powered.add(m.id);
        this.map!.setPowered(m.id);
        if (this.powered.size === this.level.substations.length) { this.map!.setExitOpen(true); this.hud.toast("All blocks powered. Guide them to the exit."); }
        else this.hud.toast(`Block restored. Power budget is now ${this.budget}.`);
        if (!this.data_.local) sfx.substation();
        return this.redraw();
      case "district":
        this.loadDistrict(m.index);
        this.cameras.main.fadeIn(500, 11, 16, 32);
        return;
      case "ending": this.scene.start("ending", { ...this.data_, role: "guide", district: this.di }); return;
    }
  }

  update(time: number) {
    const s = Math.floor(time / 1000);
    this.hud.clock(`${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`);
    const ready = time - this.lastPing >= PING_COOLDOWN;
    this.input.setDefaultCursor(ready ? "crosshair" : "wait");
  }
}
