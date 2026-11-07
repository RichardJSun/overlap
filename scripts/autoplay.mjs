// Plays every district in ?local=1 headless, using the solver's plan and waiting out drones.
// Reports deaths per district and saves screenshots to docs/shots/. Usage: node scripts/autoplay.mjs [baseUrl]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.argv[2] ?? "http://localhost:5173";
const startDistrict = process.argv[3] ?? "1";
mkdirSync("docs/shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/?local=1&district=${startDistrict}`);
await page.waitForFunction(() => window.__games?.length === 2 && window.__games[0].scene.getScene("runner")?.level);
await page.evaluate(() => {
  window.__deaths = [];
  const s = window.__games[0].scene.getScene("runner");
  const orig = s.respawn;
  s.respawn = function (reason) { window.__deaths.push({ di: this.di, reason, at: { ...this.pos }, t: +((this.time.now - this.t0) / 1000).toFixed(1) }); return orig.call(this, reason); };
});
const KEY = { "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" };
const state = () => page.evaluate(() => {
  const s = window.__games[0].scene.getScene("runner");
  if (!s.sys.isActive()) return { ending: true };
  return { di: s.di, pos: { ...s.pos }, lightsOn: [...s.lightsOn], powered: [...s.powered], busy: s.moving || s.transitioning };
});
// Will tile `t` stay clear of drones for the next `window` seconds?
const safe = (t, window = 0.8) => page.evaluate(([t, window]) => {
  const s = window.__games[0].scene.getScene("runner");
  const now = (s.time.now - s.t0) / 1000;
  return s.drones.every((d) => {
    for (let dt = 0; dt <= window; dt += 0.1) {
      const p = window.__overlap.dronePos(d.def, now + dt);
      if (Math.hypot(p.x - t.x, p.y - t.y) < 1.25) return false;
    }
    return true;
  });
}, [t, window]).catch(() => true);

let di = -1, steps = 0, powered = 0, last = null;
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
    let ok = false;
    for (let i = 0; i < 160 && !(ok = await safe(t)); i++) {
      // Waiting on a drone's path is how you die: step back to the previous tile if this one is about to be hit.
      if (!(await safe(st.pos, 0.5)) && last) {
        await page.keyboard.press(KEY[`${-last.x},${-last.y}`]);
        await page.waitForTimeout(160);
        break;
      }
      await page.waitForTimeout(50);
    }
    if (!ok) continue;
    last = action.move;
    await page.keyboard.press(KEY[`${action.move.x},${action.move.y}`]);
    await page.waitForTimeout(20);
  }
  if (++steps % 40 === 0) console.log(`  step ${steps}: at ${st.pos.x},${st.pos.y} lights [${st.lightsOn}] powered [${st.powered}] deaths ${await page.evaluate(() => JSON.stringify(window.__deaths.slice(-3)))}`);
  if (steps > 3000) throw new Error("too many steps");
}
await page.waitForTimeout(6000);
await page.screenshot({ path: "docs/shots/ending.png" });
const deaths = await page.evaluate(() => window.__deaths);
console.log(`finished in ${((Date.now() - t0) / 1000).toFixed(0)}s, ${steps} actions`);
const by = {}; for (const d of deaths) by[`d${d.di + 1}: ${d.reason}`] = (by[`d${d.di + 1}: ${d.reason}`] ?? 0) + 1;
console.log("deaths:", deaths.length, JSON.stringify(by));
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
