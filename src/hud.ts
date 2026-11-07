import { sfx } from "./audio/sfx.ts";
import type { NetStatus } from "./net/transport.ts";
import type { Role } from "./shared/protocol.ts";

// Heights are load-bearing: src/scenes/fit.ts reserves 44px on top and the Guide reserves 44px below.
const CSS = `
.hud{--night:#0b1020;--wall:#1b2238;--edge:#2c3758;--street:#141a2e;--amber:#ffd38a;--red:#ff4d5e;--green:#4dff88;--ink:#e8ecff;--dim:#a9b1d6;--faint:#7d87b2;
  --din:"DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow",sans-serif-condensed,system-ui,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;--ease:cubic-bezier(.23,1,.32,1);--lift:0 0 2px #0b1020,0 1px 10px #0b1020,0 0 18px rgba(11,16,32,.9);
  position:absolute;inset:0;pointer-events:none;container-type:inline-size;font:13.5px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink)}
.hud ::selection{background:var(--amber);color:var(--night)}
.hud .top{position:absolute;left:0;right:0;top:0;height:44px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:0 0 0 14px;
  background:linear-gradient(var(--night) 0,rgba(11,16,32,.82) 60%,rgba(11,16,32,0))}
.hud .role{font:700 12px/1 var(--din);font-stretch:condensed;letter-spacing:.18em;text-transform:uppercase;color:var(--faint);padding-top:2px}
.hud .sheet{display:inline-flex;align-items:baseline;gap:9px;min-width:0;white-space:nowrap}
.hud .sheet b{font:600 12px/1 var(--mono);color:var(--amber);font-variant-numeric:tabular-nums}
.hud .name{overflow:hidden;text-overflow:ellipsis;font:700 17px/1 var(--din);font-stretch:condensed;letter-spacing:.1em;text-transform:uppercase;padding-top:2px}
.hud .sp{flex:1}
.hud .room{font:600 12px/1 var(--mono);color:var(--faint);white-space:nowrap}
.hud .room em{font-style:normal;color:var(--dim);letter-spacing:.12em}
.hud .net{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--dim);white-space:nowrap}
.hud .net::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--amber);transition:background-color .2s}
.hud .net.ok::before{background:var(--green)}.hud .net.bad::before{background:var(--red)}.hud .net.bad{color:var(--ink)}
.hud .net.wait::before{animation:hud-breathe 1.4s ease-in-out infinite alternate}
@keyframes hud-breathe{to{opacity:.3}}
.hud .mute{pointer-events:auto;flex:none;width:44px;height:44px;display:grid;place-items:center;padding:0;border:0;background:none;color:var(--dim);cursor:pointer;touch-action:manipulation;transition:color .15s,transform .12s var(--ease)}
.hud .mute svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:square}
.hud .mute .x{display:none}.hud .mute[aria-pressed=true] .x{display:inline}.hud .mute[aria-pressed=true] .w{display:none}
.hud .mute:active{transform:scale(.92)}
.hud .mute:focus-visible{outline:2px solid var(--amber);outline-offset:-6px;color:var(--ink)}
@media (hover:hover){.hud .mute:hover{color:var(--ink)}}

/* Notes: text set straight on the sheet, labelled like a drawing note. The tutorial note gets a leader line to its tile. */
.hud .note{position:absolute;left:50%;top:54px;box-sizing:border-box;width:max-content;max-width:min(calc(100% - 32px),500px);
  display:flex;flex-direction:column;gap:5px;text-shadow:var(--lift);transform:translate(-50%,0);transition:opacity .3s ease,transform .4s var(--ease)}
.hud .note.off{opacity:0;transform:translate(-50%,-6px)}
.hud .note .lbl{align-self:flex-start;font:600 11.5px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--amber);
  padding-bottom:4px;border-bottom:1px solid var(--amber);white-space:nowrap}
.hud .note .say{text-wrap:pretty}
.hud .intro .lbl{color:var(--dim);border-color:var(--dim)}
.hud .lead{position:absolute;inset:0;width:100%;height:100%;overflow:visible;fill:none;stroke:var(--amber);stroke-width:1.4;transition:opacity .25s ease}
.hud .lead.off{opacity:0}

/* Transient messages are callouts under a dimension line. */
.hud .toast{position:absolute;left:50%;bottom:22px;box-sizing:border-box;width:max-content;max-width:min(calc(100% - 32px),500px);padding:7px 4px 0;
  text-align:center;text-shadow:var(--lift);border-top:1px solid rgba(232,236,255,.7);
  opacity:0;transform:translate(-50%,6px);transition:opacity .2s ease,transform .2s var(--ease)}
.hud .toast::before,.hud .toast::after{content:"";position:absolute;top:-5px;width:1px;height:9px;background:rgba(232,236,255,.7)}
.hud .toast::before{left:0}.hud .toast::after{right:0}
.hud .toast.show{opacity:1;transform:translate(-50%,0)}
.hud.runner .toast{bottom:66px}
.hud.guide .toast{bottom:62px}

/* Milestones read as a revision entered on the sheet. */
.hud .card{position:absolute;left:50%;top:42%;box-sizing:border-box;width:max-content;max-width:calc(100% - 32px);padding:30px 70px;text-align:center;
  background:radial-gradient(closest-side,rgba(11,16,32,.94) 55%,rgba(11,16,32,0));opacity:0;transform:translate(-50%,-50%) scale(.97);transition:opacity .35s ease,transform .45s var(--ease)}
.hud .card.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
.hud .card h3{margin:0;font:700 30px/1 var(--din);font-stretch:condensed;letter-spacing:.14em;text-transform:uppercase;color:var(--amber)}
.hud .card p{margin:10px 0 0;padding-top:8px;border-top:1px solid rgba(232,236,255,.5);font:13px/1.4 var(--mono);color:var(--ink)}

/* Title block: the goal, and on the Guide's screen the whole console. */
.hud .tb{display:flex;box-sizing:border-box;border:1.5px solid var(--ink);background:rgba(11,16,32,.92)}
.hud .cell{display:flex;flex-direction:column;justify-content:center;gap:4px;min-width:0;padding:0 12px;border-left:1px solid rgba(232,236,255,.45)}
.hud .cell:first-child{border-left:0}
.hud .k{font:600 9.5px/1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.hud .v{display:flex;align-items:center;gap:8px}
.hud .obj{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.hud .objective.done .k{color:var(--green)}
.hud.runner .objective{position:absolute;left:12px;bottom:12px;height:42px;max-width:calc(100% - 24px)}
.hud .bottom{position:absolute;left:0;right:0;bottom:0;height:44px}
.hud .bottom .tb{height:100%;border-width:1.5px 0 0}
.hud .goal{flex:1}
.hud.local .net{display:none}
.hud .bars{display:flex;gap:8px;padding:0 4px;background:linear-gradient(var(--dim),var(--dim)) center/100% 1px no-repeat}
.hud .bar{width:12px;height:12px;box-sizing:border-box;border:1.5px solid var(--dim);background:var(--night);transition:background-color .16s,border-color .16s}
.hud .bar.on{background:var(--amber);border-color:var(--amber)}
.hud .bars.flash .bar{animation:hud-deny .2s steps(1) 4}
@keyframes hud-deny{50%{border-color:var(--red);background:var(--red)}}
.hud .count,.hud .clock{font:600 13px/1 var(--mono);font-variant-numeric:tabular-nums;color:var(--amber)}
.hud .clock{min-width:5ch}
.hud .meter{width:56px;height:2px;background:repeating-linear-gradient(90deg,var(--edge) 0 4px,transparent 4px 7px);overflow:hidden;margin:5px 0}
.hud .meter i{display:block;height:100%;background:var(--ink);transform-origin:left;transition:transform .16s var(--ease)}
.hud .ping.charging .k{color:var(--faint)}
.hud .ping.charging .meter i{background:var(--faint)}
.hud .bolt{display:inline-block;width:.62em;height:.9em;margin:0 .1em;vertical-align:-.1em;background:var(--amber);
  -webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 14'%3E%3Cpath d='M6 0 0 8h4l-1 6 7-9H6z'/%3E%3C/svg%3E") center/contain no-repeat;
  mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 14'%3E%3Cpath d='M6 0 0 8h4l-1 6 7-9H6z'/%3E%3C/svg%3E") center/contain no-repeat}
@container (max-width:479px){.hud .role,.hud .room{display:none}.hud .note{top:50px;font-size:12.5px;line-height:1.4}.hud .cell{padding:0 8px}.hud .meter{width:40px}}
@container (max-width:339px){.hud .net{font-size:0;gap:0}}
@media (prefers-reduced-motion:reduce){.hud *,.hud *::before,.hud *::after{animation:none!important;transition-property:opacity,background-color,border-color,color!important}}
`;

/** Sets text, drawing each ⚡ as the HUD's bolt icon so copy matches the substation tile. */
function withBolts(el: Element, text: string) {
  el.replaceChildren(...text.split("⚡").flatMap((part, i) => (i ? [Object.assign(document.createElement("i"), { className: "bolt" }), part] : [part])));
}

const SPEAKER = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z"/><path class="w" d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/><path class="x" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>`;

/** DOM overlay for one pane: district title, connection state, toasts, and role-specific controls. */
export class Hud {
  readonly el: HTMLDivElement;
  private q = <T extends HTMLElement>(s: string) => this.el.querySelector(s) as T;
  private toastTimer = 0;
  private introTimer = 0;
  private leadKey = "";

  constructor(pane: HTMLElement, readonly role: Role, room?: string, local = false) {
    if (!document.getElementById("hud-css")) {
      const s = document.createElement("style"); s.id = "hud-css"; s.textContent = CSS; document.head.appendChild(s);
    }
    this.el = document.createElement("div");
    // One screen, both roles: the connection pill would always say "connected", so it's hidden.
    this.el.className = `hud ${role}${local ? " local" : ""}`;
    this.el.innerHTML = `
      <div class="top"><span class="role"></span><span class="sheet"><b class="num"></b><span class="name"></span></span><span class="sp"></span><span class="room"></span><span class="net wait" role="status">Connecting…</span><button class="mute" type="button" aria-label="Sound">${SPEAKER}</button></div>
      <div class="note intro off"><span class="lbl"></span><span class="say"></span></div><div class="note coach off" role="status"><span class="lbl"></span><span class="say"></span></div>
      <svg class="lead off" aria-hidden="true"><defs><marker id="hud-arrow-${role}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0 1 9 5 0 9z" fill="#ffd38a" stroke="none"/></marker></defs><path class="ld" marker-end="url(#hud-arrow-${role})"/><circle r="13"/></svg>
      <div class="toast" role="status"></div><div class="card" aria-live="polite"><h3></h3><p></p></div>
      ${role === "guide"
        ? `<div class="bottom"><div class="tb"><div class="cell goal objective"><span class="k">Goal</span><span class="obj"></span></div><div class="cell"><span class="k">Lights</span><span class="v"><span class="bars"></span><span class="count"></span></span></div><div class="cell ping"><span class="k">Ping</span><span class="meter"><i></i></span></div><div class="cell"><span class="k">Time</span><span class="clock"></span></div></div></div>`
        : `<div class="objective tb"><div class="cell"><span class="k">Goal</span><span class="obj"></span></div></div>`}`;
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

  district(index: number, name: string, intro?: string, label = "Radio") {
    this.q(".num").textContent = String(index + 1).padStart(2, "0");
    this.q(".name").textContent = name;
    const el = this.q(".intro");
    el.querySelector(".lbl")!.textContent = label;
    el.querySelector(".say")!.textContent = intro ?? "";
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
    withBolts(this.q(".obj"), text);
    this.q(".objective").classList.toggle("done", done);
  }

  /** Tutorial note under the top bar; null hides it. While it shows, the district intro stays hidden. */
  coach(text: string | null, label = "") {
    const el = this.q(".coach");
    el.classList.toggle("off", !text);
    if (!text) return this.leader(null);
    this.q(".intro").classList.add("off");
    el.querySelector(".lbl")!.textContent = label === "Tip" || !label ? "Note" : `Note ${label}`;
    withBolts(el.querySelector(".say")!, text);
  }

  /** Draws the note's leader line to a point in pane pixels (the tile the note is about); null hides it. */
  leader(p: { x: number; y: number } | null) {
    const svg = this.q(".lead") as unknown as SVGSVGElement;
    const note = this.q(".coach");
    const key = p && !note.classList.contains("off") ? `${Math.round(p.x)},${Math.round(p.y)},${note.offsetWidth},${note.offsetHeight}` : "";
    if (key === this.leadKey) return;
    this.leadKey = key;
    svg.classList.toggle("off", !key);
    if (!p || !key) return;
    const pane = this.el.getBoundingClientRect(), r = note.getBoundingClientRect();
    const left = r.left - pane.left, bottom = r.bottom - pane.top + 6;
    // A short shoulder under the note, then a straight run that stops at the ring around the tile.
    const sx = Math.min(Math.max(p.x, left + 14), left + r.width - 14), sy = bottom + 8;
    const d = Math.hypot(p.x - sx, p.y - sy), k = d > 18 ? (d - 16) / d : 0;
    svg.querySelector(".ld")!.setAttribute("d", `M${sx} ${bottom}V${sy}L${(sx + (p.x - sx) * k).toFixed(1)} ${(sy + (p.y - sy) * k).toFixed(1)}`);
    const ring = svg.querySelector("circle")!;
    ring.setAttribute("cx", p.x.toFixed(1));
    ring.setAttribute("cy", p.y.toFixed(1));
  }

  /** A short centered card for milestones, e.g. a district restored. */
  card(title: string, sub = "", ms = 1800) {
    const el = this.q(".card");
    el.querySelector("h3")!.textContent = title;
    el.querySelector("p")!.textContent = sub;
    el.classList.add("show");
    window.setTimeout(() => el.classList.remove("show"), ms);
  }

  clock(text: string) { const el = this.q(".clock"); if (el) el.textContent = text; }
  destroy() { this.el.remove(); }
}
