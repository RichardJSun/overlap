// Plays every district in ?local=1 headless, using the solver's plan and dodging drones.
// Reports time and deaths per district and saves screenshots to docs/shots/.
// Usage: node scripts/autoplay.mjs [baseUrl] [startDistrict]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { deaths, install, playToEnd } from "./lib/drive.mjs";

const base = process.argv[2] ?? "http://localhost:5173";
const start = process.argv[3] ?? "1";
mkdirSync("docs/shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/?local=1&district=${start}`);
await install(page);

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(0);
const { actions } = await playToEnd(page, {
  onDistrict: async (di) => {
    console.log(`district ${di + 1} at ${secs()}s`);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `docs/shots/d${di + 1}-start.png` });
  },
  onPowered: async (di, n) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `docs/shots/d${di + 1}-sub${n}.png` });
  },
});
await page.waitForTimeout(6000);
await page.screenshot({ path: "docs/shots/ending.png" });
const log = await deaths(page);
const by = {};
for (const d of log) by[`d${d.di + 1}`] = (by[`d${d.di + 1}`] ?? 0) + 1;
console.log(`finished in ${secs()}s, ${actions} actions, deaths ${JSON.stringify(by)}`);
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "no console errors");
await browser.close();
