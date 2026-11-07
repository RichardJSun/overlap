import Phaser from "phaser";
import { TILE, type Level } from "../shared/level.ts";
import type { LightSource } from "../shared/lighting.ts";
import { windowsIn } from "./map.ts";
import { castRays } from "./visibility.ts";
import { lightTint, PAL } from "./textures.ts";

type Block = { x: number; y: number; w: number; h: number };
type Pool = { tex: Phaser.Textures.DynamicTexture; key: string };

const ADD = Phaser.BlendModes.ADD;
const FLICKER = [[50, 0.9], [110, 0.12], [170, 1], [230, 0.3], [300, 1]]; // [until ms, intensity]
const GLOW_FADE = 1400;
let uid = 0;
const modes = new WeakMap<object, number>();

/**
 * Blend mode for the lightmap: dst * src * 2, so 0.5 leaves the art as drawn and a full light doubles it.
 * Plain multiply could only darken, which forced the art to be pale everywhere else it is shown.
 */
function modulate2x(r: Phaser.Renderer.Canvas.CanvasRenderer | Phaser.Renderer.WebGL.WebGLRenderer) {
  if (!(r instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return Phaser.BlendModes.MULTIPLY;
  let m = modes.get(r);
  if (m === undefined) {
    r.addBlendMode([r.gl.DST_COLOR, r.gl.SRC_COLOR], r.gl.FUNC_ADD);
    modes.set(r, (m = r.blendModes.length - 1)); // addBlendMode's own return value is off by one in 4.2.1
  }
  return m;
}

/**
 * Lightmap: a render texture filled with near-black ambient, then each light added in its color.
 * A light is a smooth radial falloff clipped to its visibility polygon (rendered once into its own
 * texture and cached for streetlights). Overlaps add, so red + blue = magenta. The map is multiplied
 * by it; `bloom` adds the same texture on top so the colored pools glow instead of only darkening.
 */
export class LightLayer {
  readonly rt: Phaser.GameObjects.RenderTexture;
  readonly bloom: Phaser.GameObjects.Image;
  private glowG: Phaser.GameObjects.Graphics; // drawn into rt at render(), so never shared with polyG
  private polyG: Phaser.GameObjects.Graphics;
  private pools = new Map<string, Pool>();
  private moving: Pool[] = [];
  private born = new Map<string, number>(); // source key -> first frame it was drawn, for the flicker
  private last?: { sources: LightSource[]; glow: Block[]; ambient: number };
  private sig = "";
  private frame = -1;
  private settle = false; // one more full-intensity pass after an animation ends, even if frames were skipped
  private tick = () => { if (this.last && (this.animating() || this.settle) && this.frame !== this.scene.game.loop.frame) this.draw(this.last.sources, this.last.glow, this.last.ambient); };

  constructor(private scene: Phaser.Scene, private level: Level, private ambient = 0x07080e, bloomAlpha = 0.12) {
    const w = level.w * TILE, h = level.h * TILE;
    this.rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0).setBlendMode(modulate2x(scene.renderer));
    this.glowG = scene.make.graphics({}, false).setBlendMode(ADD);
    this.polyG = scene.make.graphics({}, false);
    this.bloom = scene.add.image(0, 0, this.rt.texture).setOrigin(0).setBlendMode(ADD).setAlpha(bloomAlpha).setVisible(bloomAlpha > 0);
    scene.events.on("postupdate", this.tick);
  }

  setDepth(d: number) { this.rt.setDepth(d); this.bloom.setDepth(d + 1); return this; }

  /** Redraw. `glow` blocks are powered city blocks: warm, cosmetic light. Skips work when nothing changed. */
  draw(sources: LightSource[], glow: Block[] = [], ambient = this.ambient) {
    const now = this.scene.time.now;
    const keys = sources.map((s) => `${s.x},${s.y},${s.radius},${s.color}`);
    const glowKeys = glow.map((b) => `g${b.x},${b.y}`);
    // Only switched streetlights flicker; the lantern's key changes every step.
    const flickers = (i: number) => this.level.lights.some((l) => l.x === sources[i].x && l.y === sources[i].y && l.color === sources[i].color);
    keys.forEach((k, i) => { if (!this.born.has(k)) this.born.set(k, this.last && flickers(i) ? now : -1e9); });
    for (const k of glowKeys) if (!this.born.has(k)) this.born.set(k, this.last ? now : -1e9);
    for (const k of this.born.keys()) if (!keys.includes(k) && !glowKeys.includes(k)) this.born.delete(k);
    this.last = { sources, glow, ambient };
    const sig = keys.join(";") + "|" + glowKeys.join(";") + "|" + ambient;
    const anim = this.animating();
    if (sig === this.sig && !anim && !this.settle) return;
    this.settle = anim;
    this.sig = sig;
    this.frame = this.scene.game.loop.frame;

    const rt = this.rt.clear().fill(ambient);
    const g = this.glowG.clear();
    glow.forEach((b, i) => {
      const k = Math.min(1, (now - this.born.get(glowKeys[i])!) / GLOW_FADE);
      for (const w of windowsIn(this.level, b)) g.fillStyle(PAL.warm, 0.85 * k).fillRect(w.x, w.y, w.w, w.h);
    });
    rt.draw(g);
    glow.forEach((b, i) => {
      const k = Math.min(1, (now - this.born.get(glowKeys[i])!) / GLOW_FADE);
      // A soft warm wash over the block, so it has no hard rectangular edge.
      rt.stamp("soft", undefined, (b.x + b.w / 2) * TILE, (b.y + b.h / 2) * TILE, { scaleX: (b.w * TILE * 1.5) / 64, scaleY: (b.h * TILE * 1.5) / 64, tint: PAL.warm, alpha: 0.45 * k, blendMode: ADD });
      for (const w of windowsIn(this.level, b)) rt.stamp("soft", undefined, w.x + w.w / 2, w.y + w.h + 4, { scale: 0.9, tint: PAL.warm, alpha: 0.35 * k, blendMode: ADD });
      const s = this.level.substations.find((s) => s.block === b);
      if (s) this.addPool(rt, { x: s.x, y: s.y, radius: 2, color: 0 }, PAL.warm, 0.8 * k);
    });
    sources.forEach((s, i) => this.addPool(rt, s, lightTint(s.color), this.flicker(now - this.born.get(keys[i])!), i));
    rt.render();
  }

  private animating() {
    const now = this.scene.time.now;
    for (const [k, t] of this.born) if (now - t < (k[0] === "g" ? GLOW_FADE : 300)) return true;
    return false;
  }

  private flicker(ms: number) { for (const [until, v] of FLICKER) if (ms < until) return v; return 1; }

  /** Adds one clipped pool into `rt`. Pools at whole tiles are cached; moving ones reuse slot `slot`. */
  private addPool(rt: Phaser.GameObjects.RenderTexture, s: LightSource, tint: number, alpha: number, slot = -1) {
    const key = `${s.x},${s.y},${s.radius},${tint}`;
    const fixed = Number.isInteger(s.x) && Number.isInteger(s.y);
    let pool = fixed ? this.pools.get(key) : this.moving[slot];
    const R = s.radius + 0.5, size = Math.ceil(R * TILE) * 2 + 2;
    if (!pool || (!fixed && pool.tex.width !== size)) {
      pool?.tex.destroy();
      pool = { tex: this.scene.textures.addDynamicTexture(`light-${uid++}`, size, size)!, key: "" };
      if (fixed) this.pools.set(key, pool); else this.moving[slot] = pool;
    }
    if (pool.key !== key) { this.renderPool(pool.tex, s, tint); pool.key = key; }
    if (alpha > 0) rt.stamp(pool.tex.key, undefined, (s.x + 0.5) * TILE, (s.y + 0.5) * TILE, { alpha, blendMode: ADD });
  }

  /** White visibility polygon, then the falloff multiplied over it: gradient clipped by shadows. */
  private renderPool(tex: Phaser.Textures.DynamicTexture, s: LightSource, tint: number) {
    const R = s.radius + 0.5, c = tex.width / 2;
    const d = castRays(this.level, s.x + 0.5, s.y + 0.5, R);
    const g = this.polyG.clear().fillStyle(0xffffff);
    const n = d.length, step = (Math.PI * 2) / n;
    let px = c + d[0] * TILE, py = c;
    for (let i = 1; i <= n; i++) {
      const a = i * step, r = d[i % n] * TILE, x = c + Math.cos(a) * r, y = c + Math.sin(a) * r;
      g.fillTriangle(c, c, px, py, x, y);
      px = x; py = y;
    }
    tex.clear().draw(g).stamp("light-falloff", undefined, c, c, { scale: (2 * R * TILE) / 256, tint, blendMode: Phaser.BlendModes.MULTIPLY }).render();
  }

  destroy() {
    this.scene.events.off("postupdate", this.tick);
    for (const p of [...this.pools.values(), ...this.moving]) p.tex.destroy();
    this.rt.destroy(); this.glowG.destroy(); this.polyG.destroy(); this.bloom.destroy();
  }
}
