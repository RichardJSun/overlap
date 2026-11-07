import Phaser from "phaser";
import { hex } from "../shared/color.ts";
import { TILE, type Level } from "../shared/level.ts";
import type { LightSource } from "../shared/lighting.ts";
import { castRays, polygon } from "./visibility.ts";
import { PAL } from "./textures.ts";

type Block = { x: number; y: number; w: number; h: number };

/**
 * Lightmap: a render texture filled with near-black ambient, with each light's visibility polygon
 * added in its color, then multiplied over the scene. Overlapping colors add, so red + blue = magenta.
 */
export class LightLayer {
  readonly rt: Phaser.GameObjects.RenderTexture;
  /** Additive bloom drawn straight into the scene above the lightmap, so colored pools glow. */
  readonly bloom: Phaser.GameObjects.Graphics;
  private g: Phaser.GameObjects.Graphics;
  private cache = new Map<string, Float32Array>();

  constructor(scene: Phaser.Scene, private level: Level, private ambient = 0x07080e, private bloomAlpha = 0.07) {
    const w = level.w * TILE, h = level.h * TILE;
    this.rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0).setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.g = scene.make.graphics({}, false).setBlendMode(Phaser.BlendModes.ADD);
    this.bloom = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  }

  setDepth(d: number) { this.rt.setDepth(d); this.bloom.setDepth(d + 1); return this; }

  /** Redraw. `glow` blocks are powered city blocks: warm, cosmetic light. */
  draw(sources: LightSource[], glow: Block[] = [], ambient = this.ambient) {
    const g = this.g, bloom = this.bloom;
    g.clear();
    bloom.clear();
    for (const b of glow) {
      g.fillStyle(PAL.warm, 0.22).fillRect(b.x * TILE, b.y * TILE, b.w * TILE, b.h * TILE);
    }
    for (const s of sources) {
      const key = `${s.x},${s.y},${s.radius}`;
      let d = this.cache.get(key);
      if (!d) {
        d = castRays(this.level, s.x + 0.5, s.y + 0.5, s.radius + 0.5);
        if (Number.isInteger(s.x) && Number.isInteger(s.y)) this.cache.set(key, d);
      }
      const col = hex(s.color);
      // Concentric scaled copies give a soft falloff toward the edge.
      for (let i = 0; i < 7; i++) {
        const k = 1 - i * 0.13;
        const pts = polygon(d, s.x + 0.5, s.y + 0.5, TILE, k) as Phaser.Math.Vector2[];
        g.fillStyle(col, i === 0 ? 0.3 : 0.12).fillPoints(pts, true);
        if (this.bloomAlpha) bloom.fillStyle(col, this.bloomAlpha).fillPoints(pts, true);
      }
    }
    this.rt.clear().fill(ambient).draw(g);
    this.rt.render();
  }

  destroy() { this.rt.destroy(); this.g.destroy(); this.bloom.destroy(); }
}
