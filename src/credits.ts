const CSS = `
.cr{--din:"DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow",sans-serif-condensed,system-ui,sans-serif;--ease:cubic-bezier(.23,1,.32,1);
  position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;min-height:120px;padding:16px 20px calc(16px + env(safe-area-inset-bottom));
  display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 24px;
  font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#e8ecff;background:linear-gradient(rgba(11,16,32,0),#0b1020 38%)}
.cr-text{display:flex;flex-direction:column;gap:8px;min-width:0}
.cr h2{margin:0;font:700 clamp(28px,3.2vw,40px)/.9 var(--din);font-stretch:condensed;letter-spacing:.01em;text-transform:uppercase;color:#ffd38a;padding-top:.08em}
.cr-tapes{display:flex;flex-wrap:wrap;gap:6px}
.cr-tape{display:inline-flex;align-items:center;height:24px;padding:2px 9px 0;box-sizing:border-box;border-radius:2px;background:#1b2238;
  box-shadow:inset 0 1px 0 rgba(232,236,255,.09),0 1px 2px rgba(0,0,0,.5);font:700 15px/1 var(--din);font-stretch:condensed;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
.cr-tape.wm{color:#ffd38a}
.cr button{min-height:44px;padding:2px 20px 0;font:700 18px/1 var(--din);font-stretch:condensed;letter-spacing:.08em;text-transform:uppercase;color:#e8ecff;
  background:#141a2e;border:1px solid #ffd38a;border-radius:0;cursor:pointer;touch-action:manipulation;transition:background-color .15s ease,transform .12s var(--ease)}
.cr button:active{transform:scale(.97)}
.cr button:focus-visible{outline:2px solid #ffd38a;outline-offset:3px}
@media (hover:hover){.cr button:hover{background:color-mix(in srgb,#ffd38a 14%,#141a2e)}}
.cr>*>*,.cr>button{opacity:0;transform:translateY(8px);transition:opacity .9s ease,transform .9s var(--ease);transition-delay:calc(var(--i)*90ms)}
.cr.on>*>*,.cr.on>button{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.cr>*>*,.cr>button{transform:none}}
`;

/** Ending credits overlay inside a game pane. Returns the element so the scene can remove it. */
export function showCredits(pane: HTMLElement, onAgain: () => void): HTMLDivElement {
  if (!document.getElementById("cr-css")) {
    const s = document.createElement("style"); s.id = "cr-css"; s.textContent = CSS; document.head.appendChild(s);
  }
  const el = document.createElement("div");
  el.className = "cr";
  el.setAttribute("role", "status");
  const text = document.createElement("div");
  text.className = "cr-text";
  const head = Object.assign(document.createElement("h2"), { textContent: "The city is back on." });
  const tapes = Object.assign(document.createElement("div"), { className: "cr-tapes" });
  const tape = (t: string, cls = "") => Object.assign(document.createElement("span"), { className: `cr-tape ${cls}`, textContent: t });
  tapes.append(tape("Overlap", "wm"), tape("Made at WolfJam 2026"), tape("Richard Sun"));
  text.append(head, tapes);
  const again = Object.assign(document.createElement("button"), { type: "button", textContent: "Play again" });
  again.onclick = onAgain;
  el.append(text, again);
  [head, tapes, again].forEach((n, i) => n.style.setProperty("--i", String(i)));
  pane.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
  return el;
}
