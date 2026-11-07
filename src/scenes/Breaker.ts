import Phaser from "phaser";
import { sfx } from "../audio/sfx.ts";
import type { SceneData } from "../game.ts";
import { Hud } from "../hud.ts";
import { LEVELS } from "../levels/index.ts";
import { BROKEN_RULE, check, LIVE, MAX_RULE, pull, safe, TESTS, VARIABLES, type Pull } from "../shared/breaker.ts";
import { hex, type ColorMask } from "../shared/color.ts";
import type { Msg, Role } from "../shared/protocol.ts";
import type { NetStatus } from "../net/transport.ts";
import type { RunStats } from "./Runner.ts";

export type BreakerData = SceneData & { role: Role; stats?: RunStats; lantern?: ColorMask; rule?: string };

const CSS = `
.bk{--night:#0b1020;--wall:#1b2238;--edge:#2c3758;--amber:#ffd38a;--red:#ff4d5e;--green:#4dff88;--ink:#e8ecff;--dim:#a9b1d6;--faint:#7d87b2;
  --tape:"DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow",sans-serif-condensed,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  position:absolute;inset:0;display:flex;overflow:auto;padding:124px 12px 16px;box-sizing:border-box;font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);transition:opacity .6s ease}
.bk.gone{opacity:0}
.bk-panel{margin:auto;width:min(100%,540px);box-sizing:border-box;padding:14px 16px 16px;background:rgba(11,16,32,.94);border:1px solid var(--edge)}
.bk header{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bk-tag,.bk h4{font:700 13px/1 var(--tape);font-stretch:condensed;letter-spacing:.16em;text-transform:uppercase;color:var(--amber);padding-top:2px}
.bk h4{margin:14px 0 6px;color:var(--dim)}
.bk-state{margin-left:auto;padding:3px 7px 2px;background:var(--wall);font:700 12px/1 var(--tape);letter-spacing:.14em;text-transform:uppercase;color:var(--red)}
.bk.closed .bk-state{color:var(--green)}
.bk p{margin:0 0 10px;color:var(--dim)}
.bk code{font:13px/1.3 var(--mono);color:var(--ink)}
.bk button{font:700 14px/1 var(--tape);font-stretch:condensed;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;touch-action:manipulation;
  min-height:44px;padding:0 16px;border:1px solid var(--edge);background:var(--wall);color:var(--ink);transition:transform .12s cubic-bezier(.23,1,.32,1),border-color .15s,background-color .15s}
.bk button:active:not(:disabled){transform:scale(.97)}
.bk button:focus-visible{outline:2px solid var(--amber);outline-offset:2px}
.bk button:disabled{cursor:not-allowed;color:var(--faint)}
.bk.runner{background:radial-gradient(ellipse 60% 55% at 50% 58%,var(--glow),transparent 70%)}
.bk-dials{display:grid;grid-template-columns:1.3fr 1fr;gap:10px;align-items:stretch}
.bk-gauge{margin:0;padding:8px 10px 10px;background:#070a14;border:1px solid var(--edge);text-align:center}
.bk-gauge svg{display:block;width:100%;max-width:220px;margin:0 auto}
.bk-gauge figcaption,.bk-plate{font:700 12px/1 var(--tape);letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.bk-read{display:block;margin-top:4px;font:600 22px/1 var(--mono);letter-spacing:0;color:var(--red);font-variant-numeric:tabular-nums}
.bk-side{display:grid;gap:10px}
.bk-plate,.bk-lamp{display:flex;flex-direction:column;justify-content:center;gap:6px;padding:10px;background:#070a14;border:1px solid var(--edge)}
.bk-plate b{font:600 22px/1 var(--mono);letter-spacing:0;color:var(--ink)}
.bk-lamp{flex-direction:row;align-items:center;gap:10px;font:700 12px/1 var(--tape);letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
.bk-lamp i{width:12px;height:12px;border-radius:50%;background:var(--green);box-shadow:0 0 10px var(--green)}
.bk-note{margin-top:12px!important;padding:8px 10px;border-left:3px solid var(--amber);background:rgba(255,211,138,.06);color:var(--ink)!important}
.bk-controls{display:flex;gap:10px;flex-wrap:wrap}
.bk-key[aria-pressed=true]{border-color:var(--amber);background:rgba(255,211,138,.16);color:var(--amber)}
.bk-lever{flex:1;border-color:var(--amber)!important}
.bk-lever.pulled{transform:translateY(3px)}
.bk-rule{margin:12px 0 0!important;font-size:12px}
.bk-rule span{display:block;margin-bottom:3px;font:700 11px/1 var(--tape);letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.bk textarea{display:block;width:100%;box-sizing:border-box;min-height:56px;padding:8px 10px;resize:vertical;font:16px/1.35 var(--mono);color:var(--ink);
  background:#070a14;border:1px solid var(--edge);caret-color:var(--amber)}
.bk textarea:focus{outline:none;border-color:var(--amber)}
.bk-err{min-height:1.45em;margin:6px 0 8px!important;color:var(--red)!important}
.bk-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.bk-install:not(:disabled){border-color:var(--amber)}
.bk-installed{font-size:12px;color:var(--faint)}
.bk ul,.bk ol{margin:0;padding:0;list-style:none;display:grid;gap:5px}
.bk-vars li{display:grid;grid-template-columns:11ch 4ch 1fr;gap:8px;align-items:baseline;color:var(--dim)}
.bk-vars em{font:12px/1 var(--mono);font-style:normal;color:var(--faint)}
.bk-tests li{display:grid;grid-template-columns:18px 1fr auto;gap:2px 8px;align-items:baseline;padding:6px 8px;background:#070a14;border:1px solid var(--edge)}
.bk-tests li small{grid-column:2/4;font:12px/1.3 var(--mono);color:var(--faint)}
.bk-tests li b{font:700 12px/1 var(--tape);letter-spacing:.12em;text-transform:uppercase;color:var(--dim)}
.bk-tests .mark::before{content:"·";color:var(--faint)}
.bk-tests .pass .mark::before{content:"✓";color:var(--green)}
.bk-tests .fail .mark::before{content:"✗";color:var(--red)}
.bk-tests .fail{border-color:rgba(255,77,94,.5)}
.bk-last{min-height:1.45em;margin:10px 0 0!important;color:var(--ink)!important}
.hud.breaker .objective,.hud.breaker .bottom{display:none}
.hud.breaker .toast{bottom:22px}
@media (max-width:420px){.bk-dials{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.bk,.bk *{transition:none!important}}
`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const rgba = (c: number, a: number) => `rgba(${c >> 16},${(c >> 8) & 255},${c & 255},${a})`;

/** Angle of the load gauge's needle for a reading, on a 0-150 MW dial. */
const needle = (mw: number) => -90 + (180 * Math.min(150, Math.max(0, mw))) / 150;

/**
 * The last room: the main breaker. The Runner reads the gauges, turns the override key, and pulls
 * the lever. The Guide has no camera here; they edit the breaker's rule against three safety tests.
 */
export class BreakerScene extends Phaser.Scene {
  private info!: BreakerData;
  private hud!: Hud;
  private root!: HTMLDivElement;
  private rule = BROKEN_RULE;
  private key = false;
  private done = false;
  private t0 = 0;
  private peer = false;
  private status: NetStatus = "connecting";

  constructor() { super("breaker"); }

  init(data: BreakerData) {
    this.info = data;
    this.rule = typeof data.rule === "string" ? data.rule : BROKEN_RULE;
    this.key = false;
    this.done = false;
  }

  create() {
    const { role, transport: net } = this.info;
    this.t0 = performance.now();
    // On one shared page, Phaser's key capture would swallow the spaces the Guide types into the rule.
    this.input.keyboard?.disableGlobalCapture();
    if (!document.getElementById("bk-css")) document.head.appendChild(Object.assign(document.createElement("style"), { id: "bk-css", textContent: CSS }));
    const pane = this.game.canvas.parentElement!;
    this.hud = new Hud(pane, role, this.info.room, this.info.local);
    this.hud.el.classList.add("breaker");
    this.hud.district(LEVELS.length, "Main Breaker", "Every block is back, but the main breaker won't stay closed. Somebody rewrote its rule.", "Call · Dispatch");
    this.root = document.createElement("div");
    this.root.className = `bk ${role}`;
    pane.insertBefore(this.root, this.hud.el);
    const alive = { on: true };
    this.events.once("shutdown", () => { alive.on = false; this.hud.destroy(); this.root.remove(); });
    if (role === "runner") this.runnerPanel(alive);
    else this.guidePanel();
    net.onMessage((m) => alive.on && this.onMsg(m));
    net.onStatus((s) => { if (alive.on) { this.status = s; this.hud.net(s, this.peer); } });
    net.onPeer((c) => {
      if (!alive.on) return;
      this.peer = c;
      this.hud.net(this.status, c);
      // A Guide who joins or reconnects now lands in district 5 from the stored snapshot; pull them in here.
      if (c && role === "runner") net.send({ t: "breaker", rule: this.rule });
    });
  }

  private q<T extends HTMLElement>(s: string) { return this.root.querySelector(s) as T; }

  private runnerPanel(alive: { on: boolean }) {
    this.root.style.setProperty("--glow", rgba(hex(this.info.lantern ?? LEVELS.at(-1)!.lantern), 0.24));
    const redFrom = needle(Number(LIVE.capacity)) * (Math.PI / 180);
    const [rx, ry] = [60 + 48 * Math.sin(redFrom), 62 - 48 * Math.cos(redFrom)];
    this.root.innerHTML = `<section class="bk-panel" aria-label="Main breaker">
      <header><span class="bk-tag">Main breaker</span><span class="bk-state">Open</span></header>
      <p>Read these gauges to your Guide. <b>K</b> turns the override key. <b>Space</b> pulls the lever.</p>
      <div class="bk-dials">
        <figure class="bk-gauge"><svg viewBox="0 0 120 70" aria-hidden="true">
          <path d="M12 62A48 48 0 0 1 108 62" fill="none" stroke="#2c3758" stroke-width="6"/>
          <path d="M${rx.toFixed(2)} ${ry.toFixed(2)}A48 48 0 0 1 108 62" fill="none" stroke="#ff4d5e" stroke-width="6"/>
          <line class="bk-needle" x1="60" y1="62" x2="60" y2="20" stroke="#e8ecff" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="60" cy="62" r="4" fill="#e8ecff"/>
        </svg><figcaption>Load<span class="bk-read">${LIVE.load} MW</span></figcaption></figure>
        <div class="bk-side">
          <div class="bk-plate">Capacity<b>${LIVE.capacity} MW</b></div>
          <div class="bk-lamp"><i></i>Line clear</div>
        </div>
      </div>
      <p class="bk-note">Restart surge. If the load runs over capacity, turn the override key, then close the breaker.</p>
      <div class="bk-controls"><button class="bk-key" type="button" aria-pressed="false">Override key off</button><button class="bk-lever" type="button">Pull the lever</button></div>
      <p class="bk-rule"><span>Rule from dispatch</span><code></code></p>
    </section>`;
    this.q(".bk-rule code").textContent = this.rule;
    this.q<HTMLButtonElement>(".bk-key").onclick = () => this.turnKey();
    this.q<HTMLButtonElement>(".bk-lever").onclick = () => this.pullLever();
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "BUTTON" || e.repeat) return;
      if (e.code === "KeyK") this.turnKey();
      else if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); this.pullLever(); }
    };
    window.addEventListener("keydown", onKey);
    this.events.once("shutdown", () => window.removeEventListener("keydown", onKey));
    // The needle never sits quite still under a surge.
    const line = this.q(".bk-needle");
    this.events.on("update", (t: number) => {
      if (!alive.on) return;
      const mw = this.done ? 96 : Number(LIVE.load) + Math.sin(t / 170) * 0.7 + Math.sin(t / 53) * 0.4;
      line.setAttribute("transform", `rotate(${needle(mw).toFixed(2)} 60 62)`);
    });
  }

  private turnKey() {
    if (this.done) return;
    sfx.unlock();
    this.key = !this.key;
    const b = this.q<HTMLButtonElement>(".bk-key");
    b.setAttribute("aria-pressed", String(this.key));
    b.textContent = `Override key ${this.key ? "on" : "off"}`;
    if (this.key) sfx.lightOn(); else sfx.lightOff();
  }

  private pullLever() {
    if (this.done) return;
    sfx.unlock();
    const result = pull(this.rule, this.key);
    this.info.transport.send({ t: "lever", result });
    const lever = this.q(".bk-lever");
    lever.classList.add("pulled");
    this.time.delayedCall(260, () => lever.classList.remove("pulled"));
    if (result === "closed") return this.close();
    sfx.denied();
    this.cameras.main.shake(200, 0.006);
    this.hud.toast(result === "locked"
      ? "It won't move. The breaker is locked because its rule fails a safety test. Ask your Guide to fix it."
      : `It tripped${this.key ? ", even with the override key on" : ""}. Load reads ${LIVE.load} MW, over the ${LIVE.capacity} MW capacity.`, 4500);
  }

  private close() {
    this.done = true;
    this.root.classList.add("closed");
    this.q(".bk-state").textContent = "Closed";
    sfx.substation();
    this.cameras.main.flash(260, 255, 211, 138);
    this.hud.card("Breaker closed", "22:09 · The main line holds.", 2400);
    const s = this.info.stats;
    const stats = s && { ms: s.ms + Math.round(performance.now() - this.t0), caught: s.caught };
    this.time.delayedCall(2200, () => {
      this.info.transport.send({ t: "ending", ...stats });
      this.toEnding("runner", stats);
    });
  }

  private toEnding(role: Role, stats?: RunStats) {
    this.root.classList.add("gone");
    this.time.delayedCall(600, () => this.scene.start("ending", { ...this.info, role, district: LEVELS.length - 1, stats }));
  }

  private guidePanel() {
    const vars = VARIABLES.map((v) => `<li><code>${v.name}</code><em>${v.type}</em><span>${esc(v.about)}</span></li>`).join("");
    const tests = TESTS.map((t) => `<li><i class="mark"></i><span>${esc(t.name)}</span><b>${t.close ? "Must close" : "Must stay open"}</b>
      <small>${Object.entries(t.r).map(([k, v]) => `${k} ${v}`).join(" · ")}</small></li>`).join("");
    this.root.innerHTML = `<section class="bk-panel" aria-label="Main breaker rule">
      <header><span class="bk-tag">Main breaker rule</span><span class="bk-state">No camera</span></header>
      <p>There's no camera at the breaker. It closes when this rule comes out true. Fix the rule so every safety test passes, then install it. Only the Runner can read the live gauges.</p>
      <textarea class="bk-text" rows="2" maxlength="${MAX_RULE}" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="Breaker rule"></textarea>
      <p class="bk-err" role="alert"></p>
      <div class="bk-row"><button class="bk-install" type="button">Install rule</button><span class="bk-installed">Installed: <code></code></span></div>
      <h4>Readings</h4><ul class="bk-vars">${vars}</ul>
      <h4>Safety tests</h4><ol class="bk-tests">${tests}</ol>
      <p class="bk-last" role="status"></p>
    </section>`;
    const text = this.q<HTMLTextAreaElement>(".bk-text"), install = this.q<HTMLButtonElement>(".bk-install");
    text.value = this.rule;
    this.q(".bk-installed code").textContent = this.rule;
    const refresh = () => {
      const c = check(text.value);
      this.q(".bk-err").textContent = c.error ?? "";
      this.root.querySelectorAll(".bk-tests li").forEach((li, i) => {
        li.classList.toggle("pass", !c.error && c.pass[i] === true);
        li.classList.toggle("fail", !c.error && c.pass[i] === false);
      });
      install.disabled = !safe(c) || text.value === this.rule;
      install.title = safe(c) ? "" : "Pass every safety test first";
    };
    const send = () => {
      if (install.disabled) return;
      sfx.unlock();
      this.rule = text.value;
      this.info.transport.send({ t: "rule", rule: this.rule });
      this.q(".bk-installed code").textContent = this.rule;
      sfx.ping();
      this.q(".bk-last").textContent = "Rule installed. Ask the Runner to pull the lever.";
      refresh();
    };
    text.oninput = refresh;
    text.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
    install.onclick = send;
    refresh();
  }

  private onMsg(m: Msg) {
    switch (m.t) {
      case "rule":
        if (this.info.role !== "runner" || typeof m.rule !== "string") return;
        this.rule = m.rule.slice(0, MAX_RULE);
        this.q(".bk-rule code").textContent = this.rule;
        if (!this.info.local) sfx.ping();
        this.hud.toast("Dispatch installed a new rule.");
        return;
      case "lever": {
        if (this.info.role !== "guide") return;
        const say: Record<Pull, string> = {
          closed: "The breaker closed.",
          locked: "The Runner pulled the lever, but the breaker is locked. Its rule has to pass every safety test.",
          tripped: "The Runner pulled the lever and the breaker tripped. Ask what the gauges read.",
        };
        this.q(".bk-last").textContent = say[m.result] ?? "";
        if (m.result !== "closed" && !this.info.local) sfx.denied();
        if (m.result === "closed") { this.root.classList.add("closed"); this.q(".bk-state").textContent = "Closed"; }
        return;
      }
      case "ending":
        if (this.info.role === "guide") this.toEnding("guide", m.ms === undefined ? undefined : { ms: m.ms, caught: m.caught ?? 0 });
        return;
    }
  }
}
