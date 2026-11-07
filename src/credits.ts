const CSS = `
.cr{--din:"DIN Condensed","Bahnschrift","Roboto Condensed","Arial Narrow",sans-serif-condensed,system-ui,sans-serif;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --ink:#e8ecff;--line:rgba(232,236,255,.45);--amber:#ffd38a;--ease:cubic-bezier(.23,1,.32,1);
  position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;min-height:120px;padding:14px 16px 14px;
  display:flex;flex-direction:column;gap:10px;font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);background:linear-gradient(rgba(11,16,32,0),#0b1020 34%)}
.cr-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 18px}
.cr h2{margin:0;font:700 clamp(26px,3vw,38px)/.9 var(--din);font-stretch:condensed;letter-spacing:.04em;text-transform:uppercase;color:var(--amber);padding-top:.08em}
.cr-log{margin:0;font:13px/1.3 var(--mono);color:var(--ink)}
.cr-log b{font-weight:600;color:var(--amber);border-bottom:1px solid var(--amber);margin-right:8px}
.cr-tb{display:flex;flex-wrap:wrap;border:1.5px solid var(--ink);background:#0b1020}
.cr-cell{display:flex;flex-direction:column;justify-content:center;gap:4px;padding:7px 12px;box-shadow:inset -1px -1px 0 var(--line);min-width:0}
.cr-k{font:600 9.5px/1 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#7d87b2}
.cr-v{font:700 16px/1 var(--din);font-stretch:condensed;letter-spacing:.08em;text-transform:uppercase;padding-top:2px;white-space:nowrap}
.cr-v.wm{color:var(--amber)}
.cr button{margin-left:auto;align-self:stretch;min-height:44px;padding:2px 22px 0;font:700 18px/1 var(--din);font-stretch:condensed;letter-spacing:.08em;text-transform:uppercase;color:var(--ink);
  background:transparent;border:0;border-left:1.5px solid var(--ink);border-radius:0;cursor:pointer;touch-action:manipulation;transition:background-color .15s ease,transform .12s var(--ease)}
.cr button:active{transform:scale(.97)}
.cr button:focus-visible{outline:2px solid var(--amber);outline-offset:-4px}
@media (hover:hover){.cr button:hover{background:rgba(255,211,138,.14)}}
.cr>*{opacity:0;transform:translateY(8px);transition:opacity .9s ease,transform .9s var(--ease);transition-delay:calc(var(--i)*120ms)}
.cr.on>*{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.cr>*{transform:none}}
`;

/** Ending credits overlay inside a game pane: the drawing's last revision and its title block. Returns the element so the scene can remove it. */
export function showCredits(pane: HTMLElement, onAgain: () => void, stats?: { ms: number; caught: number }): HTMLDivElement {
  if (!document.getElementById("cr-css")) {
    const s = document.createElement("style"); s.id = "cr-css"; s.textContent = CSS; document.head.appendChild(s);
  }
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = "") => Object.assign(document.createElement(tag), { className, textContent: text });
  const el = make("div", "cr");
  el.setAttribute("role", "status");
  const head = make("div", "cr-head");
  const log = make("p", "cr-log", "Every streetlight in the city is white again.");
  log.prepend(make("b", "", "22:11"));
  head.append(make("h2", "", "The city is back on."), log);
  const block = make("div", "cr-tb");
  const cell = (k: string, v: string, wm = false) => { const c = make("div", "cr-cell"); c.append(make("span", "cr-k", k), make("span", wm ? "cr-v wm" : "cr-v", v)); return c; };
  block.append(cell("Project", "Overlap", true), cell("Made at", "WolfJam 2026"), cell("Drawn by", "Richard Sun"));
  if (stats) {
    const s = Math.round(stats.ms / 1000);
    block.append(cell("Time", `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`), cell("Caught", stats.caught === 0 ? "Never" : stats.caught === 1 ? "Once" : `${stats.caught} times`));
  }
  const again = Object.assign(document.createElement("button"), { type: "button", textContent: "Play again" });
  again.onclick = onAgain;
  block.append(again);
  el.append(head, block);
  [head, block].forEach((n, i) => n.style.setProperty("--i", String(i)));
  pane.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("on")));
  return el;
}
