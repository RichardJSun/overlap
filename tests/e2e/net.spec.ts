import { expect, test, type Page } from "@playwright/test";

const randomRoom = () => Array.from({ length: 4 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)]).join("");

/** Opens a WebSocketTransport in the page and records what it sees on `window.net`. */
async function connect(page: Page, room: string, role: "runner" | "guide") {
  await page.evaluate(async ([room, role]) => {
    const src = "/src/net/ws.ts"; // Vite serves source in dev
    const { WebSocketTransport } = await import(src);
    const t = new WebSocketTransport(room, role);
    const net = { t, got: [] as unknown[], peer: false, status: [] as string[] };
    t.onMessage((m: unknown) => net.got.push(m));
    t.onPeer((c: boolean) => (net.peer = c));
    t.onStatus((s: string) => net.status.push(s));
    (window as any).net = net;
  }, [room, role] as const);
}

const peerIs = (page: Page, v: boolean) => page.waitForFunction((v) => (window as any).net.peer === v, v);
const received = (page: Page, t: string, check: string) =>
  page.waitForFunction(([t, check]) => (window as any).net.got.some((m: any) => m.t === t && JSON.stringify(m).includes(check)), [t, check]);

test("ping round-trips through the room", async ({ browser }) => {
  const room = randomRoom();
  const marker = String(Math.floor(Math.random() * 1e9));
  const runner = await (await browser.newContext()).newPage();
  const guide = await (await browser.newContext()).newPage();
  await Promise.all([runner.goto("/"), guide.goto("/")]);

  await connect(runner, room, "runner");
  await connect(guide, room, "guide");
  await Promise.all([peerIs(runner, true), peerIs(guide, true)]);

  await guide.evaluate((id) => (window as any).net.t.send({ t: "ping", id, p: { x: 3, y: 4 } }), marker);
  await received(runner, "ping", marker);

  const snapshot = { district: Number(marker), runner: { x: 1, y: 2 }, lightsOn: ["a"], substationsPowered: [], drones: [] };
  await runner.evaluate((s) => (window as any).net.t.send({ t: "snapshot", s }), snapshot);
  await received(guide, "snapshot", marker);

  // A guide that leaves and comes back gets the stored snapshot replayed.
  await guide.evaluate(() => (window as any).net.t.close());
  await peerIs(runner, false);
  await connect(guide, room, "guide");
  await received(guide, "snapshot", marker);
  await Promise.all([peerIs(runner, true), peerIs(guide, true)]);

  // A dropped socket reconnects by itself, and the peer comes back.
  await runner.evaluate(() => (window as any).net.t.ws.close());
  await peerIs(guide, false);
  await Promise.all([peerIs(runner, true), peerIs(guide, true)]);
  expect(await runner.evaluate(() => (window as any).net.status)).toEqual(["connecting", "online", "reconnecting", "online"]);
});

test("title screen creates a room and a guide joins it by code", async ({ browser }) => {
  const runner = await (await browser.newContext()).newPage();
  await runner.goto("/");
  await runner.getByRole("button", { name: "Play as Runner" }).click();
  const code = (await runner.getByTestId("room-code").textContent()) ?? "";
  expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
  await expect(runner.getByTestId("qr")).toBeVisible();
  await expect(runner.getByTestId("peer-status")).toHaveText("Waiting for your Guide…");

  const guide = await (await browser.newContext()).newPage();
  await guide.goto("/");
  await guide.getByLabel("Join as Guide").fill(code.toLowerCase());
  // "Guide connected" shows for 600ms before the runner auto-starts, so watch every frame from before the join.
  const connected = runner.waitForFunction(() => document.querySelector("[data-testid=peer-status]")?.textContent === "Guide connected");
  await guide.getByRole("button", { name: "Join", exact: true }).click();
  await connected;
  // Both titles removed themselves and handed over to the game.
  await expect(runner.locator(".ov")).toHaveCount(0);
  await expect(guide.locator(".ov")).toHaveCount(0);
});
