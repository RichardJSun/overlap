import { sfx } from "./audio/sfx.ts";
import type { NetStatus } from "./net/transport.ts";
import type { Role } from "./shared/protocol.ts";

// Heights are load-bearing: src/scenes/fit.ts reserves 44px on top and the Guide reserves 64px below.
const CSS = `
.hud{--night:#0b1020;--wall:#1b2238;--edge:#2c3758;--street:#141a2e;--amber:#ffd38a;--red:#ff4d5e;--green:#4dff88;--ink:#e8ecff;--dim:#a9b1d6;--faint:#7d87b2;
  --tape:"DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow",sans-serif-condensed,system-ui,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--ease:cubic-bezier(.23,1,.32,1);
  position:absolute;inset:0;pointer-events:none;container-type:inline-size;font:13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink)}
.hud .top{position:absolute;left:0;right:0;top:0;height:44px;box-sizing:border-box;display:flex;align-items:center;gap:10px;padding:0 0 0 12px;
  background:linear-gradient(var(--night) 0,rgba(11,16,32,.82) 60%,rgba(11,16,32,0))}
.hud.runner .top{opacity:.78}
.hud .role{font:700 11px/1 var(--tape);font-stretch:condensed;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.hud .tape{display:inline-flex;align-items:center;gap:8px;min-width:0;height:24px;padding:0 9px;border-radius:2px;background:var(--wall);
  box-shadow:inset 0 1px 0 rgba(232,236,255,.09),0 1px 2px rgba(0,0,0,.5);font:700 15px/1 var(--tape);font-stretch:condensed;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}
.hud .tape b{font:600 11px/1 var(--mono);letter-spacing:0;color:var(--faint)}
.hud .name{overflow:hidden;text-overflow:ellipsis;padding-top:2px}
.hud .sp{flex:1}
.hud .room{font:600 12px/1 var(--mono);color:var(--faint);white-space:nowrap}
.hud .room em{font-style:normal;color:var(--dim);letter-spacing:.12em}
.hud .net{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--dim);white-space:nowrap}
.hud .net::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--amber);transition:background-color .2s}
.hud .net.ok::before{background:var(--green)}.hud .net.bad::before{background:var(--red)}.hud .net.bad{color:var(--ink)}
.hud .net.wait::before{animation:hud-breathe 1.4s ease-in-out infinite alternate}
@keyframes hud-breathe{to{opacity:.3}}
.hud .mute{pointer-events:auto;flex:none;width:44px;height:44px;display:grid;place-items:center;padding:0;border:0;background:none;color:var(--dim);cursor:pointer;touch-action:manipulation;transition:color .15s,transform .12s var(--ease)}
.hud .mute svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:square}
.hud .mute .x{display:none}.hud .mute[aria-pressed=true] .x{display:inline}.hud .mute[aria-pressed=true] .w{display:none}
.hud .mute:active{transform:scale(.92)}
.hud .mute:focus-visible{outline:2px solid var(--amber);outline-offset:-6px;color:var(--ink)}
@media (hover:hover){.hud .mute:hover{color:var(--ink)}}
.hud .intro{position:absolute;left:50%;top:52px;box-sizing:border-box;width:max-content;max-width:min(calc(100% - 24px),560px);padding:9px 14px;
  background:rgba(11,16,32,.9);border:1px solid var(--edge);font-size:13px;line-height:1.45;text-align:center;color:var(--ink);
  transform:translate(-50%,0);transition:opacity .6s ease,transform .6s var(--ease)}
.hud .intro.off{opacity:0;transform:translate(-50%,-6px)}
.hud .toast{position:absolute;left:50%;bottom:22px;box-sizing:border-box;width:max-content;max-width:min(calc(100% - 24px),520px);padding:9px 14px;
  background:rgba(11,16,32,.92);border:1px solid var(--edge);color:var(--ink);text-align:center;line-height:1.4;
  opacity:0;transform:translate(-50%,6px);transition:opacity .2s ease,transform .2s var(--ease)}
.hud .toast.show{opacity:1;transform:translate(-50%,0)}
.hud.guide .toast{bottom:100px}
.hud.runner .toast{bottom:52px}
.hud .objective{position:absolute;left:12px;bottom:14px;max-width:calc(100% - 24px);display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hud.guide .objective{bottom:72px}
.hud .objective .lbl{flex:none;padding:3px 6px 2px;background:var(--wall);color:var(--amber)}
.hud .objective.done .lbl{color:var(--green)}
.hud .card{position:absolute;left:50%;top:42%;box-sizing:border-box;width:max-content;max-width:calc(100% - 32px);padding:16px 26px 14px;text-align:center;
  background:rgba(11,16,32,.94);border:1px solid var(--amber);box-shadow:0 0 40px rgba(255,211,138,.18);opacity:0;transform:translate(-50%,-50%) scale(.96);
  transition:opacity .35s ease,transform .45s var(--ease)}
.hud .card.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.hud .card h3{margin:0;font:700 26px/1 var(--tape);font-stretch:condensed;letter-spacing:.14em;text-transform:uppercase;color:var(--amber)}
.hud .card p{margin:8px 0 0;font-size:13px;color:var(--dim)}
.hud .bottom{position:absolute;left:0;right:0;bottom:0;height:64px;box-sizing:border-box;padding:6px 12px;display:grid;grid-template-rows:auto 1fr;gap:4px;
  background:var(--night);border-top:1px solid var(--edge)}
.hud .hint{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-size:11px;line-height:12px;color:var(--faint);text-wrap:balance}
.hud .deck{display:flex;align-items:center;gap:10px;min-width:0}
.hud .lbl{font:700 12px/1 var(--tape);font-stretch:condensed;letter-spacing:.16em;text-transform:uppercase;color:var(--dim);padding-top:2px}
.hud .bars{display:flex;gap:4px}
.hud .bar{position:relative;width:16px;height:22px;box-sizing:border-box;background:var(--wall);border:1px solid var(--edge);transition:background-color .16s,border-color .16s}
.hud .bar::after{content:"";position:absolute;left:3px;right:3px;height:6px;bottom:3px;background:var(--edge);transition:transform .16s var(--ease),background-color .16s}
.hud .bar.on{background:rgba(255,211,138,.16);border-color:var(--amber)}
.hud .bar.on::after{background:var(--amber);transform:translateY(-8px)}
.hud .bars.flash .bar{animation:hud-deny .2s steps(1) 4}
@keyframes hud-deny{50%{border-color:var(--red);background:rgba(255,77,94,.3)}}
.hud .count{font:600 13px/1 var(--mono);font-variant-numeric:tabular-nums;color:var(--amber)}
.hud .ping{display:flex;align-items:center;gap:8px}
.hud .meter{width:56px;height:6px;background:var(--wall);border:1px solid var(--edge);overflow:hidden}
.hud .meter i{display:block;height:100%;background:var(--ink);transform-origin:left;transition:transform .16s var(--ease)}
.hud .ping.charging .lbl{color:var(--faint)}
.hud .ping.charging .meter i{background:var(--faint)}
.hud .clock{font:600 13px/1 var(--mono);font-variant-numeric:tabular-nums;color:var(--amber);min-width:5ch;text-align:right}
@container (max-width:479px){.hud .role,.hud .room{display:none}}
@container (max-width:339px){.hud .net{font-size:0;gap:0}}
@media (prefers-reduced-motion:reduce){.hud *,.hud *::before,.hud *::after{animation:none!important;transition-property:opacity,background-color,border-color,color!important}}
`;

const SPEAKER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="w" d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`;

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
    this.el.className = `hud ${role}`;
    this.el.innerHTML = `
      <div class="top"><span class="role"></span><span class="tape"><b class="num"></b><span class="name"></span></span><span class="sp"></span><span class="room"></span><span class="net wait" role="status">Connecting…</span><button class="mute" type="button" aria-label="Sound">${SPEAKER}</button></div>
      <div class="intro off"></div><div class="toast" role="status"></div><div class="objective"><span class="lbl">Goal</span><span class="obj"></span></div><div class="card" aria-live="polite"><h3></h3><p></p></div>
      ${role === "guide" ? `<div class="bottom"><div class="hint"></div><div class="deck"><span class="lbl">Power</span><span class="bars"></span><span class="count"></span><span class="sp"></span><span class="ping"><span class="lbl">Ping</span><span class="meter"><i></i></span></span><span class="clock"></span></div></div>` : ""}`;
    this.q(".role").textContent = role === "runner" ? "Runner" : "Guide";
    if (room) {
      const r = this.q(".room");
      r.append("Room ", Object.assign(document.createElement("em"), { textContent: room }));
    }
    const mute = this.q<HTMLButtonElement>(".mute");
    const label = () => { mute.setAttribute("aria-pressed", String(sfx.muted)); mute.title = sfx.muted ? "Sound off" : "Sound on"; mute.setAttribute("aria-label", mute.title); };
    label();
    mute.onclick = () => { sfx.unlock(); sfx.setMuted(!sfx.muted); label(); };
    pane.appendChild(this.el);
  }

  district(index: number, name: string, intro?: string) {
    this.q(".num").textContent = String(index + 1).padStart(2, "0");
    this.q(".name").textContent = name;
    const el = this.q(".intro");
    el.textContent = intro ?? "";
    el.classList.toggle("off", !intro);
    clearTimeout(this.introTimer);
    this.introTimer = window.setTimeout(() => el.classList.add("off"), 9000);
  }

  net(status: NetStatus, peer: boolean) {
    const el = this.q(".net");
    const partner = this.role === "runner" ? "Guide" : "Runner";
    if (status === "online" && peer) { el.textContent = `${partner} connected`; el.className = "net ok"; }
    else if (status === "online") { el.textContent = `Waiting for ${partner}`; el.className = "net wait"; }
    else if (status === "connecting") { el.textContent = "Connecting…"; el.className = "net wait"; }
    else if (status === "replaced") { el.textContent = "Opened in another tab"; el.className = "net bad"; }
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
    if (el.childElementCount !== max)
      el.replaceChildren(...Array.from({ length: max }, () => Object.assign(document.createElement("span"), { className: "bar" })));
    [...el.children].forEach((b, i) => b.classList.toggle("on", i < used));
    this.q(".count").textContent = `${used}/${max}`;
    if (flash) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  }

  /** Empties the Guide's ping meter and refills it over the cooldown. Call right after a ping is sent. */
  ping(cooldownMs: number) {
    const box = this.q(".ping"), bar = this.q(".meter i");
    if (!box) return;
    box.classList.add("charging");
    bar.style.transition = "none";
    bar.style.transform = "scaleX(0)";
    void bar.offsetWidth;
    bar.style.transition = `transform ${cooldownMs}ms linear`;
    bar.style.transform = "";
    window.setTimeout(() => box.classList.remove("charging"), cooldownMs);
  }

  /** The current goal, always visible in the corner. `done` turns the label green. */
  objective(text: string, done = false) {
    this.q(".obj").textContent = text;
    this.q(".objective").classList.toggle("done", done);
  }

  /** A short centered card for milestones, e.g. a district restored. */
  card(title: string, sub = "", ms = 1800) {
    const el = this.q(".card");
    el.querySelector("h3")!.textContent = title;
    el.querySelector("p")!.textContent = sub;
    el.classList.add("show");
    window.setTimeout(() => el.classList.remove("show"), ms);
  }

  hint(text: string) { const el = this.q(".hint"); if (el) el.textContent = text; }
  clock(text: string) { const el = this.q(".clock"); if (el) el.textContent = text; }
  destroy() { this.el.remove(); }
}
