// Two separate browsers play one room through the real Worker: the runner starts from the title
// screen, the guide joins by link (like scanning the QR code). Checks moves, flares and streetlights.
// Usage: node scripts/net-check.mjs [baseUrl]
import { chromium, devices } from "@playwright/test";

const base = process.argv[2] ?? "https://overlap.richardsun.workers.dev";
const b1 = await chromium.launch(), b2 = await chromium.launch();
const runner = await (await b1.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const guide = await (await b2.newContext({ ...devices["iPhone 13"] })).newPage();
const errors = [];
for (const p of [runner, guide]) { p.on("pageerror", (e) => errors.push(String(e))); p.on("console", (m) => m.type() === "error" && errors.push(m.text())); }
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) process.exitCode = 1; };

await runner.goto(`${base}/`);
await runner.getByText("Play as Runner").click();
const code = (await runner.getByTestId("room-code").textContent()).trim();
check(/^[A-Z]{4}$/.test(code), `room code ${code}`);
await guide.goto(`${base}/?room=${code}&role=guide`);
const scene = (p, key) => p.waitForFunction((k) => window.__games?.[0]?.scene.getScene(k)?.level, key);
await scene(runner, "runner");
await scene(guide, "guide");
await runner.waitForTimeout(800);
const g = () => guide.evaluate(() => { const s = window.__games[0].scene.getScene("guide"); return { pos: s.runnerPos, seen: s.seen, di: s.di, peer: s.peer }; });
check((await g()).peer, "guide sees the runner connected");

for (const k of ["ArrowDown", "ArrowDown", "ArrowDown", "ArrowDown"]) { await runner.keyboard.press(k); await runner.waitForTimeout(180); }
await guide.waitForTimeout(500);
let st = await g();
check(st.pos.x === 2 && st.pos.y === 6, `runner moves reach the guide (${st.pos.x},${st.pos.y})`);
check(!st.seen, "the guide can't see the runner off camera");
await runner.keyboard.press("Space");
await guide.waitForTimeout(400);
check((await g()).seen, "a flare shows the runner to the guide");

await guide.evaluate(() => window.__games[0].scene.getScene("guide").toggle("L1"));
await runner.waitForTimeout(500);
const lit = await runner.evaluate(() => [...window.__games[0].scene.getScene("runner").lightsOn]);
check(lit.includes("L1"), "the guide's streetlight reaches the runner");
await runner.screenshot({ path: "docs/shots/net-runner.png" });
await guide.screenshot({ path: "docs/shots/net-guide-phone.png" });
check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await b1.close(); await b2.close();
