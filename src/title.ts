import { toCanvas } from "qrcode";
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
const tape = (text: string, cls = "") => el("span", { className: `ov-tape ${cls}`, textContent: text });

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

/**
 * DOM title screen (owned by the network track). Renders into `root`, and calls `start` once the
 * player has picked a role and a room, then removes itself.
 */
export function showTitle(root: HTMLElement, start: Start): void {
  const h = sign();
  const body = el("div", { className: "ov-body" });
  const main = el("main", { className: "ov-main" }, h, body);
  const wrap = el("div", { className: "ov" }, el("style", { textContent: CSS }), main);
  root.append(wrap);
  lantern(wrap, h);

  const go = (role: Role, t: Transport, code: string) => {
    wrap.remove();
    start(role, t, code);
  };

  // Home: pick a role, then the rules as a light legend.
  const runnerBtn = el("button", { className: "ov-btn ov-primary", type: "button" }, glyph(R), "Play as Runner");
  const input = Object.assign(document.createElement("input"), {
    id: "ov-code-input", className: "ov-input", placeholder: "ABCD", maxLength: 4, autocomplete: "off",
    autocapitalize: "characters", inputMode: "text", enterKeyHint: "go", spellcheck: false,
  });
  const err = el("p", { className: "ov-err", id: "ov-code-err" });
  err.setAttribute("aria-live", "polite");
  input.setAttribute("aria-describedby", err.id);
  const form = el("form", { className: "ov-join" },
    el("label", { htmlFor: input.id, className: "ov-label", textContent: "Join as Guide" }),
    el("div", { className: "ov-field" }, input, el("button", { className: "ov-btn", type: "submit", textContent: "Join" })),
    err,
  );

  const actions = el("section", { className: "ov-actions" },
    el("p", { className: "ov-pitch", textContent: "A city in blackout. One of you walks the dark with a lantern. The other runs the grid and can only see you through the streetlights." }),
    el("div", { className: "ov-run" }, runnerBtn, el("p", { className: "ov-help", textContent: "Opens a room. Your Guide joins from a second computer, a phone, or another tab." })),
    form,
    el("a", { className: "ov-local", href: "?local=1", textContent: "Try it solo: both roles on one screen" }),
  );
  actions.setAttribute("aria-label", "Start");

  const legend = el("section", { className: "ov-legend" },
    el("h2", { textContent: "How to play" }),
    el("dl", { className: "ov-roles" },
      el("div", {}, el("dt", {}, tape("Runner")), el("dd", { textContent: "Walks the dark streets with a lantern and sees only what light reaches. Arrows or WASD, or tap to move. Space flares so the Guide can find you. Colored glass on the street changes your lantern." })),
      el("div", {}, el("dt", {}, tape("Guide")), el("dd", { textContent: "Runs the grid from the control room. Sees the city and its drones, but sees the Runner only under a lit streetlight or in a powered block. Tap to ping, right-click or hold to warn, tap a streetlight to switch it, within the power budget." })),
    ),
    el("p", { className: "ov-rule", textContent: "Light adds up. A bridge or door appears only while all of its colors shine on it, so magenta needs both red and blue." }),
    el("ul", { className: "ov-mixes" }, mixRow(R, B), mixRow(R, G), mixRow(G, B),
      el("li", { className: "ov-mix ov-mix3" }, swatch(R), el("span", { className: "ov-op", textContent: "+" }), swatch(G), el("span", { className: "ov-op", textContent: "+" }), swatch(B), el("span", { className: "ov-op", textContent: "=" }), swatch(mix(R, G, B)))),
  );

  body.append(actions, legend);

  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "");
    err.textContent = "";
    input.removeAttribute("aria-invalid");
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
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
      el("section", { className: "ov-room" },
        tape("Room code"),
        codeEl,
        status,
        el("p", { className: "ov-hint" }, "On the Guide's computer, open this link, or type the code under Join as Guide:", el("span", { className: "ov-link", textContent: link })),
        copy,
        el("div", { className: "ov-run" }, startNow, el("p", { className: "ov-help", textContent: "Your Guide can join mid-run." })),
      ),
      el("figure", { className: "ov-plate" }, qr, el("figcaption", { textContent: "On a phone? Scan to join as Guide" })),
    );
    startNow.focus({ preventScroll: true });
  });
}

const CSS = `
.ov { --night: #0b1020; --wall: #1b2238; --edge: #2c3758; --street: #141a2e; --amber: #ffd38a; --red: #ff4d5e; --green: #4dff88; --blue: #4d8bff;
  --ink: #e8ecff; --dim: #a9b1d6; --faint: #7d87b2; --ease: cubic-bezier(.23, 1, .32, 1);
  --din: "DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; background: var(--night); color: var(--ink);
  font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; scrollbar-color: var(--edge) var(--night); }
.ov ::selection { background: var(--amber); color: var(--night); }
.ov-main { box-sizing: border-box; min-height: 100%; max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: clamp(24px, 5vh, 48px);
  padding: clamp(20px, 4vh, 48px) clamp(16px, 4vw, 56px) calc(32px + env(safe-area-inset-bottom)); }
.ov-main::before { content: ""; margin-top: auto; }
.ov-main::after { content: ""; margin-bottom: auto; }

/* The sign: an unlit word, then one copy per light, each masked to its pool. Overlaps get the mixed color. */
.ov-sign { --rad: .6em; --lx: 42%; --ly: 50%;
  --mb: radial-gradient(circle var(--rad) at 30% 52%, #000 30%, transparent 100%);
  --mg: radial-gradient(circle var(--rad) at 83% 48%, #000 30%, transparent 100%);
  --mr: radial-gradient(circle var(--rad) at var(--lx) var(--ly), #000 30%, transparent 100%);
  position: relative; isolation: isolate; align-self: flex-start; margin: -.24em -.3em -.36em -.34em; padding: .42em .3em .36em .3em;
  font: 700 clamp(84px, 27vw, min(320px, 33vh))/.8 var(--din); font-stretch: condensed; letter-spacing: .01em; pointer-events: none; user-select: none; }
.ov.lobby .ov-sign { font-size: clamp(64px, 16vw, min(168px, 18vh)); }
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

.ov-body { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: clamp(32px, 6vw, 104px); align-items: start; }
.ov-actions, .ov-room { display: flex; flex-direction: column; gap: 22px; max-width: 440px; }
.ov-room > .ov-tape { align-self: flex-start; }
.ov-pitch { margin: 0; font-size: 18px; line-height: 1.45; color: var(--ink); text-wrap: pretty; }
.ov-run { display: flex; flex-direction: column; gap: 8px; }
.ov-help { margin: 0; font-size: 13px; color: var(--faint); }

.ov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 12px; min-height: 52px; padding: 0 22px; box-sizing: border-box;
  font: 700 19px/1 var(--din); font-stretch: condensed; letter-spacing: .08em; text-transform: uppercase; color: var(--ink);
  background: var(--street); border: 1px solid var(--edge); border-radius: 0; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent;
  transition: border-color .15s ease, background-color .15s ease, color .15s ease, transform .12s var(--ease); }
.ov-btn:active { transform: scale(.97); }
.ov-btn:focus-visible, .ov-input:focus-visible, .ov-local:focus-visible { outline: 2px solid var(--amber); outline-offset: 3px; }
@media (hover: hover) { .ov-btn:hover { border-color: var(--amber); } }
.ov-primary { min-height: 60px; justify-content: flex-start; font-size: 24px; padding: 2px 22px 0; border-color: var(--red); }
.ov-primary .ov-glyph { width: 18px; height: 18px; margin-top: -3px; }
@media (hover: hover) { .ov-primary:hover { border-color: var(--red); background: color-mix(in srgb, var(--red) 16%, var(--street)); } }
.ov-primary:focus-visible { background: color-mix(in srgb, var(--red) 16%, var(--street)); }

.ov-join { display: flex; flex-direction: column; gap: 8px; }
.ov-label { font: 700 14px/1 var(--din); font-stretch: condensed; letter-spacing: .16em; text-transform: uppercase; color: var(--dim); }
.ov-field { display: flex; gap: 8px; }
.ov-input { flex: 1; min-width: 0; box-sizing: border-box; min-height: 52px; padding: 0 14px; font: 600 22px/1 var(--mono); letter-spacing: .4em; text-indent: .4em;
  text-transform: uppercase; color: var(--ink); caret-color: var(--amber); background: var(--wall); border: 1px solid var(--edge); border-radius: 0; }
.ov-input::placeholder { color: var(--faint); opacity: 1; }
.ov-input[aria-invalid=true] { border-color: var(--red); }
.ov-err { margin: 0; color: var(--red); font-size: 13px; }
.ov-err:empty { display: none; }
.ov-local { align-self: stretch; display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 18px; box-sizing: border-box;
  color: var(--ink); font-size: 15px; text-decoration: none; background: var(--street); border: 1px solid var(--edge); transition: border-color .15s ease, background-color .15s ease; }
@media (hover: hover) { .ov-local:hover { border-color: var(--amber); } }

.ov-tape { display: inline-flex; align-items: center; height: 24px; padding: 2px 9px 0; box-sizing: border-box; border-radius: 2px; background: var(--wall);
  box-shadow: inset 0 1px 0 rgba(232, 236, 255, .09), 0 1px 2px rgba(0, 0, 0, .5);
  font: 700 15px/1 var(--din); font-stretch: condensed; letter-spacing: .14em; text-transform: uppercase; color: var(--ink); white-space: nowrap; }

.ov-legend { padding-left: clamp(0px, 3vw, 40px); border-left: 1px solid var(--edge); display: flex; flex-direction: column; gap: 20px; }
.ov-legend h2 { margin: 0; font: 700 30px/1 var(--din); font-stretch: condensed; letter-spacing: .02em; text-transform: uppercase; color: var(--ink); }
.ov-roles { margin: 0; display: grid; gap: 14px; }
.ov-roles div { display: grid; grid-template-columns: 92px 1fr; gap: 16px; align-items: baseline; }
.ov-roles dd { margin: 0; color: var(--dim); max-width: 52ch; }
.ov-rule { margin: 4px 0 0; color: var(--ink); }
.ov-mixes { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.ov-mix.ov-mix3 { display: flex; flex-wrap: wrap; gap: 8px; }
.ov-mix { display: grid; grid-template-columns: 6.2em 1em 6.2em 1em auto; align-items: center; gap: 8px; }
.ov-sw { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
.ov-op { color: var(--faint); text-align: center; }
.ov-glyph { flex: none; width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.5; overflow: visible; }

.ov-code { font: 700 clamp(104px, 30vw, 220px)/.8 var(--din); font-stretch: condensed; letter-spacing: .1em; padding-top: .08em; margin: -4px 0 -6px; user-select: all; }
.ov-status { margin: 0; display: inline-flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 600; color: var(--amber); }
.ov-status::before { content: ""; width: 9px; height: 9px; border-radius: 50%; background: currentColor; }
.ov-status.ok { color: var(--green); }
@media (prefers-reduced-motion: no-preference) { .ov-status:not(.ok)::before { animation: ov-breathe 1.2s ease-in-out infinite alternate; } }
@keyframes ov-breathe { to { opacity: .25; } }
.ov-hint { margin: 0; color: var(--dim); font-size: 14px; }
.ov-copy { align-self: flex-start; min-height: 44px; padding: 0 16px; font-size: 15px; }
.ov-link { display: block; margin-top: 4px; font: 500 13px/1.4 var(--mono); color: var(--ink); word-break: break-all; user-select: all; }
.ov-plate { margin: 0; justify-self: start; display: flex; flex-direction: column; gap: 12px; padding: 14px 14px 12px; background: var(--ink);
  box-shadow: 0 0 0 1px var(--edge), 0 24px 80px -24px rgba(255, 211, 138, .35); }
.ov-qr { display: block; width: min(260px, 64vw) !important; height: auto !important; aspect-ratio: 1; image-rendering: pixelated; }
.ov-plate figcaption { font: 700 15px/1 var(--din); font-stretch: condensed; letter-spacing: .14em; text-transform: uppercase; color: var(--night); padding-top: 2px; }

@media (max-width: 759px) {
  .ov-body { grid-template-columns: minmax(0, 1fr); }
  .ov-legend { padding: 28px 0 0; border-left: 0; border-top: 1px solid var(--edge); }
  .ov-roles div { grid-template-columns: 1fr; gap: 6px; }
  .ov-pitch { font-size: 16px; }
  .ov-mix { grid-template-columns: auto 1em auto 1em auto; justify-content: start; }
  .ov.lobby .ov-body { gap: 28px; }
  .ov-plate { justify-self: center; }
  .ov.lobby .ov-body { display: flex; flex-direction: column; gap: 20px; }
  .ov-room { display: contents; }
  .ov-room > .ov-tape { order: 1; } .ov-code { order: 2; } .ov-plate { order: 3; align-self: flex-start; } .ov-status { order: 4; } .ov-hint { order: 5; } .ov-copy { order: 5; } .ov-room > .ov-run { order: 6; }
  .ov-qr { width: min(200px, 56vw) !important; }
}
`;
