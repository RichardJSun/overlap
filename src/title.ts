import { toCanvas } from "qrcode";
import { sfx } from "./audio/sfx.ts";
import { isRoomCode, newRoomCode } from "./net/room.ts";
import type { Transport } from "./net/transport.ts";
import { WebSocketTransport } from "./net/ws.ts";
import { B, css, G, mix, NAMES, R, type ColorMask } from "./shared/color.ts";
import type { Role } from "./shared/protocol.ts";

type Start = (role: Role, transport: Transport, room: string) => void;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: (Node | string)[]) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

const SVG = "http://www.w3.org/2000/svg";
/** Colorblind glyph, matching render/textures.ts: red = triangle, green = circle, blue = square, mixes overlay them. */
function glyph(c: ColorMask) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 12 12");
  svg.setAttribute("class", "ov-glyph");
  svg.setAttribute("aria-hidden", "true");
  svg.style.color = css(c);
  const add = (tag: string, attrs: Record<string, number | string>) => {
    const s = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) s.setAttribute(k, String(v));
    svg.append(s);
  };
  if (c & R) add("polygon", { points: "6,1 11,11 1,11" });
  if (c & G) add("circle", { cx: 6, cy: 6, r: 4 });
  if (c & B) add("rect", { x: 2, y: 2, width: 8, height: 8 });
  return svg;
}

const swatch = (c: ColorMask) => {
  const s = el("span", { className: "ov-sw" }, glyph(c), NAMES[c]);
  s.style.color = css(c);
  return s;
};
const mixRow = (a: ColorMask, b: ColorMask) =>
  el("li", { className: "ov-mix" }, swatch(a), el("span", { className: "ov-op", textContent: "+" }), swatch(b), el("span", { className: "ov-op", textContent: "=" }), swatch(mix(a, b)));

/** The wordmark is a sign on a dark wall: readable only where the streetlights and the visitor's lantern fall. */
function sign() {
  const word = "OVERLAP";
  const h = el("h1", { className: "ov-sign" }, el("span", { className: "ov-word", textContent: word }));
  for (const c of ["b", "g", "r", "m", "y"]) {
    const s = el("span", { className: `ov-lit ${c}`, textContent: word });
    s.setAttribute("aria-hidden", "true");
    h.append(s);
  }
  return h;
}

/** Moves the lantern toward the pointer with an eased lag; drifts on its own until the visitor moves. */
function lantern(root: HTMLElement, h: HTMLElement) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let tx = -1, ty = -1, x = -1, y = -1, moved = false;
  const target = (e: PointerEvent) => {
    const r = h.getBoundingClientRect();
    tx = e.clientX - r.left;
    ty = e.clientY - r.top;
    moved = true;
  };
  root.addEventListener("pointermove", target);
  root.addEventListener("pointerdown", target);
  const t0 = performance.now();
  const frame = (now: number) => {
    if (!h.isConnected) return;
    const w = h.clientWidth, ht = h.clientHeight, rad = parseFloat(getComputedStyle(h).fontSize) * 0.6;
    if (!moved) {
      const t = (now - t0) / 1000;
      tx = w * (0.5 + 0.34 * Math.sin(t * 0.32 - 0.9));
      ty = ht * (0.5 + 0.12 * Math.sin(t * 0.71));
    }
    const cx = Math.min(Math.max(tx, rad), w - rad), cy = Math.min(Math.max(ty, rad), ht - rad);
    if (x < 0) { x = cx; y = cy; }
    x += (cx - x) * 0.12;
    y += (cy - y) * 0.12;
    h.style.setProperty("--lx", `${x.toFixed(1)}px`);
    h.style.setProperty("--ly", `${y.toFixed(1)}px`);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** The title sheet's one-line diagram: the three lights that light the wordmark, drawn as lamps on a bus. */
const BUS = `<svg viewBox="0 0 460 176" fill="none" stroke="#e8ecff" stroke-width="1.5" font-family="ui-monospace,Menlo,Consolas,monospace" font-size="12">
  <path d="M0 34H460"/><text x="0" y="20" fill="#a9b1d6" stroke="none" font-family="system-ui,sans-serif" font-size="11" letter-spacing="1.6">BUS A · CANAL STREET</text>
  <g><path d="M70 34V70"/><rect x="62" y="70" width="16" height="16" fill="#ffd38a" stroke="#ffd38a"/><path d="M70 86V118"/><circle cx="70" cy="134" r="16" stroke="#ff4d5e"/><path d="M59 123l22 22M81 123l-22 22" stroke="#ff4d5e"/><text x="46" y="172" fill="#a9b1d6" stroke="none">LANTERN</text></g>
  <g><path d="M230 34V70"/><rect x="222" y="70" width="16" height="16" fill="#ffd38a" stroke="#ffd38a"/><path d="M230 86V118"/><circle cx="230" cy="134" r="16" stroke="#4d8bff"/><path d="M219 123l22 22M241 123l-22 22" stroke="#4d8bff"/><text x="222" y="172" fill="#a9b1d6" stroke="none">L1</text></g>
  <g><path d="M390 34V70"/><rect x="382" y="70" width="16" height="16" fill="#ffd38a" stroke="#ffd38a"/><path d="M390 86V118"/><circle cx="390" cy="134" r="16" stroke="#4dff88"/><path d="M379 123l22 22M401 123l-22 22" stroke="#4dff88"/><text x="382" y="172" fill="#a9b1d6" stroke="none">L2</text></g>
</svg>`;

const cellLabel = (text: string) => el("span", { className: "ov-k", textContent: text });
const cellValue = (text: string) => el("span", { className: "ov-v", textContent: text });

/**
 * DOM title screen (owned by the network track). Renders into `root`, and calls `start` once the
 * player has picked a role and a room, then removes itself.
 */
export function showTitle(root: HTMLElement, start: Start): void {
  const h = sign();
  const bus = el("div", { className: "ov-bus" });
  bus.innerHTML = BUS;
  bus.setAttribute("aria-hidden", "true");
  const body = el("div", { className: "ov-body" });
  const main = el("main", { className: "ov-main" }, el("div", { className: "ov-head" }, h, bus), body);
  const wrap = el("div", { className: "ov" }, el("style", { textContent: CSS }), main);
  root.append(wrap);
  lantern(wrap, h);

  const go = (role: Role, t: Transport, code: string) => {
    wrap.remove();
    start(role, t, code);
  };

  // Home: the title block holds the actions, the general notes hold the rules.
  const runnerBtn = el("button", { className: "ov-btn ov-primary", type: "button" }, glyph(R), "Play as Runner");
  const input = Object.assign(document.createElement("input"), {
    id: "ov-code-input", className: "ov-input", placeholder: "ABCD", maxLength: 4, autocomplete: "off",
    autocapitalize: "characters", inputMode: "text", enterKeyHint: "go", spellcheck: false,
  });
  const err = el("p", { className: "ov-err", id: "ov-code-err" });
  err.setAttribute("aria-live", "polite");
  input.setAttribute("aria-describedby", err.id);
  const form = el("form", { className: "ov-join" },
    el("label", { htmlFor: input.id, className: "ov-k", textContent: "Join as Guide · room code" }),
    el("div", { className: "ov-field" }, input, el("button", { className: "ov-btn", type: "submit", textContent: "Join" })),
    err,
  );

  const block = el("section", { className: "ov-tb" },
    el("div", { className: "ov-cell ov-cell-run" }, cellLabel("Field"), runnerBtn,
      el("p", { className: "ov-help", textContent: "Opens a room. Your Guide joins from a second computer, a phone, or another tab." })),
    el("div", { className: "ov-cell ov-cell-wide" }, form),
    el("div", { className: "ov-cell ov-cell-wide" }, cellLabel("Solo"), el("a", { className: "ov-local", href: "?local=1", textContent: "Both roles on one screen" })),
    el("div", { className: "ov-cell" }, cellLabel("Project"), cellValue("Overlap")),
    el("div", { className: "ov-cell" }, cellLabel("Sheet"), cellValue("00 of 06")),
    el("div", { className: "ov-cell" }, cellLabel("Drawn"), cellValue("Night dispatch")),
  );
  block.setAttribute("aria-label", "Start");

  const notes = el("section", { className: "ov-notes" },
    el("h2", { textContent: "General notes" }),
    el("ol", {},
      el("li", { className: "ov-pitch", textContent: "A city in blackout. One of you walks the dark with a lantern. The other runs the grid and can only see you through the streetlights." }),
      el("li", {}, el("b", { textContent: "Runner. " }), "Walks the dark streets with a lantern and sees only what light reaches. Arrows or WASD, or tap to move. Space flares so the Guide can find you. Colored glass on the street changes your lantern."),
      el("li", {}, el("b", { textContent: "Guide. " }), "Runs the grid from the control room. Sees the city and its drones, but sees the Runner only under a lit streetlight or in a powered block. Tap to ping, right-click or hold to warn, tap a streetlight to switch it, within the power budget."),
      el("li", {}, "Light adds up. A bridge or door appears only while all of its colors shine on it, so magenta needs both red and blue.",
        el("ul", { className: "ov-mixes" }, mixRow(R, B), mixRow(R, G), mixRow(G, B),
          el("li", { className: "ov-mix ov-mix3" }, swatch(R), el("span", { className: "ov-op", textContent: "+" }), swatch(G), el("span", { className: "ov-op", textContent: "+" }), swatch(B), el("span", { className: "ov-op", textContent: "=" }), swatch(mix(R, G, B))))),
    ),
  );

  body.append(notes, block);

  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "");
    err.textContent = "";
    input.removeAttribute("aria-invalid");
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    sfx.unlock();
    const code = input.value;
    if (!isRoomCode(code)) {
      err.textContent = "Enter the 4-letter code shown on the Runner's screen.";
      input.setAttribute("aria-invalid", "true");
      input.focus();
      return;
    }
    go("guide", new WebSocketTransport(code, "guide"), code);
  });

  // Runner lobby: show the code and QR, wait for the Guide.
  runnerBtn.addEventListener("click", () => {
    sfx.unlock();
    const code = newRoomCode();
    const t = new WebSocketTransport(code, "runner");
    const link = `${location.origin}/?room=${code}&role=guide`;

    const qr = el("canvas", { className: "ov-qr" });
    qr.dataset.testid = "qr";
    qr.setAttribute("role", "img");
    qr.setAttribute("aria-label", `QR code linking to ${link}`);
    // Drawn at 2x and shown at CSS size, so it stays sharp on phones and retina screens.
    void toCanvas(qr, link, { width: 440, margin: 1, color: { dark: "#0b1020", light: "#e8ecff" } });

    const codeEl = el("div", { className: "ov-code", textContent: code });
    codeEl.dataset.testid = "room-code";
    const status = el("p", { className: "ov-status", textContent: "Connecting…" });
    status.dataset.testid = "peer-status";
    status.setAttribute("role", "status");
    const startNow = el("button", { className: "ov-btn", type: "button", textContent: "Start now" });

    let started = false;
    const begin = () => {
      if (started) return;
      started = true;
      go("runner", t, code);
    };
    startNow.addEventListener("click", begin);
    t.onPeer((connected) => {
      if (started) return;
      status.textContent = connected ? "Guide connected" : "Waiting for your Guide…";
      status.classList.toggle("ok", connected);
      if (connected) setTimeout(begin, 600);
    });

    // Two computers is the best way to play, so the link gets a one-click copy; the QR code is for phones.
    const copy = el("button", { className: "ov-btn ov-copy", type: "button", textContent: "Copy link" });
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(link); copy.textContent = "Copied. Send it to your Guide"; }
      catch { copy.textContent = "Select the link above and copy it"; }
    });
    wrap.classList.add("lobby");
    body.replaceChildren(
      el("section", { className: "ov-tb ov-room" },
        el("div", { className: "ov-cell ov-cell-wide" }, cellLabel("Room code"), codeEl, status),
        el("div", { className: "ov-cell ov-cell-wide" },
          el("p", { className: "ov-hint" }, "On the Guide's computer, open this link, or type the code under Join as Guide.", el("span", { className: "ov-link", textContent: link })),
          copy),
        el("div", { className: "ov-cell ov-cell-wide" }, startNow, el("p", { className: "ov-help", textContent: "Your Guide can join mid-run." })),
      ),
      el("figure", { className: "ov-plate" }, el("span", { className: "ov-k", textContent: "Detail A" }), qr, el("figcaption", { textContent: "On a phone? Scan to join as Guide" })),
    );
    startNow.focus({ preventScroll: true });
  });
}

const CSS = `
.ov { --night: #0b1020; --wall: #1b2238; --edge: #2c3758; --street: #141a2e; --amber: #ffd38a; --red: #ff4d5e; --green: #4dff88; --blue: #4d8bff;
  --ink: #e8ecff; --dim: #a9b1d6; --faint: #7d87b2; --line: rgba(232, 236, 255, .45); --ease: cubic-bezier(.23, 1, .32, 1);
  --din: "DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; color: var(--ink); background-color: var(--night);
  background-image: linear-gradient(rgba(44, 55, 88, .3) 1px, transparent 1px), linear-gradient(90deg, rgba(44, 55, 88, .3) 1px, transparent 1px);
  background-size: 32px 32px; background-attachment: local;
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; scrollbar-color: var(--edge) var(--night); }
.ov ::selection { background: var(--amber); color: var(--night); }
/* The drawing border: a heavy outer line and a hairline inside it. */
.ov-main { box-sizing: border-box; min-height: calc(100% - 2 * clamp(10px, 2vw, 22px)); max-width: 1240px; margin: clamp(10px, 2vw, 22px) auto;
  display: flex; flex-direction: column; justify-content: center; gap: clamp(24px, 4vh, 44px);
  padding: clamp(22px, 4vh, 44px) clamp(18px, 4vw, 52px) calc(28px + env(safe-area-inset-bottom));
  border: 1.5px solid rgba(232, 236, 255, .85); outline: 1px solid rgba(232, 236, 255, .28); outline-offset: -9px; background: rgba(11, 16, 32, .55); }
.ov-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
.ov-bus { flex: 0 1 400px; min-width: 220px; margin-top: clamp(12px, 3vh, 36px); }
.ov-bus svg { display: block; width: 100%; height: auto; }
.ov.lobby .ov-bus { flex-basis: 300px; }

/* The sign: an unlit word, then one copy per light, each masked to its pool. Overlaps get the mixed color. */
.ov-sign { --rad: .6em; --lx: 42%; --ly: 50%;
  --mb: radial-gradient(circle var(--rad) at 30% 52%, #000 30%, transparent 100%);
  --mg: radial-gradient(circle var(--rad) at 83% 48%, #000 30%, transparent 100%);
  --mr: radial-gradient(circle var(--rad) at var(--lx) var(--ly), #000 30%, transparent 100%);
  position: relative; isolation: isolate; align-self: flex-start; margin: -.24em -.3em -.36em -.34em; padding: .42em .3em .36em .3em;
  font: 700 clamp(84px, 24vw, min(300px, 31vh))/.8 var(--din); font-stretch: condensed; letter-spacing: .01em; pointer-events: none; user-select: none; }
.ov.lobby .ov-sign { font-size: clamp(64px, 14vw, min(160px, 17vh)); }
.ov-word { display: block; color: var(--edge); }
.ov-lit { position: absolute; inset: 0; padding: inherit; color: var(--c); background: color-mix(in srgb, var(--c) 9%, transparent); mask-image: var(--m); }
.ov-lit.b { --c: var(--blue); --m: var(--mb); }
.ov-lit.g { --c: var(--green); --m: var(--mg); }
.ov-lit.r { --c: var(--red); --m: var(--mr); }
.ov-lit.m, .ov-lit.y { mask-composite: intersect; background: none; }
.ov-lit.m { --c: #ff4dff; mask-image: var(--mr), var(--mb); }
.ov-lit.y { --c: #ffe14d; mask-image: var(--mr), var(--mg); }
@media (prefers-reduced-motion: no-preference) {
  .ov-lit.b { animation: ov-on .7s .25s both; }
  .ov-lit.g { animation: ov-on .7s .55s both; }
  .ov-lit.r, .ov-lit.m, .ov-lit.y { animation: ov-on .7s .9s both; }
}
@keyframes ov-on { 0% { opacity: 0; } 12% { opacity: .7; } 22% { opacity: .1; } 40% { opacity: .9; } 50% { opacity: .5; } 100% { opacity: 1; } }

.ov-body { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: clamp(28px, 5vw, 80px); align-items: end; }

/* General notes: numbered, set straight on the sheet. */
.ov-notes h2 { margin: 0 0 12px; font: 700 15px/1 var(--din); font-stretch: condensed; letter-spacing: .2em; text-transform: uppercase; color: var(--ink); }
.ov-notes > ol { margin: 0; padding: 0 0 0 30px; display: grid; gap: 12px; max-width: 62ch; }
.ov-notes > ol > li { color: var(--dim); padding-left: 4px; text-wrap: pretty; }
.ov-notes > ol > li::marker { font: 600 13px var(--mono); color: var(--amber); }
.ov-notes b { font-weight: 600; color: var(--ink); }
.ov-pitch { color: var(--ink) !important; font-size: 17px; line-height: 1.45; }

/* Title block: bordered cells, labels in small technical caps, values in DIN. */
.ov-tb { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); border: 1.5px solid var(--ink); background: var(--night); }
.ov-cell { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 12px 14px; box-shadow: inset -1px -1px 0 var(--line); }
.ov-cell-run, .ov-cell-wide { grid-column: 1 / -1; }
.ov-k { font: 600 10px/1 system-ui, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: var(--faint); }
.ov-v { font: 700 17px/1 var(--din); font-stretch: condensed; letter-spacing: .08em; text-transform: uppercase; color: var(--ink); padding-top: 2px; }
.ov-help { margin: 0; font-size: 13px; color: var(--faint); }

.ov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 48px; padding: 2px 20px 0; box-sizing: border-box;
  font: 700 19px/1 var(--din); font-stretch: condensed; letter-spacing: .08em; text-transform: uppercase; color: var(--ink);
  background: transparent; border: 1px solid var(--line); border-radius: 0; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  transition: border-color .15s ease, background-color .15s ease, color .15s ease, transform .12s var(--ease); }
.ov-btn:active { transform: scale(.97); }
.ov-btn:focus-visible, .ov-input:focus-visible, .ov-local:focus-visible { outline: 2px solid var(--amber); outline-offset: 3px; }
@media (hover: hover) { .ov-btn:hover { border-color: var(--amber); } }
.ov-primary { min-height: 64px; justify-content: flex-start; font-size: 30px; padding: 4px 18px 0; border: 1.5px solid var(--red); background: color-mix(in srgb, var(--red) 8%, transparent); }
.ov-primary .ov-glyph { width: 20px; height: 20px; margin-top: -4px; fill: color-mix(in srgb, var(--red) 30%, transparent); }
@media (hover: hover) { .ov-primary:hover { border-color: var(--red); background: color-mix(in srgb, var(--red) 18%, transparent); } }
.ov-primary:focus-visible { background: color-mix(in srgb, var(--red) 18%, transparent); }

.ov-join { display: flex; flex-direction: column; gap: 8px; }
.ov-field { display: flex; gap: 10px; align-items: stretch; }
/* The room code is written on the line, four letter-spaced characters. */
.ov-input { flex: 1; min-width: 0; box-sizing: border-box; min-height: 48px; padding: 0 4px; font: 600 24px/1 var(--mono); letter-spacing: .55em; text-indent: .2em;
  text-transform: uppercase; color: var(--ink); caret-color: var(--amber); background: transparent; border: 0; border-bottom: 1.5px solid var(--ink); border-radius: 0; }
.ov-input::placeholder { color: var(--faint); opacity: 1; }
.ov-input[aria-invalid=true] { border-bottom-color: var(--red); }
.ov-err { margin: 0; color: var(--red); font-size: 13px; }
.ov-err:empty { display: none; }
.ov-local { align-self: flex-start; display: inline-flex; align-items: center; min-height: 32px; color: var(--ink); font: 700 17px/1 var(--din); font-stretch: condensed;
  letter-spacing: .08em; text-transform: uppercase; text-decoration: underline; text-decoration-color: var(--amber); text-underline-offset: 5px; text-decoration-thickness: 1px; }
@media (hover: hover) { .ov-local:hover { color: var(--amber); } }

.ov-mixes { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; }
.ov-mix.ov-mix3 { display: flex; flex-wrap: wrap; gap: 8px; }
.ov-mix { display: grid; grid-template-columns: 6.2em 1em 6.2em 1em auto; align-items: center; gap: 8px; }
.ov-sw { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
.ov-op { color: var(--faint); text-align: center; }
.ov-glyph { flex: none; width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.5; overflow: visible; }

/* Lobby. */
.ov.lobby .ov-body { grid-template-columns: minmax(0, 7fr) minmax(0, 4fr); align-items: start; }
.ov-room .ov-cell { gap: 12px; padding: 16px 18px; }
.ov-code { font: 700 clamp(96px, 22vw, 200px)/.8 var(--din); font-stretch: condensed; letter-spacing: .12em; padding-top: .08em; margin: 4px 0 -4px; user-select: all; }
.ov-status { margin: 0; display: inline-flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; color: var(--amber); }
.ov-status::before { content: ""; width: 9px; height: 9px; border-radius: 50%; background: currentColor; }
.ov-status.ok { color: var(--green); }
@media (prefers-reduced-motion: no-preference) { .ov-status:not(.ok)::before { animation: ov-breathe 1.2s ease-in-out infinite alternate; } }
@keyframes ov-breathe { to { opacity: .25; } }
.ov-hint { margin: 0; color: var(--dim); font-size: 14px; }
.ov-copy { align-self: flex-start; min-height: 44px; padding: 2px 16px 0; font-size: 16px; }
.ov-link { display: block; margin-top: 6px; font: 500 13px/1.4 var(--mono); color: var(--ink); word-break: break-all; user-select: all; }
.ov-plate { margin: 0; justify-self: start; display: flex; flex-direction: column; gap: 10px; }
.ov-qr { display: block; width: min(250px, 64vw) !important; height: auto !important; aspect-ratio: 1; image-rendering: pixelated; padding: 10px; background: var(--ink); box-shadow: 0 0 0 1.5px var(--ink), 0 0 0 10px var(--night), 0 0 0 11px var(--line); margin: 11px; }
.ov-plate figcaption { font: 600 13px/1.3 system-ui, sans-serif; color: var(--dim); }

@media (max-width: 759px) {
  .ov-bus { display: none; }
  .ov-body { grid-template-columns: minmax(0, 1fr); }
  .ov-tb { order: -1; }
  .ov-pitch { font-size: 16px; }
  .ov-mix { grid-template-columns: auto 1em auto 1em auto; justify-content: start; }
  .ov.lobby .ov-body { display: flex; flex-direction: column; gap: 22px; }
  .ov-plate { align-self: flex-start; }
  .ov-qr { width: min(200px, 56vw) !important; }
}
`;
