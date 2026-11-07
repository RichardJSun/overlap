import type Phaser from "phaser";
import type { Role } from "../shared/protocol.ts";

const CSS = `
.post{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.post>div{position:absolute;inset:0}
.post .grain{inset:-64px;opacity:.07;animation:post-grain .5s steps(5) infinite}
@keyframes post-grain{0%{transform:translate(0,0)}20%{transform:translate(-23px,17px)}40%{transform:translate(31px,-9px)}60%{transform:translate(-11px,-29px)}80%{transform:translate(19px,27px)}}
.post .scan{background:repeating-linear-gradient(#0000 0 2px,#00000038 2px 3px)}
@media (prefers-reduced-motion:reduce){.post .grain{animation:none}}
`;
const LOOK: Record<Role | "ending", string[]> = {
  runner: [
    "background:radial-gradient(ellipse 75% 70% at 50% 52%,#0000 55%,#05080fcc 100%)",
    "grain",
  ],
  guide: [
    "scan",
    "box-shadow:inset 0 0 60px #4dff8826,inset 0 0 2px 1px #4dff8840;border-radius:10px",
    "background:radial-gradient(ellipse 90% 85% at 50% 50%,#0000 70%,#020a06aa 100%)",
  ],
  ending: ["background:radial-gradient(ellipse 80% 75% at 50% 45%,#0000 50%,#3a1e0866 100%)"],
};

let grainUrl = "";
function grain() {
  if (grainUrl) return grainUrl;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!, img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data.set([v, v, v, Math.random() < 0.5 ? 255 : 0], i);
  }
  ctx.putImageData(img, 0, 0);
  return (grainUrl = c.toDataURL());
}

/** Screen-space mood for a scene: vignette and film grain for the runner, monitor look for the guide. */
export function addPost(scene: Phaser.Scene, role: Role | "ending"): void {
  if (!document.getElementById("post-css")) {
    const s = document.createElement("style"); s.id = "post-css"; s.textContent = CSS; document.head.appendChild(s);
  }
  // A DOM layer above the canvas and below the HUD, so it ignores camera zoom and costs no GPU passes.
  const el = document.createElement("div");
  el.className = "post";
  for (const look of LOOK[role]) {
    const d = document.createElement("div");
    if (look === "grain" || look === "scan") d.className = look; else d.style.cssText = look;
    if (look === "grain") d.style.backgroundImage = `url(${grain()})`;
    el.appendChild(d);
  }
  // The runner's unlit map is near-black; match the frame to it so the map edge disappears.
  if (role === "runner") scene.cameras.main.setBackgroundColor(0x04050b);
  scene.game.canvas.parentElement!.appendChild(el);
  scene.events.once("shutdown", () => el.remove());
}
