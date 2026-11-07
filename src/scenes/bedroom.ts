/**
 * Cold open: the field tech's dark bedroom, the city lit white outside the window, and a phone
 * buzzing on the nightstand. Drawn with Canvas2D over the game pane; the intro scene drives it.
 */
type Phase = "ringing" | "answered" | "split" | "dying" | "out";

const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const RGB = ["#ff4d5e", "#4dff88", "#4d8bff"];

export class Bedroom {
  private c = document.createElement("canvas");
  private g = this.c.getContext("2d")!;
  private phase: Phase = "ringing";
  private t0 = performance.now();
  private phaseAt = this.t0;
  private raf = 0;
  private fade = 1;

  constructor(private pane: HTMLElement) {
    this.c.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transition:opacity .6s";
    pane.appendChild(this.c);
    const loop = () => { this.draw(); this.raf = requestAnimationFrame(loop); };
    loop();
  }

  set(phase: Phase) { this.phase = phase; this.phaseAt = performance.now(); }
  get answered() { return this.phase !== "ringing"; }

  hide() { this.c.style.opacity = "0"; setTimeout(() => this.destroy(), 700); }
  destroy() { cancelAnimationFrame(this.raf); this.c.remove(); }

  private draw() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = this.pane.clientWidth, H = this.pane.clientHeight;
    if (this.c.width !== Math.round(W * dpr)) { this.c.width = Math.round(W * dpr); this.c.height = Math.round(H * dpr); }
    const g = this.g, now = performance.now(), t = (now - this.t0) / 1000, pt = (now - this.phaseAt) / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    // How far the city's lights have come apart (0 = white) and how many are already out (0..1).
    const spread = this.phase === "split" ? Math.min(1, pt / 1.6) : this.phase === "dying" || this.phase === "out" ? 1 : 0;
    const dead = this.phase === "dying" ? Math.min(1, pt / 1.8) : this.phase === "out" ? 1 : 0;

    g.fillStyle = "#05070d";
    g.fillRect(0, 0, W, H);

    // The window and the skyline behind it.
    const wx = W * 0.55, wy = H * 0.1, ww = W * 0.38, wh = H * 0.48;
    const sky = g.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, "#0b1020"); sky.addColorStop(1, "#18203a");
    g.fillStyle = sky;
    g.fillRect(wx, wy, ww, wh);
    let bx = wx;
    for (let i = 0; bx < wx + ww; i++) {
      const bw = ww * (0.08 + rnd(i) * 0.1), bh = wh * (0.3 + rnd(i + 50) * 0.5), by = wy + wh - bh;
      g.fillStyle = "#0d1222";
      g.fillRect(bx, by, bw, bh);
      for (let r = 0; r < Math.floor(bh / 9); r++)
        for (let k = 0; k < Math.max(1, Math.floor(bw / 8)); k++) {
          const id = i * 97 + r * 13 + k;
          if (rnd(id) > 0.42 || rnd(id + 3) < dead) continue;
          g.fillStyle = spread > 0.15 ? RGB[Math.floor(rnd(id + 7) * 3)] : "#eef1ff";
          g.globalAlpha = 0.85;
          g.fillRect(bx + 3 + k * 8, by + 4 + r * 9, 4, 4);
        }
      g.globalAlpha = 1;
      bx += bw + 2;
    }
    // Streetlights along the bottom of the view: one white glow each, then three colored ones.
    for (let i = 0; i < 5; i++) {
      const lx = wx + ww * (0.1 + i * 0.2), ly = wy + wh * 0.92;
      if (rnd(i + 900) < dead * 1.05) continue;
      const parts = spread > 0 ? [0, 1, 2] : [-1];
      for (const p of parts) {
        const a = (p * 2 * Math.PI) / 3 - Math.PI / 2, d = spread * 14;
        const x = lx + (p < 0 ? 0 : Math.cos(a) * d), y = ly + (p < 0 ? 0 : Math.sin(a) * d);
        const glow = g.createRadialGradient(x, y, 0, x, y, 22);
        glow.addColorStop(0, p < 0 ? "rgba(240,244,255,.9)" : RGB[p]);
        glow.addColorStop(1, "rgba(0,0,0,0)");
        g.globalCompositeOperation = "lighter";
        g.fillStyle = glow;
        g.fillRect(x - 22, y - 22, 44, 44);
        g.globalCompositeOperation = "source-over";
      }
    }
    // Frame and mullions.
    g.strokeStyle = "#1b2238"; g.lineWidth = 8;
    g.strokeRect(wx, wy, ww, wh);
    g.lineWidth = 4;
    g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();

    // The window's light falls across the floor and the bed, and goes out with the city.
    const cast = 0.07 * (1 - dead);
    if (cast > 0.002) {
      g.fillStyle = `rgba(220,228,255,${cast})`;
      g.beginPath(); g.moveTo(wx, wy + wh); g.lineTo(wx + ww, wy + wh); g.lineTo(W * 0.62, H); g.lineTo(W * 0.02, H); g.closePath(); g.fill();
    }

    // Bed: frame, mattress, blanket over a sleeping shape, pillow, head.
    const by = H * 0.66;
    g.fillStyle = "#0e1326"; g.fillRect(W * 0.04, by, W * 0.44, H * 0.16);
    g.fillStyle = "#151c34"; g.fillRect(W * 0.04, by - H * 0.03, W * 0.44, H * 0.05);
    g.fillStyle = "#1e2745";
    g.beginPath();
    g.moveTo(W * 0.15, by + H * 0.01);
    g.bezierCurveTo(W * 0.2, by - H * 0.1, W * 0.34, by - H * 0.1, W * 0.42, by - H * 0.03);
    g.lineTo(W * 0.48, by + H * 0.01); g.lineTo(W * 0.15, by + H * 0.01); g.fill();
    g.strokeStyle = `rgba(110,124,170,${0.5 * (1 - dead) + 0.15})`; g.lineWidth = 2;
    g.beginPath(); g.moveTo(W * 0.15, by); g.bezierCurveTo(W * 0.2, by - H * 0.105, W * 0.34, by - H * 0.105, W * 0.42, by - H * 0.035); g.stroke();
    g.fillStyle = "#2a3354"; g.beginPath(); g.ellipse(W * 0.1, by - H * 0.035, W * 0.05, H * 0.03, 0, 0, Math.PI * 2); g.fill();
    // Head: on the pillow while asleep, up and holding the phone once answered.
    const up = this.phase === "ringing" ? 0 : Math.min(1, pt * 3 + (this.phase !== "answered" ? 1 : 0));
    const hx = W * (0.12 + up * 0.03), hy = by - H * (0.05 + up * 0.06);
    g.fillStyle = "#0a0e1c"; g.beginPath(); g.arc(hx, hy, H * 0.025, 0, Math.PI * 2); g.fill();

    // Nightstand and phone.
    const nx = W * 0.49, ny = H * 0.6;
    g.fillStyle = "#121933"; g.fillRect(nx, ny, W * 0.06, H * 0.22);
    g.fillStyle = "#1b2238"; g.fillRect(nx - 4, ny - 4, W * 0.06 + 8, 6);
    if (this.phase === "ringing") {
      const buzz = Math.sin(t * 60) * (Math.sin(t * 5.2) > 0 ? 2 : 0);
      const px = nx + W * 0.012 + buzz, py = ny - 10;
      const pulse = 0.55 + 0.45 * Math.abs(Math.sin(t * 5.2));
      const halo = g.createRadialGradient(px + 14, py, 0, px + 14, py, 70);
      halo.addColorStop(0, `rgba(160,200,255,${0.55 * pulse})`); halo.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = halo; g.fillRect(px - 60, py - 70, 150, 140);
      g.fillStyle = "#cfe0ff"; g.fillRect(px, py, 28, 6);
    } else {
      // The phone is at the ear now: a small glow by the head.
      const halo = g.createRadialGradient(hx + 12, hy, 0, hx + 12, hy, 30);
      halo.addColorStop(0, "rgba(160,200,255,.5)"); halo.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = halo; g.fillRect(hx - 20, hy - 30, 64, 60);
    }

    if (this.phase === "out") this.fade = Math.max(0, 1 - pt);
    this.c.style.opacity = String(this.fade);
  }
}
