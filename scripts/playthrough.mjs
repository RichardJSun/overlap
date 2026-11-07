// Headless playthrough of ?local=1 against a running dev server. Saves screenshots to docs/shots/.
// Usage: node scripts/playthrough.mjs [baseUrl]
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
await page.waitForTimeout(800);

const runner = () => page.evaluate(() => { const s = window.__games[0].scene.getScene("runner"); return { ...s.pos, di: s.di, powered: [...s.powered] }; });
const keys = { U: "ArrowUp", D: "ArrowDown", L: "ArrowLeft", R: "ArrowRight" };
async function walk(path) {
  for (const c of path.replace(/\s/g, "")) { await page.keyboard.press(keys[c]); await page.waitForTimeout(170); }
  await page.waitForTimeout(150);
}
const guide = (fn) => page.evaluate(fn);
const shot = (name) => page.screenshot({ path: `docs/shots/${name}.png` });
const expectAt = async (x, y, label) => {
  const p = await runner();
  if (p.x !== x || p.y !== y) throw new Error(`${label}: runner at ${p.x},${p.y}, expected ${x},${y}`);
};

await shot("d1-start");
await walk("DDDD");
await shot("tut-flare");
await page.keyboard.press("Space");
await page.waitForTimeout(400);
await shot("tut-flared");
await walk("RRRRRRRRR DD");
await expectAt(11, 8, "reached the canal");
await walk("R");
await expectAt(11, 8, "bridge must be hidden without blue light");
// Guide pings the bridge, then switches the blue streetlight on.
await guide(() => {
  const g = window.__games[1].scene.getScene("guide");
  const cam = g.cameras.main, rect = g.game.canvas.getBoundingClientRect();
  window.__tapAt = (tx, ty) => ({ x: rect.left + ((tx + 0.5) * 32 - cam.worldView.x) * cam.zoom, y: rect.top + ((ty + 0.5) * 32 - cam.worldView.y) * cam.zoom });
});
const ping = await page.evaluate(() => window.__tapAt(12, 8));
await page.mouse.click(ping.x, ping.y);
await page.waitForTimeout(400);
await shot("d1-ping");
const lamp = await page.evaluate(() => window.__tapAt(11, 6));
await page.mouse.click(lamp.x, lamp.y);
await page.waitForTimeout(500);
await shot("d1-magenta-bridge");
await walk("RR");
await expectAt(13, 8, "crossed the magenta bridge");
await walk("UU RRRRR UUU L");
const p = await runner();
if (!p.powered.includes("S1")) throw new Error(`substation not powered: ${JSON.stringify(p)}`);
await page.waitForTimeout(600);
await shot("d1-substation");
await walk("R DDD RRRR DDDDDDD");
await page.waitForTimeout(1500);
const after = await runner().catch(() => null);
console.log("after exit:", after);
await page.waitForTimeout(3500);
await shot("after-d1");
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
