/** Ending credits overlay inside a game pane. Returns the element so the scene can remove it. */
export function showCredits(pane: HTMLElement, onAgain: () => void): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;left:0;right:0;bottom:0;padding:14px 16px 18px;text-align:center;font:14px/1.5 ui-monospace,Menlo,monospace;color:#e8ecff;background:linear-gradient(#0b102000,#0b1020f0 30%);opacity:0;transition:opacity 1.2s";
  const line = (text: string, style = "") => { const p = document.createElement("div"); p.textContent = text; p.style.cssText = style; el.appendChild(p); };
  line("The city is back on.", "font-size:18px;color:#ffd38a;letter-spacing:.06em");
  line("OVERLAP", "font-size:22px;font-weight:700;letter-spacing:.3em;margin-top:4px");
  line("Made at WolfJam 2026 · Richard Sun", "opacity:.75");
  const again = document.createElement("button");
  again.textContent = "Play again";
  again.style.cssText = "margin-top:8px;font:inherit;color:#e8ecff;background:#141a2e;border:1px solid #2c3758;border-radius:6px;padding:6px 14px;cursor:pointer";
  again.onclick = onAgain;
  el.appendChild(again);
  pane.appendChild(el);
  requestAnimationFrame(() => (el.style.opacity = "1"));
  return el;
}
