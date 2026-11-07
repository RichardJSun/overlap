// Plays every district in ?local=1 headless, using the solver's plan and waiting out drones.
// Reports deaths per district and saves screenshots to docs/shots/. Usage: node scripts/autoplay.mjs [baseUrl]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173";
mkdirSync("docs/shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/?local=1`);
await page.waitForFunction(() => window.__games?.length === 2 && window.__games[0].scene.getScene("runner")?.level);
await page.evaluate(() => {
  window.__deaths = [];
  const s = window.__games[0].scene.getScene("runner");
  const orig = s.respawn;
  s.respawn = function (reason) { window.__deaths.push({ di: this.di, reason }); return orig.call(this, reason); };
});
const KEY = { "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" };
const state = () => page.evaluate(() => {
  const s = window.__games[0].scene.getScene("runner");
  if (!s.sys.isActive()) return { ending: true };
  return { di: s.di, pos: { ...s.pos }, lightsOn: [...s.lightsOn], powered: [...s.powered], busy: s.moving || s.transitioning };
});
// Is any drone near tile `t` now or a quarter second from now?
const safe = (t) => page.evaluate((t) => {
  const s = window.__games[0].scene.getScene("runner");
  const now = (s.time.now - s.t0) / 1000;
  return s.drones.every((d) => [0, 0.25, 0.45].every((dt) => {
    const p = window.__overlap.dronePos(d.def, now + dt);
    return Math.hypot(p.x - t.x, p.y - t.y) > 1.3;
  }));
}, t);

let di = -1, steps = 0, powered = 0;
const t0 = Date.now();
for (;;) {
  const st = await state();
  if (st.ending) break;
  if (st.busy) { await page.waitForTimeout(40); continue; }
  if (st.di !== di) {
    di = st.di; powered = 0;
    await page.waitForTimeout(700);
    await page.screenshot({ path: `docs/shots/d${di + 1}-start.png` });
    console.log(`district ${di + 1} after ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  if (st.powered.length !== powered) {
    powered = st.powered.length;
    await page.waitForTimeout(400);
    await page.screenshot({ path: `docs/shots/d${di + 1}-sub${powered}.png` });
  }
  const action = await page.evaluate((st) => window.__overlap.plan(window.__overlap.LEVELS[st.di], { from: st })?.[0], st);
  if (!action) throw new Error(`no plan from ${JSON.stringify(st)}`);
  if (action.toggle) {
    await page.evaluate((id) => window.__games[1].scene.getScene("guide").toggle(id), action.toggle);
    await page.waitForTimeout(120);
  } else {
    const t = { x: st.pos.x + action.move.x, y: st.pos.y + action.move.y };
    for (let i = 0; i < 120 && !(await safe(t)); i++) await page.waitForTimeout(50);
    await page.keyboard.press(KEY[`${action.move.x},${action.move.y}`]);
    await page.waitForTimeout(140);
  }
  if (++steps > 3000) throw new Error("too many steps");
}
await page.waitForTimeout(6000);
await page.screenshot({ path: "docs/shots/ending.png" });
const deaths = await page.evaluate(() => window.__deaths);
console.log(`finished in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${steps} actions`);
console.log("deaths:", JSON.stringify(deaths));
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
