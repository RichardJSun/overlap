// Dev page for /tests/audio.html: a button per sound, plus offline renders for automated checks.
import { KINDS, buses, makeAmbient, makeDrone, play, sfx, type Kind } from "../src/audio/sfx.ts";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, () => sfx.unlock(), { capture: true });

for (const kind of KINDS) {
  const b = document.createElement("button");
  b.textContent = kind;
  b.onclick = () => sfx[kind]();
  $("buttons").append(b);
}

// The game calls drone() every frame, so the page does too.
const drone = $<HTMLInputElement>("drone");
const frame = () => {
  sfx.drone(Number(drone.value));
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);

const ambient = $<HTMLInputElement>("ambient");
ambient.oninput = () => sfx.ambient(Number(ambient.value));

const mute = $<HTMLInputElement>("mute");
mute.checked = sfx.muted;
mute.onchange = () => sfx.setMuted(mute.checked);

type Stats = { peak: number; nan: boolean; end: number; lastAudible: number; tailPeak: number };
const SR = 44100;

async function render(seconds: number, build: (c: OfflineAudioContext) => number): Promise<Stats> {
  const c = new OfflineAudioContext(1, Math.ceil(SR * seconds), SR);
  const end = build(c);
  const d = (await c.startRendering()).getChannelData(0);
  let peak = 0, nan = false, last = 0, tailPeak = 0;
  const tailFrom = Math.min(d.length - 1, Math.floor(end * SR));
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (Number.isNaN(d[i])) nan = true;
    if (a > peak) peak = a;
    if (a > 1e-3) last = i;
    if (i >= tailFrom && a > tailPeak) tailPeak = a;
  }
  return { peak, nan, end, lastAudible: last / SR, tailPeak };
}

declare global {
  interface Window {
    renderOffline(kind: Kind, throughBuses?: boolean): Promise<Stats>;
    renderDrone(): Promise<Stats>;
    renderAmbient(brightness: number): Promise<Stats>;
  }
}

// Through buses, start at 1 s: Chromium's compressor ramps in from silence when a context starts.
window.renderOffline = (kind, throughBuses = false) =>
  render(6, (c) => (throughBuses ? play(c, buses(c).sfx, kind, 1) : play(c, c.destination, kind, 0.01)));

// Full level for 1 s, then 0: the tail after `end` must be silent.
window.renderDrone = () =>
  render(3, (c) => {
    const set = makeDrone(c, c.destination);
    set(1, 0.01);
    set(0, 1);
    return 2.5;
  });

window.renderAmbient = (brightness) =>
  render(8, (c) => {
    makeAmbient(c, c.destination)(brightness, 0);
    return 8;
  });
