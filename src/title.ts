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

const colorWord = (c: ColorMask) => {
  const s = el("span", { textContent: NAMES[c] });
  s.style.color = css(c);
  return s;
};
const mixLine = (a: ColorMask, b: ColorMask) => el("span", { className: "ov-mix" }, colorWord(a), " + ", colorWord(b), " = ", colorWord(mix(a, b)));

/**
 * DOM title screen (owned by the network track). Renders into `root`, and calls `start` once the
 * player has picked a role and a room, then removes itself.
 */
export function showTitle(root: HTMLElement, start: Start): void {
  const city = el("div", { className: "ov-city" });
  for (const h of [34, 58, 26, 72, 44, 86, 30, 62, 40, 78, 24, 52, 90, 36, 64, 46, 28, 70]) {
    const b = el("i");
    b.style.height = `${h}%`;
    city.append(b);
  }
  const sky = el("div", { className: "ov-sky" }, el("span", { className: "ov-glow r" }), el("span", { className: "ov-glow g" }), el("span", { className: "ov-glow b" }), city);

  const logo = el("h1", { className: "ov-logo" }, el("span", { textContent: "OVERLAP" }));
  for (const c of ["r", "g", "b"]) {
    const s = el("span", { className: c, textContent: "OVERLAP" });
    s.setAttribute("aria-hidden", "true");
    logo.append(s);
  }

  const body = el("div", { className: "ov-body" });
  const card = el("main", { className: "ov-card" }, logo, body);
  const wrap = el("div", { className: "ov" }, el("style", { textContent: CSS }), sky, card);
  root.append(wrap);

  const go = (role: Role, t: Transport, code: string) => {
    wrap.remove();
    start(role, t, code);
  };

  // Home: pitch, how to play, pick a role.
  const howTo = el("section", { className: "ov-panel" },
    el("h2", { textContent: "HOW TO PLAY" }),
    el("p", { className: "ov-row" }, el("b", { className: "ov-tag r", textContent: "RUNNER" }), el("span", { textContent: "Arrows / WASD or tap to move. You carry the lantern." })),
    el("p", { className: "ov-row" }, el("b", { className: "ov-tag b", textContent: "GUIDE" }), el("span", { textContent: "Tap to ping. Tap streetlights to toggle them." })),
    el("p", { className: "ov-mixes" }, mixLine(R, B), mixLine(R, G), mixLine(G, B)),
    el("p", { className: "ov-note", textContent: "Colored bridges and doors only exist in the right light." }),
  );

  const runnerBtn = el("button", { className: "ov-btn ov-primary", type: "button", textContent: "Play as Runner" });
  const input = Object.assign(document.createElement("input"), {
    id: "ov-code-input", className: "ov-input", placeholder: "CODE", maxLength: 4, autocomplete: "off",
    autocapitalize: "characters", inputMode: "text", enterKeyHint: "go", spellcheck: false,
  });
  const err = el("p", { className: "ov-err" });
  err.setAttribute("aria-live", "polite");
  const form = el("form", { className: "ov-join" },
    el("label", { htmlFor: input.id, textContent: "Join as Guide" }),
    input,
    el("button", { className: "ov-btn", type: "submit", textContent: "Join" }),
  );

  body.append(
    el("p", { className: "ov-pitch", textContent: "A city in blackout. One of you walks the dark with a lantern; the other runs the grid. Light colors add." }),
    howTo,
    el("div", { className: "ov-actions" }, runnerBtn, el("span", { className: "ov-or", textContent: "or" }), form, err),
    el("a", { className: "ov-local", href: "?local=1", textContent: "One screen, both roles" }),
  );

  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "");
    err.textContent = "";
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = input.value;
    if (!isRoomCode(code)) {
      err.textContent = "Enter the 4-letter code shown on the Runner's screen.";
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
    // Drawn at 2x and shown at CSS size, so it stays sharp on phones and retina screens.
    void toCanvas(qr, link, { width: 400, margin: 2, color: { dark: "#0b1020", light: "#e8ecff" } });

    const codeEl = el("div", { className: "ov-code", textContent: code });
    codeEl.dataset.testid = "room-code";
    const status = el("p", { className: "ov-status" });
    status.dataset.testid = "peer-status";
    status.setAttribute("role", "status");
    const startNow = el("button", { className: "ov-btn ov-sub", type: "button", textContent: "Start now — they can join any time" });

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

    body.replaceChildren(
      el("p", { className: "ov-kicker", textContent: "Room code" }),
      codeEl,
      qr,
      el("p", { className: "ov-hint" }, "Guide: scan with your phone, or open", el("span", { className: "ov-link", textContent: link })),
      status,
      startNow,
    );
  });
}

const CSS = `
.ov { flex: 1; position: relative; display: flex; flex-direction: column; overflow-x: hidden; overflow-y: auto; isolation: isolate; background: #0b1020; color: #e8ecff; }
.ov-sky { position: fixed; inset: 0; z-index: -1; overflow: hidden; pointer-events: none; background: #0b1020; }
.ov-glow { position: absolute; left: 50%; top: 32%; width: 76vmax; height: 76vmax; margin: -38vmax 0 0 -38vmax; border-radius: 50%; mix-blend-mode: screen; }
.ov-glow.r { background: radial-gradient(closest-side, rgba(255, 77, 94, .34), transparent); animation: ov-r 19s ease-in-out infinite alternate; }
.ov-glow.g { background: radial-gradient(closest-side, rgba(77, 255, 136, .22), transparent); animation: ov-g 23s ease-in-out infinite alternate; }
.ov-glow.b { background: radial-gradient(closest-side, rgba(77, 139, 255, .34), transparent); animation: ov-b 17s ease-in-out infinite alternate; }
@keyframes ov-r { from { transform: translate(-24%, -8%); } to { transform: translate(-9%, 6%); } }
@keyframes ov-g { from { transform: translate(3%, 24%); } to { transform: translate(-5%, 10%); } }
@keyframes ov-b { from { transform: translate(24%, -6%); } to { transform: translate(9%, 8%); } }
.ov-city { position: absolute; left: 0; right: 0; bottom: 0; height: min(30vh, 240px); display: flex; align-items: flex-end; gap: 2px; }
.ov-city i { flex: 2; border-top: 1px solid #2c3758;
  background: radial-gradient(circle, rgba(232, 236, 255, .07) 1px, transparent 1.6px) 3px 6px / 9px 12px, linear-gradient(#121831, #070a14); }
.ov-city i:nth-child(3n) { flex: 3; }
.ov-city i:nth-child(4n + 1) { flex: 1.3; }

.ov-card { position: relative; box-sizing: border-box; width: 100%; max-width: 600px; margin: auto;
  padding: 28px 16px calc(28px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; align-items: center; gap: 18px; text-align: center; }
.ov-body { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 18px; }
.ov-logo { position: relative; isolation: isolate; margin: 0; font-size: clamp(44px, 16vw, 96px); line-height: 1; font-weight: 800;
  letter-spacing: .14em; padding-left: .14em; color: transparent; user-select: none; }
.ov-logo span[aria-hidden] { position: absolute; inset: 0; padding-left: .14em; mix-blend-mode: screen; text-shadow: 0 0 .25em currentColor; }
.ov-logo .r { color: #ff4d5e; transform: translate(-.02em, 0); animation: ov-lr 5s ease-in-out infinite alternate; }
.ov-logo .g { color: #4dff88; transform: translate(0, .015em); animation: ov-lg 6s ease-in-out infinite alternate; }
.ov-logo .b { color: #4d8bff; transform: translate(.02em, 0); animation: ov-lb 5.5s ease-in-out infinite alternate; }
@keyframes ov-lr { from { transform: translate(-.06em, -.01em); } to { transform: translate(-.015em, 0); } }
@keyframes ov-lg { from { transform: translate(0, .06em); } to { transform: translate(0, .012em); } }
@keyframes ov-lb { from { transform: translate(.06em, -.01em); } to { transform: translate(.015em, 0); } }

.ov-pitch { margin: 0; max-width: 34em; color: #b9c1e6; font-size: 15px; line-height: 1.55; }
.ov-panel { box-sizing: border-box; width: 100%; padding: 16px; text-align: left; font-size: 14px; line-height: 1.5;
  background: rgba(20, 26, 46, .88); border: 1px solid #2c3758; border-radius: 14px; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.ov-panel h2, .ov-join label, .ov-kicker { margin: 0; font-size: 12px; font-weight: 600; letter-spacing: .2em; color: #8a93bb; text-transform: uppercase; }
.ov-panel p { margin: 8px 0 0; }
.ov-row { display: flex; gap: 12px; }
.ov-tag { flex: none; width: 5.5em; }
.ov-tag.r { color: #ff4d5e; }
.ov-tag.b { color: #4d8bff; }
.ov-mixes { display: flex; flex-wrap: wrap; gap: 4px 18px; }
.ov-mix { white-space: nowrap; color: #8a93bb; }
.ov-mix span { font-weight: 700; text-shadow: 0 0 10px currentColor; }
.ov-note { color: #b9c1e6; }

.ov-actions { width: 100%; display: flex; flex-direction: column; gap: 12px; }
.ov-btn { font: inherit; font-size: 16px; font-weight: 700; color: #e8ecff; background: #141a2e; border: 1px solid #2c3758; border-radius: 12px;
  min-height: 50px; padding: 0 18px; cursor: pointer; touch-action: manipulation; transition: border-color .15s, box-shadow .15s, transform .1s; }
.ov-btn:hover { border-color: #4d8bff; box-shadow: 0 0 18px rgba(77, 139, 255, .3); }
.ov-btn:active { transform: scale(.98); }
.ov-btn:focus-visible, .ov-input:focus-visible, .ov-local:focus-visible { outline: 2px solid #4d8bff; outline-offset: 2px; }
.ov-primary { font-size: 18px; letter-spacing: .06em; border-color: #ff4d5e; box-shadow: 0 0 24px rgba(255, 77, 94, .22);
  background: linear-gradient(90deg, rgba(255, 77, 94, .22), rgba(77, 255, 136, .14), rgba(77, 139, 255, .22)), #141a2e; }
.ov-primary:hover { border-color: #ff4d5e; box-shadow: 0 0 28px rgba(255, 77, 94, .4); }
.ov-or { color: #5d6790; font-size: 13px; }
.ov-join { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; }
.ov-join label { flex: 1 0 100%; text-align: left; }
.ov-input { flex: 1; min-width: 0; box-sizing: border-box; min-height: 50px; padding: 0 12px; font: inherit; font-size: 22px; font-weight: 700;
  letter-spacing: .35em; text-indent: .35em; text-align: center; text-transform: uppercase; color: #e8ecff; background: #0b1020; border: 1px solid #2c3758; border-radius: 12px; }
.ov-input::placeholder { color: #3a4568; }
.ov-err { margin: 0; min-height: 1.2em; color: #ff4d5e; font-size: 13px; text-align: left; }
.ov-err:empty { display: none; }
.ov-local { color: #8a93bb; font-size: 14px; text-underline-offset: 3px; }
.ov-local:hover { color: #e8ecff; }
.ov-sub { font-size: 14px; padding: 0 16px; }

.ov-code { font-size: clamp(64px, 22vw, 112px); font-weight: 800; line-height: 1; letter-spacing: .18em; padding-left: .18em; user-select: all;
  text-shadow: 0 0 24px rgba(77, 139, 255, .55), 0 0 56px rgba(255, 77, 94, .35); }
.ov-qr { display: block; width: 200px !important; height: 200px !important; border-radius: 8px; box-shadow: 0 0 0 4px #e8ecff, 0 0 48px rgba(77, 255, 136, .3); }
.ov-hint { margin: 0; color: #b9c1e6; font-size: 14px; }
.ov-link { display: block; margin-top: 4px; color: #e8ecff; font-size: 13px; word-break: break-all; user-select: all; }
.ov-status { margin: 0; display: inline-flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; }
.ov-status::before { content: ""; width: 10px; height: 10px; border-radius: 50%; background: #ffd38a; box-shadow: 0 0 12px #ffd38a; animation: ov-pulse 1.1s ease-in-out infinite alternate; }
.ov-status.ok { color: #4dff88; }
.ov-status.ok::before { background: #4dff88; box-shadow: 0 0 12px #4dff88; animation: none; }
@keyframes ov-pulse { to { opacity: .25; } }

@media (prefers-reduced-motion: reduce) { .ov *, .ov *::before { animation: none !important; } }
`;
