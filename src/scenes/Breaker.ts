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
  position:absolute;inset:0;display:flex;overflow:auto;padding:124px 16px 20px;box-sizing:border-box;container-type:inline-size;
  font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);
  background-color:var(--night);background-image:linear-gradient(rgba(44,55,88,.3) 1px,transparent 1px),linear-gradient(90deg,rgba(44,55,88,.3) 1px,transparent 1px);background-size:32px 32px;transition:opacity .6s ease}
.bk ::selection{background:var(--amber);color:var(--night)}
.bk.gone{opacity:0}
.bk-panel{margin:auto;width:min(100%,560px);box-sizing:border-box;display:flex;flex-direction:column;gap:18px}
.bk-cols{display:grid;gap:18px}
.bk-col{display:flex;flex-direction:column;gap:14px;min-width:0}
@container (min-width:900px){.bk-panel{width:min(100%,1080px)}.bk-cols{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:36px;align-items:start}}
.bk.runner .bk-diagram{background:radial-gradient(ellipse 60% 55% at 60% 55%,var(--glow),transparent 72%)}
.bk-tb{display:flex;border:1.5px solid var(--ink);background:var(--night)}
.bk-cell{display:flex;flex-direction:column;justify-content:center;gap:6px;min-width:0;padding:10px 14px;box-shadow:inset -1px 0 0 var(--line)}
.bk-cell:last-child{box-shadow:none}
.bk-k{font:600 11px/1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.bk-v{font:700 20px/1 var(--din);font-stretch:condensed;letter-spacing:.08em;text-transform:uppercase;padding-top:2px}
.bk-state{color:var(--red)}
.bk.closed .bk-state{color:var(--green)}
.bk code{font:13px/1.35 var(--mono);color:var(--ink)}

/* Steps: what to do now. Done steps tick off, the current one is bright, later ones wait their turn. */
.bk-steps{margin:0;padding:0;list-style:none;display:grid;gap:10px;counter-reset:s}
.bk-steps li{counter-increment:s;display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:baseline;color:var(--faint);transition:color .2s}
.bk-steps li::before{content:counter(s);font:600 13px/1 var(--mono);color:var(--faint);padding:4px 0;text-align:center;border:1px solid var(--edge)}
.bk-steps li.cur{color:var(--ink);font-size:15px}
.bk-steps li.cur::before{color:var(--night);background:var(--amber);border-color:var(--amber)}
.bk-steps li.done{color:var(--faint)}
.bk-steps li.done::before{content:"";align-self:stretch;max-height:22px;border-color:transparent;background:var(--green);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M2 7.5l3.2 3.2L12 4' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/14px no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M2 7.5l3.2 3.2L12 4' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/14px no-repeat}
.bk-steps b{font-weight:600;color:inherit}

.bk-diagram{display:block;width:100%;height:auto;overflow:visible}
.bk-blade{transform-box:view-box;transform-origin:110px 70px;transition:transform .5s cubic-bezier(.34,1.4,.64,1)}
.bk.closed .bk-blade{transform:rotate(32deg)}
.bk-keyon{opacity:0;transition:opacity .15s}
.bk.keyed .bk-keyon{opacity:1}
.bk.trip .bk-redarc{animation:bk-flash .18s steps(1) 4}
@keyframes bk-flash{50%{stroke:var(--ink)}}
.bk.trip .bk-diagram{animation:bk-shake .3s cubic-bezier(.36,.07,.19,.97)}
@keyframes bk-shake{20%{transform:translateX(-4px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}}

.bk button{font:700 17px/1 var(--din);font-stretch:condensed;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;
  min-height:52px;padding:2px 18px 0;border:0;background:transparent;color:var(--ink);transition:transform .12s cubic-bezier(.23,1,.32,1),background-color .15s,color .15s}
.bk button:active:not(:disabled){transform:scale(.97)}
.bk button:focus-visible{outline:2px solid var(--amber);outline-offset:-4px}
.bk button:disabled{cursor:not-allowed;color:var(--faint)}
.bk-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.bk-controls button+button{box-shadow:inset 1px 0 0 var(--line)}
.bk-key[aria-pressed=true]{color:var(--night);background:var(--amber)}
.bk-lever{outline:1.5px solid var(--red);outline-offset:-1.5px;background:rgba(255,77,94,.08)!important}
@media (hover:hover){.bk-lever:hover{background:rgba(255,77,94,.18)!important}.bk-install:not(:disabled):hover,.bk-pad button:hover{background:rgba(255,211,138,.14)}}
.bk-lever.pulled{transform:translateY(3px)}

.bk-text{display:block;width:100%;box-sizing:border-box;min-height:52px;padding:6px 2px;resize:none;font:17px/1.4 var(--mono);color:var(--ink);background:transparent;
  border:0;border-bottom:1.5px solid var(--ink);border-radius:0;caret-color:var(--amber)}
.bk-text:focus{outline:none;border-bottom-color:var(--amber)}
/* Keypad: tap a piece of the rule instead of typing symbols on a phone keyboard. */
.bk-pad{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1.5px solid var(--ink);background:var(--night)}
.bk-pad button{min-height:44px;padding:2px 6px 0;font:600 14px/1 var(--mono);letter-spacing:0;text-transform:none;box-shadow:inset -1px -1px 0 var(--line)}
.bk-pad button small{display:block;margin-top:4px;font:600 11px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--faint)}
.bk-pad .name{color:var(--amber)}
.bk-pad .del{font:700 15px/1 var(--din);font-stretch:condensed;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.bk-err{min-height:1.45em;margin:-4px 0 0;color:var(--red)}
.bk-row{display:flex;align-items:stretch;border:1.5px solid var(--ink)}
.bk-install{box-shadow:inset -1px 0 0 var(--line)}
.bk-install:not(:disabled){color:var(--night);background:var(--amber)}
.bk-installed{display:flex;flex-direction:column;justify-content:center;gap:5px;padding:8px 14px;min-width:0}
.bk-installed code{overflow-wrap:anywhere}

.bk-tests{border-collapse:collapse;width:100%;border:1.5px solid var(--ink);font-variant-numeric:tabular-nums}
.bk-tests td,.bk-tests th{padding:9px 8px;border-top:1px solid var(--line);text-align:left;vertical-align:middle}
.bk-tests th{font:700 13px/1.2 var(--din);font-stretch:condensed;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);border-top:0;padding-top:10px}
.bk-tests th.id{font:600 11px/1.2 var(--mono);letter-spacing:0;text-transform:none}
.bk-tests th:first-child,.bk-tests td:first-child{padding-left:12px}
.bk-tests .val{font:13px/1 var(--mono);color:var(--dim)}
.bk-tests .val.f{color:var(--faint)}
.bk-tests .exp{font:700 14px/1 var(--din);letter-spacing:.08em;text-transform:uppercase;color:var(--dim);white-space:nowrap}
.bk-tests .mark{width:18px;text-align:center}
.bk-tests .mark::before{content:"";display:inline-block;vertical-align:middle;width:5px;height:5px;border-radius:50%;background:var(--faint)}
.bk-tests .pass .mark::before,.bk-tests .fail .mark::before{width:14px;height:14px;border-radius:0}
.bk-tests .pass .mark::before{background:var(--green);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M2 7.5l3.2 3.2L12 4' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/14px no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M2 7.5l3.2 3.2L12 4' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/14px no-repeat}
.bk-tests .fail .mark::before{background:var(--red);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M3 3l8 8M11 3l-8 8' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/14px no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpath d='M3 3l8 8M11 3l-8 8' fill='none' stroke='black' stroke-width='2'/%3E%3C/svg%3E") center/14px no-repeat}
.bk-tests .fail{background:rgba(255,77,94,.06)}
.bk-vars{display:grid;grid-template-columns:auto 1fr;gap:5px 14px;margin:0;color:var(--dim);font-size:13px}
.bk-vars dt{font:600 13px var(--mono);color:var(--amber)}
.bk-vars dd{margin:0}
.bk-last{min-height:1.45em;margin:0;color:var(--ink)}
.bk-last:not(:empty)::before{content:"NOTE";margin-right:10px;font:700 14px var(--din);letter-spacing:.12em;color:var(--amber);border-bottom:1px solid var(--amber)}
.hud.breaker .objective,.hud.breaker .bottom{display:none}
.hud.breaker .toast{bottom:22px}
@container (max-width:559px){.bk-steps li.done{display:none}}
@container (max-width:559px){.hud.breaker.runner .toast{bottom:auto;top:52px}}
@container (max-width:479px){.bk-tests th,.bk-tests td{padding:8px 5px}.bk-tests .val{font-size:12px}.bk-pad button{font-size:13px}}
@media (prefers-reduced-motion:reduce){.bk,.bk *{transition:none!important;animation:none!important}}
`;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const rgba = (c: number, a: number) => `rgba(${c >> 16},${(c >> 8) & 255},${c & 255},${a})`;

/** Angle of the load gauge's needle for a reading, on a 0-150 MW dial. */
const needle = (mw: number) => -90 + (180 * Math.min(150, Math.max(0, mw))) / 150;

/** Pieces of a rule the Guide can tap in, with a plain word under each symbol. */
const KEYS: [string, string, string][] = [ // insert, label, plain word ("" for reading names)
  [" && ", "&&", "and"], [" || ", "||", "or"], ["!", "!", "not"], [" < ", "<", "less"],
  ["(", "(", ""], [")", ")", ""], ["load", "load", ""], ["capacity", "capacity", ""],
  ["line_clear", "line_clear", ""], ["override", "override", ""], [" > ", ">", "more"], ["DEL", "Delete", ""],
];

type Step = { text: string; show?: () => boolean; done: () => boolean };

/**
 * The last room: the main breaker. The Runner reads the gauges, turns the override key, and pulls
 * the lever. The Guide has no camera here; they edit the breaker's rule against three safety tests.
 * Each side gets a short list of steps that advances as the two of them get through it.
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
  private tripped = false; // a lever pull has tripped on the live surge
  private pulled = false; // runner: pulled since the last rule arrived; guide: a pull came back since the last install
  private ruleArrived = false;
  private steps: Step[] = [];

  constructor() { super("breaker"); }

  init(data: BreakerData) {
    this.info = data;
    this.rule = typeof data.rule === "string" ? data.rule : BROKEN_RULE;
    this.key = false;
    this.done = false;
    this.tripped = false;
    this.pulled = false;
    this.ruleArrived = false;
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
    this.renderSteps();
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

  /** Redraws the step list: finished steps tick off, the first unfinished one is current. */
  private renderSteps() {
    let current = false;
    this.q(".bk-steps").replaceChildren(...this.steps.filter((s) => s.show?.() ?? true).map((s) => {
      const li = document.createElement("li");
      const finished = s.done();
      li.className = finished ? "done" : current ? "" : "cur";
      if (!finished) current = true;
      li.innerHTML = `<span>${s.text}</span>`; // constant strings from this file; one span keeps the text in one grid cell
      return li;
    }));
  }

  private runnerPanel(alive: { on: boolean }) {
    this.root.style.setProperty("--glow", rgba(hex(this.info.lantern ?? LEVELS.at(-1)!.lantern), 0.16));
    this.steps = [
      { text: "Your Guide is rewriting the breaker's rule. Read them the gauges: <b>load</b>, <b>capacity</b> and <b>line clear</b>.", done: () => this.ruleArrived },
      { text: "When they install a rule, pull the lever (<b>Space</b> or the button).", done: () => this.pulled || this.tripped },
      { text: "The load is over capacity, so it tripped. Turn the <b>override key</b> (<b>K</b>) and tell your Guide it's on.", show: () => this.tripped, done: () => this.key || this.done },
      { text: "Pull again once your Guide adds the key to the rule.", show: () => this.tripped, done: () => this.done },
    ];
    // The load gauge is an instrument on the diagram: a 0-150 MW arc, red past capacity.
    const at = (mw: number, r: number) => { const a = (needle(mw) * Math.PI) / 180; return [330 + r * Math.sin(a), 150 - r * Math.cos(a)].map((n) => n.toFixed(1)).join(" "); };
    this.root.innerHTML = `<section class="bk-panel" aria-label="Main breaker">
      <div class="bk-tb"><div class="bk-cell" style="flex:1"><span class="bk-v">Main breaker</span></div><div class="bk-cell"><span class="bk-k">Breaker</span><span class="bk-v bk-state">Open</span></div></div>
      <div class="bk-cols">
        <svg class="bk-diagram" viewBox="0 0 480 240" fill="none" stroke="#e8ecff" stroke-width="1.5" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="13" aria-hidden="true">
          <text x="0" y="16" fill="#a9b1d6" stroke="none" font-family="'DIN Condensed',Bahnschrift,'Arial Narrow',sans-serif" font-size="15" font-weight="700" letter-spacing="2">MAIN LINE</text>
          <path d="M0 26H480"/>
          <path d="M110 26V70"/><circle cx="110" cy="70" r="3" fill="#e8ecff"/>
          <path class="bk-blade" d="M110 70L130 102" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="110" cy="108" r="3" fill="#e8ecff"/><path d="M110 108V150H40"/><path d="M40 144l-10 6 10 6" fill="#e8ecff" stroke="none"/>
          <text x="140" y="74" fill="#a9b1d6" stroke="none" font-family="'DIN Condensed',Bahnschrift,'Arial Narrow',sans-serif" font-size="15" font-weight="700" letter-spacing="1">CB-1</text>
          <rect x="140" y="88" width="12" height="12" stroke="#ffd38a"/><rect class="bk-keyon" x="142.5" y="90.5" width="7" height="7" fill="#ffd38a" stroke="none"/>
          <text x="160" y="99" fill="#ffd38a" stroke="none">override <tspan class="bk-keytxt">false</tspan></text>
          <text x="20" y="178" fill="#a9b1d6" stroke="none" font-family="'DIN Condensed',Bahnschrift,'Arial Narrow',sans-serif" font-size="15" font-weight="700" letter-spacing="2">TO THE CITY</text>
          <path d="M330 26V82" stroke-dasharray="4 4" stroke="#7d87b2"/>
          <path d="M${at(0, 58)}A58 58 0 0 1 ${at(Number(LIVE.capacity), 58)}" stroke="#2c3758" stroke-width="6"/>
          <path class="bk-redarc" d="M${at(Number(LIVE.capacity), 58)}A58 58 0 0 1 ${at(150, 58)}" stroke="#ff4d5e" stroke-width="6"/>
          <line class="bk-needle" x1="330" y1="150" x2="330" y2="100" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="330" cy="150" r="4" fill="#e8ecff"/>
          <text x="330" y="182" text-anchor="middle" fill="#ff4d5e" stroke="none" font-size="22" font-weight="600">load ${LIVE.load}</text>
          <text x="330" y="204" text-anchor="middle" fill="#e8ecff" stroke="none">capacity ${LIVE.capacity}</text>
          <text x="330" y="222" text-anchor="middle" fill="#7d87b2" stroke="none" font-family="system-ui,sans-serif" font-size="11">megawatts</text>
          <path d="M450 26V96"/><circle cx="450" cy="112" r="16" stroke="#4dff88"/><path d="M439 101l22 22M461 101l-22 22" stroke="#4dff88"/>
          <text x="450" y="150" text-anchor="middle" fill="#e8ecff" stroke="none">line_clear</text><text x="450" y="167" text-anchor="middle" fill="#4dff88" stroke="none">true</text>
        </svg>
        <div class="bk-col">
          <div class="bk-tb bk-controls"><button class="bk-key" type="button" aria-pressed="false">Override off</button><button class="bk-lever" type="button">Pull the lever</button></div>
          <ol class="bk-steps"></ol>
          <div class="bk-tb"><div class="bk-cell" style="flex:1"><span class="bk-k">Rule from your Guide</span><code class="bk-rule"></code></div></div>
        </div>
      </div>
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
    b.textContent = `Override ${this.key ? "on" : "off"}`;
    this.root.classList.toggle("keyed", this.key);
    this.q(".bk-keytxt").textContent = String(this.key);
    if (this.key) sfx.lightOn(); else sfx.lightOff();
    this.renderSteps();
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
    this.hud.el.querySelector(".intro")?.classList.add("off"); // the result toast takes the call note's place
    this.pulled = true;
    if (result === "tripped") this.tripped = true;
    this.renderSteps();
    sfx.denied();
    this.root.classList.remove("trip");
    void this.root.offsetWidth;
    this.root.classList.add("trip");
    this.hud.toast(result === "locked"
      ? "It won't move. The rule fails a safety test, so the breaker stays locked until your Guide fixes it."
      : `It tripped${this.key ? ", even with the override key on" : ""}. Load reads ${LIVE.load}, over the ${LIVE.capacity} capacity.`, 4500);
  }

  private close() {
    this.done = true;
    this.root.classList.add("closed");
    this.q(".bk-state").textContent = "Closed";
    this.renderSteps();
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
    const yes = (v: boolean | bigint) => (typeof v === "boolean" ? `<td class="val${v ? "" : " f"}">${v}</td>` : `<td class="val">${v}</td>`);
    const tests = TESTS.map((t) => `<tr><td>${esc(t.name)}</td>${yes(t.r.load)}${yes(t.r.capacity)}${yes(t.r.line_clear)}${yes(t.r.override)}<td class="exp">${t.close ? "Close" : "Stay open"}</td><td class="mark"></td></tr>`).join("");
    const vars = VARIABLES.map((v) => `<dt>${v.name}</dt><dd>${esc(v.about)}</dd>`).join("");
    const pad = KEYS.map(([, label, word], i) => `<button type="button" data-i="${i}" class="${label === "Delete" ? "del" : word ? "" : label.length > 1 ? "name" : ""}" aria-label="${esc(word || label)}">${esc(label)}${word ? `<small>${word}</small>` : ""}</button>`).join("");
    this.root.innerHTML = `<section class="bk-panel" aria-label="Main breaker rule">
      <div class="bk-tb"><div class="bk-cell" style="flex:1"><span class="bk-v">Main breaker rule</span></div><div class="bk-cell"><span class="bk-k">Breaker</span><span class="bk-v bk-state">Open</span></div></div>
      <div class="bk-cols">
        <div class="bk-col">
          <ol class="bk-steps"></ol>
          <label class="bk-k" for="bk-text">Rule · it closes the breaker when it comes out true</label>
          <textarea id="bk-text" class="bk-text" rows="2" maxlength="${MAX_RULE}" spellcheck="false" autocapitalize="off" autocomplete="off"></textarea>
          <div class="bk-pad" role="group" aria-label="Insert into the rule">${pad}</div>
          <p class="bk-err" role="alert"></p>
          <div class="bk-row"><button class="bk-install" type="button">Install rule</button><span class="bk-installed"><span class="bk-k">Installed at the breaker</span><code></code></span></div>
        </div>
        <div class="bk-col">
          <table class="bk-tests"><thead><tr><th>Safety test</th><th class="id">load</th><th class="id">capacity</th><th class="id">line_clear</th><th class="id">override</th><th>Expect</th><th></th></tr></thead><tbody>${tests}</tbody></table>
          <dl class="bk-vars">${vars}</dl>
          <p class="bk-last" role="status"></p>
        </div>
      </div>
    </section>`;
    const text = this.q<HTMLTextAreaElement>(".bk-text"), install = this.q<HTMLButtonElement>(".bk-install");
    this.steps = [
      { text: "Fix the rule until all three safety tests pass. Tap the keys or type.", done: () => safe(check(text.value)) || safe(check(this.rule)) },
      { text: "Install it, then ask the Runner to pull the lever.", done: () => (this.pulled && safe(check(this.rule))) || this.tripped },
      { text: "It tripped, so something live is wrong, and only the Runner can see the gauges. Ask them what they read.", show: () => this.tripped, done: () => text.value.includes("override") || this.done },
      { text: "Add <b>override</b> to the rule without failing a test, install it, and have the Runner pull again.", show: () => this.tripped, done: () => this.done },
    ];
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
      this.renderSteps();
    };
    const send = () => {
      if (install.disabled) return;
      sfx.unlock();
      this.rule = text.value;
      this.pulled = false;
      this.info.transport.send({ t: "rule", rule: this.rule });
      this.q(".bk-installed code").textContent = this.rule;
      sfx.ping();
      this.q(".bk-last").textContent = "Rule installed. Ask the Runner to pull the lever.";
      refresh();
    };
    // Keypad: insert at the caret, keep the rule's spacing tidy, and keep focus where it was.
    this.root.querySelectorAll<HTMLButtonElement>(".bk-pad button").forEach((b) => {
      b.onpointerdown = (e) => e.preventDefault();
      b.onclick = () => {
        const [ins] = KEYS[Number(b.dataset.i)];
        const s = text.selectionStart ?? text.value.length, e = text.selectionEnd ?? s;
        if (ins === "DEL") {
          const from = s === e ? Math.max(0, s - 1) : s;
          text.setRangeText("", from, e, "end");
        } else {
          text.setRangeText(ins, s, e, "end");
          text.value = text.value.replace(/ {2,}/g, " ");
        }
        refresh();
      };
    });
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
        this.ruleArrived = true;
        this.pulled = false;
        this.q(".bk-rule").textContent = this.rule;
        this.renderSteps();
        if (!this.info.local) sfx.ping();
        this.hud.toast("Your Guide installed a new rule. Pull the lever to try it.");
        return;
      case "lever": {
        if (this.info.role !== "guide") return;
        const say: Record<Pull, string> = {
          closed: "The breaker closed.",
          locked: "The Runner pulled the lever, but the breaker is locked. Its rule has to pass every safety test.",
          tripped: "The Runner pulled the lever and the breaker tripped. Ask what the gauges read.",
        };
        if (!(m.result in say)) return;
        this.q(".bk-last").textContent = say[m.result];
        this.pulled = true;
        if (m.result === "tripped") this.tripped = true;
        if (m.result === "closed") { this.done = true; this.root.classList.add("closed"); this.q(".bk-state").textContent = "Closed"; }
        else if (!this.info.local) sfx.denied();
        this.renderSteps();
        return;
      }
      case "ending":
        if (this.info.role === "guide") this.toEnding("guide", m.ms === undefined ? undefined : { ms: m.ms, caught: m.caught ?? 0 });
        return;
    }
  }
}
