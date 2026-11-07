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
.bk{--night:#0b1020;--edge:#2c3758;--amber:#ffd38a;--red:#ff4d5e;--green:#4dff88;--ink:#e8ecff;--dim:#a9b1d6;--faint:#7d87b2;--line:rgba(232,236,255,.45);
  --din:"DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow",sans-serif-condensed,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  position:absolute;inset:0;display:flex;overflow:auto;padding:124px 12px 16px;box-sizing:border-box;font:13.5px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);
  background-color:var(--night);background-image:linear-gradient(rgba(44,55,88,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(44,55,88,.3) 1px,transparent 1px);background-size:32px 32px;transition:opacity .6s ease}
.bk ::selection{background:var(--amber);color:var(--night)}
.bk.gone{opacity:0}
.bk-panel{margin:auto;width:min(100%,560px);box-sizing:border-box;display:flex;flex-direction:column;gap:14px}
.bk.runner .bk-panel{background:radial-gradient(ellipse 70% 60% at 50% 40%,var(--glow),transparent 72%)}
.bk-tb{display:flex;border:1.5px solid var(--ink);background:var(--night)}
.bk-cell{display:flex;flex-direction:column;justify-content:center;gap:5px;min-width:0;padding:9px 12px;box-shadow:inset -1px 0 0 var(--line)}
.bk-cell:last-child{box-shadow:none}
.bk-k{font:600 9.5px/1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.bk-v{font:700 18px/1 var(--din);font-stretch:condensed;letter-spacing:.08em;text-transform:uppercase;padding-top:2px}
.bk-state{color:var(--red)}
.bk.closed .bk-state{color:var(--green)}
.bk ol{margin:0;padding:0 0 0 26px;display:grid;gap:6px;color:var(--dim)}
.bk ol li::marker{font:600 12px var(--mono);color:var(--amber)}
.bk ol b{color:var(--ink);font-weight:600}
.bk code{font:13px/1.3 var(--mono);color:var(--ink)}
.bk-diagram{display:block;width:100%;height:auto;overflow:visible}
.bk-blade{transform-box:view-box;transform-origin:110px 70px;transition:transform .5s cubic-bezier(.34,1.4,.64,1)}
.bk.closed .bk-blade{transform:rotate(32deg)}
.bk.trip .bk-redarc{animation:bk-flash .18s steps(1) 4}
@keyframes bk-flash{50%{stroke:var(--ink)}}
.bk.trip .bk-panel{animation:bk-shake .3s cubic-bezier(.36,.07,.19,.97)}
@keyframes bk-shake{20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}
.bk button{font:700 17px/1 var(--din);font-stretch:condensed;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;touch-action:manipulation;
  min-height:52px;padding:2px 18px 0;border:0;background:transparent;color:var(--ink);transition:transform .12s cubic-bezier(.23,1,.32,1),background-color .15s,color .15s}
.bk button:active:not(:disabled){transform:scale(.97)}
.bk button:focus-visible{outline:2px solid var(--amber);outline-offset:-4px}
.bk button:disabled{cursor:not-allowed;color:var(--faint)}
.bk-controls{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr)}
.bk-controls button+button{border-left:1px solid var(--line)}
.bk-key[aria-pressed=true]{color:var(--night);background:var(--amber)}
.bk-lever{box-shadow:inset 0 0 0 1.5px var(--red);background:rgba(255,77,94,.08)!important}
@media (hover:hover){.bk-lever:hover{background:rgba(255,77,94,.18)!important}.bk-install:not(:disabled):hover{background:rgba(255,211,138,.14)}}
.bk-lever.pulled{transform:translateY(3px)}
.bk-text{display:block;width:100%;box-sizing:border-box;min-height:58px;padding:6px 2px;resize:vertical;font:16px/1.4 var(--mono);color:var(--ink);background:transparent;
  border:0;border-bottom:1.5px solid var(--ink);border-radius:0;caret-color:var(--amber)}
.bk-text:focus{outline:none;border-bottom-color:var(--amber)}
.bk-err{min-height:1.45em;margin:0;color:var(--red)}
.bk-row{display:flex;align-items:stretch;border:1.5px solid var(--ink)}
.bk-install{border-right:1px solid var(--line)!important}
.bk-installed{display:flex;flex-direction:column;justify-content:center;gap:4px;padding:6px 12px;min-width:0}
.bk-installed code{overflow-wrap:anywhere}
.bk-vars{display:grid;grid-template-columns:auto auto 1fr;gap:4px 14px;margin:0;color:var(--dim)}
.bk-vars dt{font:600 13px var(--mono);color:var(--ink)}
.bk-vars dd{margin:0}
.bk-vars .t{font:12px var(--mono);color:var(--faint)}
.bk-tests{border-collapse:collapse;width:100%;border:1.5px solid var(--ink)}
.bk-tests td,.bk-tests th{padding:7px 10px;border-top:1px solid var(--line);text-align:left;vertical-align:baseline}
.bk-tests th{font:600 9.5px/1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--faint);border-top:0}
.bk-tests small{display:block;margin-top:3px;font:11.5px/1.3 var(--mono);color:var(--faint)}
.bk-tests .exp{font:700 13px/1 var(--din);letter-spacing:.1em;text-transform:uppercase;color:var(--dim);white-space:nowrap}
.bk-tests .mark{width:14px;font:700 15px var(--mono);color:var(--faint)}
.bk-tests .mark::before{content:"·"}
.bk-tests .pass .mark{color:var(--green)}.bk-tests .pass .mark::before{content:"✓"}
.bk-tests .fail .mark{color:var(--red)}.bk-tests .fail .mark::before{content:"✗"}
.bk-last{min-height:1.45em;margin:0;color:var(--ink)}
.bk-last:not(:empty)::before{content:"NOTE";margin-right:10px;font:600 11px var(--mono);letter-spacing:.06em;color:var(--amber);border-bottom:1px solid var(--amber)}
.hud.breaker .objective,.hud.breaker .bottom{display:none}
.hud.breaker .toast{bottom:22px}
@media (prefers-reduced-motion:reduce){.bk,.bk *{transition:none!important;animation:none!important}}
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
    this.root.style.setProperty("--glow", rgba(hex(this.info.lantern ?? LEVELS.at(-1)!.lantern), 0.14));
    // The load gauge is an instrument on the diagram: a 0-150 MW arc, red past capacity.
    const at = (mw: number, r: number) => { const a = (needle(mw) * Math.PI) / 180; return [330 + r * Math.sin(a), 150 - r * Math.cos(a)].map((n) => n.toFixed(1)).join(" "); };
    this.root.innerHTML = `<section class="bk-panel" aria-label="Main breaker">
      <div class="bk-tb"><div class="bk-cell" style="flex:1"><span class="bk-k">Detail B</span><span class="bk-v">Main breaker</span></div><div class="bk-cell"><span class="bk-k">State</span><span class="bk-v bk-state">Open</span></div></div>
      <svg class="bk-diagram" viewBox="0 0 480 236" fill="none" stroke="#e8ecff" stroke-width="1.5" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="12" aria-hidden="true">
        <text x="0" y="16" fill="#a9b1d6" stroke="none" font-family="system-ui,sans-serif" font-size="11" letter-spacing="1.6">MAIN LINE</text>
        <path d="M0 26H480"/>
        <path d="M110 26V70"/><circle cx="110" cy="70" r="3" fill="#e8ecff"/>
        <path class="bk-blade" d="M110 70L130 102" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="110" cy="108" r="3" fill="#e8ecff"/><path d="M110 108V150H40"/><path d="M40 144l-10 6 10 6" fill="#e8ecff" stroke="none"/>
        <text x="132" y="78" fill="#a9b1d6" stroke="none">CB-1</text><text x="20" y="176" fill="#a9b1d6" stroke="none">TO THE CITY</text>
        <path d="M330 26V82" stroke-dasharray="4 4" stroke="#7d87b2"/>
        <path d="M${at(0, 58)}A58 58 0 0 1 ${at(Number(LIVE.capacity), 58)}" stroke="#2c3758" stroke-width="6"/>
        <path class="bk-redarc" d="M${at(Number(LIVE.capacity), 58)}A58 58 0 0 1 ${at(150, 58)}" stroke="#ff4d5e" stroke-width="6"/>
        <line class="bk-needle" x1="330" y1="150" x2="330" y2="100" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="330" cy="150" r="4" fill="#e8ecff"/>
        <text x="330" y="180" text-anchor="middle" fill="#a9b1d6" stroke="none" font-family="system-ui,sans-serif" font-size="11" letter-spacing="1.6">LOAD</text>
        <text x="330" y="206" text-anchor="middle" fill="#ff4d5e" stroke="none" font-size="22" font-weight="600">${LIVE.load} MW</text>
        <text x="330" y="226" text-anchor="middle" fill="#a9b1d6" stroke="none">CAPACITY ${LIVE.capacity} MW</text>
        <path d="M450 26V96"/><circle cx="450" cy="112" r="16" stroke="#4dff88"/><path d="M439 101l22 22M461 101l-22 22" stroke="#4dff88"/>
        <text x="450" y="148" text-anchor="middle" fill="#a9b1d6" stroke="none">LINE</text><text x="450" y="162" text-anchor="middle" fill="#a9b1d6" stroke="none">CLEAR</text>
      </svg>
      <ol><li>Read these gauges to your Guide. <b>K</b> turns the override key. <b>Space</b> pulls the lever.</li>
        <li><b>Restart surge.</b> If the load runs over capacity, turn the override key, then close the breaker.</li></ol>
      <div class="bk-tb bk-controls"><button class="bk-key" type="button" aria-pressed="false">Override key off</button><button class="bk-lever" type="button">Pull the lever</button></div>
      <div class="bk-tb"><div class="bk-cell" style="flex:1"><span class="bk-k">Rule from dispatch</span><code class="bk-rule"></code></div></div>
    </section>`;
    this.q(".bk-rule").textContent = this.rule;
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
    // Meter ballistics: the needle has mass, swings up from zero, overshoots, and trembles under the surge.
    const line = this.q(".bk-needle");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let mw = reduce ? Number(LIVE.load) : 0, v = 0, last = -1;
    this.events.on("update", (t: number) => {
      if (!alive.on) return;
      const dt = last < 0 ? 0 : Math.min(0.05, (t - last) / 1000);
      last = t;
      const target = (this.done ? 96 : Number(LIVE.load)) + (reduce ? 0 : Math.sin(t / 170) * 0.7 + Math.sin(t / 53) * 0.4);
      v += ((target - mw) * 60 - v * 9) * dt;
      mw += v * dt;
      if (reduce) mw = target;
      line.setAttribute("transform", `rotate(${needle(mw).toFixed(2)} 330 150)`);
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
    this.root.classList.remove("trip");
    void this.root.offsetWidth;
    this.root.classList.add("trip");
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
    const vars = VARIABLES.map((v) => `<dt>${v.name}</dt><dd class="t">${v.type}</dd><dd>${esc(v.about)}</dd>`).join("");
    const tests = TESTS.map((t) => `<tr><td class="mark"></td><td>${esc(t.name)}<small>${Object.entries(t.r).map(([k, v]) => `${k} ${v}`).join(" · ")}</small></td><td class="exp">${t.close ? "Must close" : "Must stay open"}</td></tr>`).join("");
    this.root.innerHTML = `<section class="bk-panel" aria-label="Main breaker rule">
      <div class="bk-tb"><div class="bk-cell" style="flex:1"><span class="bk-k">Detail B</span><span class="bk-v">Main breaker rule</span></div><div class="bk-cell"><span class="bk-k">Breaker</span><span class="bk-v bk-state">Open</span></div></div>
      <ol><li>There's no camera at the breaker. It closes when this rule comes out true.</li><li>Fix the rule so every safety test passes, then install it. Only the Runner can read the live gauges.</li></ol>
      <label class="bk-k" for="bk-text">Rule</label>
      <textarea id="bk-text" class="bk-text" rows="2" maxlength="${MAX_RULE}" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
      <p class="bk-err" role="alert"></p>
      <div class="bk-row"><button class="bk-install" type="button">Install rule</button><span class="bk-installed"><span class="bk-k">Installed</span><code></code></span></div>
      <dl class="bk-vars">${vars}</dl>
      <table class="bk-tests"><thead><tr><th></th><th>Safety test</th><th>Expect</th></tr></thead><tbody>${tests}</tbody></table>
      <p class="bk-last" role="status"></p>
    </section>`;
    const text = this.q<HTMLTextAreaElement>(".bk-text"), install = this.q<HTMLButtonElement>(".bk-install");
    text.value = this.rule;
    this.q(".bk-installed code").textContent = this.rule;
    const refresh = () => {
      const c = check(text.value);
      this.q(".bk-err").textContent = c.error ?? "";
      this.root.querySelectorAll(".bk-tests tbody tr").forEach((tr, i) => {
        tr.classList.toggle("pass", !c.error && c.pass[i] === true);
        tr.classList.toggle("fail", !c.error && c.pass[i] === false);
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
        this.q(".bk-rule").textContent = this.rule;
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
