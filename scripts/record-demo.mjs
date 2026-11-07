// Records the demo video: title screen, then ?local=1 played through every district, with the
// game's own synthesized sound. Playwright can't capture audio, so every sfx call is logged with a
// timestamp, re-rendered through an OfflineAudioContext with the same synth code, and muxed by ffmpeg.
// Usage: node scripts/record-demo.mjs [baseUrl] [out.mp4]
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { install, keyFor, playToEnd } from "./lib/drive.mjs";

const base = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? "docs/demo.mp4";
const work = join(process.env.TMPDIR ?? "/tmp", "overlap-demo");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const W = 1440, H = 810;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: work, size: { width: W, height: H } } });
const page = await ctx.newPage();
const videoStart = Date.now();
const mark = (label) => console.log(`${((Date.now() - videoStart) / 1000).toFixed(1)}s ${label}`);

// 1. Title: sweep the "lantern" pointer across the lit wordmark.
await page.goto(`${base}/`);
await page.waitForTimeout(900);
for (let i = 0; i <= 70; i++) { await page.mouse.move(180 + i * 13, 230 + Math.sin(i / 7) * 70); await page.waitForTimeout(55); }
await page.waitForTimeout(700);
mark("title done");

// 2. One screen, both roles.
await page.goto(`${base}/?local=1`);
await install(page);
await page.evaluate(() => {
  window.__audioLog = [];
  const sfx = window.__overlap.sfx, log = window.__audioLog;
  for (const k of ["step", "ping", "lightOn", "lightOff", "denied", "substation", "exitOpen", "respawn", "ending"]) {
    const orig = sfx[k].bind(sfx);
    sfx[k] = () => { log.push({ k, at: Date.now() }); orig(); };
  }
  let lastD = -1;
  const drone = sfx.drone.bind(sfx), amb = sfx.ambient.bind(sfx);
  sfx.drone = (v) => { const q = Math.round(v * 20) / 20; if (q !== lastD) { lastD = q; log.push({ k: "drone", v: q, at: Date.now() }); } drone(v); };
  sfx.ambient = (v) => { log.push({ k: "ambient", v, at: Date.now() }); amb(v); };
});
const tap = async (x, y) => { const p = await page.evaluate(([x, y]) => window.__tapAt(x, y), [x, y]); await page.mouse.click(p.x, p.y); };
const walk = async (path, ms = 210) => { for (const c of path.replace(/\s/g, "")) { await page.keyboard.press(keyFor({ R: { x: 1, y: 0 }, L: { x: -1, y: 0 }, D: { x: 0, y: 1 }, U: { x: 0, y: -1 } }[c])); await page.waitForTimeout(ms); } };

// District 1, played slowly so the tutorial steps can be read.
await page.waitForTimeout(2500);
await walk("DDDD");
await page.waitForTimeout(1800);
await page.keyboard.press("Space"); // flare: the guide sees the runner
await page.waitForTimeout(2500);
await walk("RRRRRRRRR DD", 170);
await page.waitForTimeout(600);
await walk("R"); // bump the hidden bridge
await page.waitForTimeout(1800);
await tap(12, 8); // guide pings the bridge
await page.waitForTimeout(2000);
await tap(11, 6); // guide switches the blue streetlight on: magenta
await page.waitForTimeout(2400);
await walk("RR UU RRRRR UUU L", 160);
await page.waitForTimeout(2600);
await walk("R DDD RRRR DDDDDDD", 150);
mark("district 1 done");

// Districts 2 and 3, driven by the solver, with the guide pinging drones the runner can't see.
await playToEnd(page, {
  pingDrones: true,
  toggleDelay: 650,
  onDistrict: async (di) => { mark(`district ${di + 1}`); await page.waitForTimeout(2200); },
  onPowered: async () => { await page.waitForTimeout(1200); },
});
mark("ending");
await page.waitForTimeout(10000);
const log = await page.evaluate(() => window.__audioLog);
const videoEnd = Date.now();
const video = await page.video().path();
await ctx.close();
mark(`recorded, ${log.length} sound events`);

// 3. Re-render the sound offline with the game's synth code, in a page that isn't recording.
const audioPage = await browser.newPage();
await audioPage.goto(`${base}/?local=1`);
await audioPage.waitForFunction(() => window.__overlap?.audio);
const dur = (videoEnd - videoStart) / 1000 + 1;
const chunks = await audioPage.evaluate(async ({ log, start, dur }) => {
  const sr = 44100, A = window.__overlap.audio;
  const off = new OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const bus = A.buses(off), setDrone = A.makeDrone(off, bus.drone), setAmb = A.makeAmbient(off, bus.ambient);
  for (const e of log) {
    const t = Math.max(0, (e.at - start) / 1000);
    if (e.k === "drone") setDrone(e.v, t);
    else if (e.k === "ambient") setAmb(e.v, t);
    else A.play(off, bus.sfx, e.k, t);
  }
  const buf = await off.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = buf.length;
  const wav = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => [...s].forEach((c, i) => wav.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); wav.setUint32(4, 36 + n * 4, true); str(8, "WAVEfmt "); wav.setUint32(16, 16, true); wav.setUint16(20, 1, true);
  wav.setUint16(22, 2, true); wav.setUint32(24, sr, true); wav.setUint32(28, sr * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true);
  str(36, "data"); wav.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    wav.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    wav.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  // Hand the bytes back as base64 in pieces small enough for the protocol.
  const bytes = new Uint8Array(wav.buffer), out = [], step = 3 * 1024 * 1024;
  for (let i = 0; i < bytes.length; i += step) {
    let s = "";
    const part = bytes.subarray(i, i + step);
    for (let j = 0; j < part.length; j += 0x8000) s += String.fromCharCode(...part.subarray(j, j + 0x8000));
    out.push(btoa(s));
  }
  return out;
}, { log, start: videoStart, dur });
await browser.close();
const wavPath = join(work, "audio.wav");
writeFileSync(wavPath, Buffer.concat(chunks.map((c) => Buffer.from(c, "base64"))));

// 4. Mux. The first moment of the recording is a blank page, so trim it off both tracks.
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", video, "-i", wavPath, "-map", "0:v", "-map", "1:a", "-ss", "0.7",
  "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out]);
console.log(`wrote ${out}`);
