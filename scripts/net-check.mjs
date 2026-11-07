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
const scene = (p, key) => p.waitForFunction((k) => window.__games?.[0]?.scene.getScene(k)?.level, key, { timeout: 60000 }); // the cold open plays first
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
// The main breaker over the Worker. The Guide joins after the Runner is already there, then reloads.
const code2 = Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join("");
await runner.goto(`${base}/?room=${code2}&role=runner&district=6`);
const inBreaker = (p) => p.waitForFunction(() => window.__games?.[0]?.scene.getScene("breaker")?.sys.isActive(), null, { timeout: 30000 }).then(() => true, () => false);
check(await inBreaker(runner), "?district=6 opens the main breaker");
await guide.goto(`${base}/?room=${code2}&role=guide`);
check(await inBreaker(guide), "a guide who joins late lands at the breaker");
await guide.reload();
check(await inBreaker(guide), "a guide who reloads lands at the breaker again");
await guide.waitForTimeout(400);
await guide.screenshot({ path: "docs/shots/net-breaker-phone.png" });
const pull = async () => { await runner.locator(".bk-lever").click(); await guide.waitForTimeout(600); return guide.locator(".bk-last").textContent(); };
check(/locked/.test(await pull()), "the broken rule keeps the breaker locked");
const install = async (rule) => { await guide.locator(".bk-text").fill(rule); await guide.locator(".bk-install").click(); await runner.waitForTimeout(600); };
await install("line_clear && (load < capacity || override)");
check((await runner.locator(".bk-rule").textContent()) === "line_clear && (load < capacity || override)", "the guide's rule reaches the runner");
check(/tripped/.test(await pull()), "without the override key the surge trips it");
await runner.locator(".bk-key").click();
await runner.locator(".bk-lever").click();
const ended = (p) => p.waitForFunction(() => window.__games?.[0]?.scene.getScene("ending")?.sys.isActive(), null, { timeout: 15000 }).then(() => true, () => false);
check((await ended(runner)) && (await ended(guide)), "closing the breaker takes both players to the ending");
check(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
await b1.close(); await b2.close();
