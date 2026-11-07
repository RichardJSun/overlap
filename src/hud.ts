import { sfx } from "./audio/sfx.ts";
import type { NetStatus } from "./net/transport.ts";
import type { Role } from "./shared/protocol.ts";

const CSS = `
.hud{position:absolute;inset:0;pointer-events:none;font:13px/1.35 ui-monospace,"SF Mono",Menlo,Consolas,monospace;color:#e8ecff}
.hud .top{position:absolute;left:0;right:0;top:0;height:44px;display:flex;align-items:center;gap:12px;padding:0 12px;background:linear-gradient(#0b1020ee,#0b102000)}
.hud .name{font-weight:700;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}
.hud .role{opacity:.6;text-transform:uppercase;letter-spacing:.12em;font-size:11px}
.hud .sp{flex:1}
.hud .net{font-size:11px;padding:3px 8px;border:1px solid #2c3758;border-radius:999px;white-space:nowrap}
.hud .net.ok{border-color:#4dff8866;color:#4dff88}.hud .net.wait{color:#ffd38a;border-color:#ffd38a66}.hud .net.bad{color:#ff4d5e;border-color:#ff4d5e66}
.hud button{pointer-events:auto;font:inherit;color:#e8ecff;background:#141a2e;border:1px solid #2c3758;border-radius:6px;padding:4px 8px;cursor:pointer}
.hud .intro{position:absolute;left:50%;top:52px;transform:translateX(-50%);max-width:min(92%,640px);text-align:center;padding:8px 14px;background:#0b1020cc;border:1px solid #2c3758;border-radius:8px;transition:opacity .6s}
.hud .toast{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);padding:8px 14px;background:#141a2eee;border:1px solid #ffd38a88;color:#ffd38a;border-radius:8px;opacity:0;transition:opacity .3s;white-space:nowrap;max-width:94%;overflow:hidden;text-overflow:ellipsis}
.hud .toast.show{opacity:1}
.hud .bottom{position:absolute;left:0;right:0;bottom:0;min-height:56px;display:flex;align-items:center;gap:14px;padding:8px 12px;background:linear-gradient(#0b102000,#0b1020ee)}
.hud .bars{display:flex;gap:4px}.hud .bar{width:14px;height:22px;border:1px solid #4dff8899;border-radius:2px}.hud .bar.on{background:#4dff88;box-shadow:0 0 8px #4dff88}
.hud .bars.flash .bar{border-color:#ff4d5e;animation:hudflash .4s 2}
@keyframes hudflash{50%{background:#ff4d5e55}}
.hud .clock{font-variant-numeric:tabular-nums;color:#4dff88;opacity:.85}
.hud .hint{opacity:.7;font-size:12px}
`;

/** DOM overlay for one pane: district title, connection state, toasts, and role-specific controls. */
export class Hud {
  readonly el: HTMLDivElement;
  private q = <T extends HTMLElement>(s: string) => this.el.querySelector(s) as T;
  private toastTimer = 0;
  private introTimer = 0;

  constructor(pane: HTMLElement, readonly role: Role, room?: string) {
    if (!document.getElementById("hud-css")) {
      const s = document.createElement("style"); s.id = "hud-css"; s.textContent = CSS; document.head.appendChild(s);
    }
    this.el = document.createElement("div");
    this.el.className = "hud";
    this.el.innerHTML = `
      <div class="top"><span class="role"></span><span class="name"></span><span class="sp"></span><span class="room role"></span><span class="net wait">…</span><button class="mute" aria-label="Toggle sound"></button></div>
      <div class="intro"></div><div class="toast"></div>
      ${role === "guide" ? `<div class="bottom"><span class="role">Power</span><span class="bars"></span><span class="sp"></span><span class="hint"></span><span class="clock"></span></div>` : ""}`;
    this.q(".role").textContent = role === "runner" ? "Runner" : "Guide";
    this.q(".room").textContent = room ? `Room ${room}` : "";
    const mute = this.q<HTMLButtonElement>(".mute");
    const label = () => (mute.textContent = sfx.muted ? "Sound off" : "Sound on");
    label();
    mute.onclick = () => { sfx.unlock(); sfx.setMuted(!sfx.muted); label(); };
    pane.appendChild(this.el);
  }

  district(index: number, name: string, intro?: string) {
    this.q(".name").textContent = `${index + 1} · ${name}`;
    const el = this.q(".intro");
    el.textContent = intro ?? "";
    el.style.opacity = intro ? "1" : "0";
    clearTimeout(this.introTimer);
    this.introTimer = window.setTimeout(() => (el.style.opacity = "0"), 9000);
  }

  net(status: NetStatus, peer: boolean) {
    const el = this.q(".net");
    const partner = this.role === "runner" ? "Guide" : "Runner";
    if (status === "online" && peer) { el.textContent = `${partner} connected`; el.className = "net ok"; }
    else if (status === "online") { el.textContent = `Waiting for ${partner}`; el.className = "net wait"; }
    else if (status === "connecting") { el.textContent = "Connecting…"; el.className = "net wait"; }
    else { el.textContent = "Reconnecting…"; el.className = "net bad"; }
  }

  toast(msg: string, ms = 2600) {
    const el = this.q(".toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.remove("show"), ms);
  }

  budget(used: number, max: number, flash = false) {
    const el = this.q(".bars");
    if (!el) return;
    el.replaceChildren(...Array.from({ length: max }, (_, i) => { const b = document.createElement("span"); b.className = "bar" + (i < used ? " on" : ""); return b; }));
    if (flash) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  }

  hint(text: string) { const el = this.q(".hint"); if (el) el.textContent = text; }
  clock(text: string) { const el = this.q(".clock"); if (el) el.textContent = text; }
  destroy() { this.el.remove(); }
}
