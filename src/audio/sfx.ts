// Procedural WebAudio: every sound is synthesized, nothing is loaded.
// Graph: {sfx, ambient, drone} buses -> master (mute) -> limiter -> destination.

export type Kind = "step" | "ping" | "lightOn" | "lightOff" | "denied" | "substation" | "exitOpen" | "respawn" | "ending";

const KEY = "overlap.muted";
const FLOOR = 1e-4; // exponential ramps cannot reach 0

const noiseBufs = new WeakMap<BaseAudioContext, AudioBuffer>();
function noiseBuf(c: BaseAudioContext): AudioBuffer {
  let b = noiseBufs.get(c);
  if (!b) {
    b = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBufs.set(c, b);
  }
  return b;
}

/** Builds one sound and disconnects all its nodes when its last source ends. */
class Voice {
  private nodes: AudioNode[] = [];
  private last?: AudioScheduledSourceNode;
  end = 0;
  constructor(readonly c: BaseAudioContext) {}

  add<T extends AudioNode>(n: T): T {
    this.nodes.push(n);
    return n;
  }
  private run<T extends AudioScheduledSourceNode>(s: T, start: number, stop: number): T {
    s.start(start);
    s.stop(stop);
    if (stop >= this.end) [this.end, this.last] = [stop, s];
    return s;
  }
  done(): number {
    const nodes = this.nodes;
    this.last!.onended = () => nodes.forEach((n) => n.disconnect());
    return this.end;
  }

  gain(dest: AudioNode, v = 0): GainNode {
    const g = this.add(this.c.createGain());
    g.gain.value = v;
    g.connect(dest);
    return g;
  }
  filter(dest: AudioNode, type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const n = this.add(this.c.createBiquadFilter());
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    n.connect(dest);
    return n;
  }
  osc(dest: AudioNode, type: OscillatorType, f: number, t: number, stop: number, detune = 0): OscillatorNode {
    const o = this.add(this.c.createOscillator());
    o.type = type;
    o.frequency.value = f;
    o.detune.value = detune;
    o.connect(dest);
    return this.run(o, t, stop);
  }
  noise(dest: AudioNode, t: number, dur: number, rate = 1): AudioBufferSourceNode {
    const s = this.add(this.c.createBufferSource());
    s.buffer = noiseBuf(this.c);
    s.loop = true;
    s.playbackRate.value = rate;
    s.connect(dest);
    return this.run(s, t, t + dur);
  }
  /** Linear attack to `peak`, hold, exponential release. Returns the release end. */
  env(p: AudioParam, t: number, a: number, peak: number, r: number, hold = 0): number {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setValueAtTime(peak, t + a + hold);
    p.exponentialRampToValueAtTime(FLOOR, t + a + hold + r);
    return t + a + hold + r;
  }
  tone(dest: AudioNode, type: OscillatorType, f: number, t: number, a: number, peak: number, r: number, hold = 0, detune = 0): OscillatorNode {
    const g = this.gain(dest);
    return this.osc(g, type, f, t, this.env(g.gain, t, a, peak, r, hold) + 0.02, detune);
  }
  /** Keeps feedback/delay nodes alive until `until`, then lets done() free them. */
  keep(dest: AudioNode, t: number, until: number): void {
    const k = this.add(this.c.createConstantSource());
    k.offset.value = 0;
    k.connect(dest);
    this.run(k, t, until);
  }
}

const SOUNDS: Record<Kind, (v: Voice, out: AudioNode, t: number) => void> = {
  step(v, out, t) {
    const r = 0.85 + Math.random() * 0.3;
    const g = v.gain(out);
    v.env(g.gain, t, 0.004, 0.25, 0.08);
    v.noise(v.filter(g, "lowpass", 450 + Math.random() * 450, 1.4), t, 0.1, r);
    v.tone(out, "sine", 85 * r, t, 0.003, 0.09, 0.06);
  },

  ping(v, out, t) {
    const delay = v.add(v.c.createDelay(1));
    delay.delayTime.value = 0.19;
    const lp = v.filter(v.gain(out, 0.5), "lowpass", 2600);
    delay.connect(lp);
    lp.connect(v.gain(delay, 0.38));
    const send = v.gain(out, 1);
    send.connect(delay);
    v.tone(send, "sine", 880, t, 0.005, 0.4, 0.14);
    v.tone(send, "sine", 1320, t + 0.1, 0.005, 0.4, 0.22);
    v.keep(out, t, t + 1.8);
  },

  lightOn(v, out, t) {
    const g = v.gain(out);
    const end = v.env(g.gain, t, 0.28, 0.36, 0.25);
    const o = v.osc(v.gain(g, 0.7), "sine", 100, t, end + 0.02);
    o.frequency.exponentialRampToValueAtTime(116, t + 0.3);
    const lp = v.filter(v.gain(g, 0.5), "lowpass", 220, 3);
    lp.frequency.exponentialRampToValueAtTime(1300, t + 0.3);
    const h = v.osc(lp, "sawtooth", 200, t, end + 0.02);
    h.frequency.exponentialRampToValueAtTime(232, t + 0.3);
  },

  lightOff(v, out, t) {
    const click = v.gain(out);
    v.env(click.gain, t, 0.001, 0.35, 0.025);
    v.noise(v.filter(click, "highpass", 1800), t, 0.03);
    const g = v.gain(out);
    const end = v.env(g.gain, t, 0.01, 0.35, 0.34);
    v.osc(g, "triangle", 116, t, end + 0.02).frequency.exponentialRampToValueAtTime(45, end);
  },

  denied(v, out, t) {
    const g = v.gain(out);
    for (const [s, e] of [[0, 0.09], [0.13, 0.24]]) {
      g.gain.setValueAtTime(0, t + s);
      g.gain.linearRampToValueAtTime(0.18, t + s + 0.008);
      g.gain.setValueAtTime(0.18, t + e - 0.02);
      g.gain.linearRampToValueAtTime(0, t + e);
    }
    const lp = v.filter(g, "lowpass", 700, 2);
    v.osc(lp, "sawtooth", 82, t, t + 0.26);
    v.osc(lp, "square", 87, t, t + 0.26);
  },

  substation(v, out, t) {
    const lp = v.filter(out, "lowpass", 900, 0.5);
    lp.frequency.exponentialRampToValueAtTime(2400, t + 1.2);
    lp.frequency.exponentialRampToValueAtTime(1100, t + 3.6);
    [261.63, 329.63, 392, 523.25].forEach((f, i) => {
      const s = t + i * 0.14;
      v.tone(out, "triangle", f, s, 0.008, 0.25, 0.5);
      for (const d of [-7, 7]) v.tone(lp, "sawtooth", f, s, 0.04, 0.08, 1.8, 1.3 - i * 0.14, d);
    });
    // warm pad (root + fifth an octave down) swells in under the arpeggio
    for (const f of [130.81, 196]) for (const d of [-5, 5]) v.tone(lp, "sawtooth", f, t + 0.5, 0.9, 0.08, 1.9, 0.6, d);
  },

  exitOpen(v, out, t) {
    for (const [f, s] of [[784, 0], [1174.66, 0.13]]) {
      v.tone(out, "sine", f, t + s, 0.004, 0.35, 0.7);
      v.tone(out, "sine", f * 2.76, t + s, 0.002, 0.06, 0.2); // bell partial
    }
  },

  respawn(v, out, t) {
    const g = v.gain(out);
    const end = v.env(g.gain, t, 0.005, 0.5, 0.15, 0.25);
    const bp = v.filter(g, "bandpass", 3000, 1.5);
    bp.frequency.exponentialRampToValueAtTime(300, end);
    const o = v.osc(bp, "sawtooth", 1400, t, end + 0.02);
    for (let i = 0; i < 13; i++) o.frequency.setValueAtTime(1400 * 0.8 ** i * (0.8 + Math.random() * 0.4), t + i * 0.03);
    v.osc(v.gain(g, 0.35), "square", 220, t, end + 0.02).frequency.exponentialRampToValueAtTime(40, end);
  },

  ending(v, out, t) {
    const lp = v.filter(out, "lowpass", 600, 0.6);
    lp.frequency.exponentialRampToValueAtTime(3500, t + 1.8);
    lp.frequency.exponentialRampToValueAtTime(1500, t + 4.2);
    for (const d of [-6, 6]) {
      for (const f of [261.63, 392, 523.25, 783.99]) v.tone(lp, "sawtooth", f, t, 1.2, 0.05, 2.2, 0.8, d);
      v.tone(lp, "sawtooth", 349.23, t, 1.0, 0.055, 0.35, 0.3, d); // sus4 ...
      v.tone(lp, "sawtooth", 329.63, t + 1.3, 0.25, 0.055, 2.3, 0.5, d); // ... resolves to the third
    }
    v.tone(out, "sine", 130.81, t, 1.0, 0.25, 2.6, 0.8);
    v.tone(out, "sine", 1046.5, t + 1.3, 0.6, 0.05, 2.4, 0.3);
    v.tone(out, "sine", 1318.51, t + 1.5, 0.6, 0.035, 2.2, 0.3);
  },
};

export const KINDS = Object.keys(SOUNDS) as Kind[];

/** Schedules one sound into any context (live or offline). Returns when its last node stops. */
export function play(c: BaseAudioContext, out: AudioNode, kind: Kind, t = c.currentTime): number {
  const v = new Voice(c);
  SOUNDS[kind](v, out, t);
  return v.done();
}

export function buses(c: BaseAudioContext) {
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.2;
  limiter.connect(c.destination);
  const master = c.createGain();
  master.connect(limiter);
  const bus = (v: number) => {
    const g = c.createGain();
    g.gain.value = v;
    g.connect(master);
    return g;
  };
  return { master, sfx: bus(0.7), ambient: bus(0.2), drone: bus(0.4) };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Continuous buzzing saw voice. Returns a setter that glides its gain to `level`. */
export function makeDrone(c: BaseAudioContext, out: AudioNode) {
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(out);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 700;
  bp.Q.value = 2.5;
  bp.connect(g);
  const lfo = c.createOscillator();
  lfo.frequency.value = 5.5;
  const wobble = c.createGain();
  wobble.gain.value = 140; // Hz of filter sweep
  lfo.connect(wobble);
  wobble.connect(bp.frequency);
  const vibrato = c.createGain();
  vibrato.gain.value = 12; // cents
  lfo.connect(vibrato);
  for (const [f, d] of [[110, -9], [110, 9], [55, 4]]) {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.detune.value = d;
    vibrato.connect(o.detune);
    o.connect(bp);
    o.start();
  }
  lfo.start();
  let last = 0;
  return (level: number, t = c.currentTime) => {
    const q = Math.round(clamp01(level) * 200) / 200; // skip per-frame jitter, keep exact 0
    if (q === last) return;
    last = q;
    g.gain.setTargetAtTime(q * 0.7, t, 0.08);
  };
}

/** Quiet A sus2 pad. Brightness opens the filter and adds a major third and upper partials. */
export function makeAmbient(c: BaseAudioContext, out: AudioNode) {
  const g = c.createGain();
  g.gain.value = 0;
  g.connect(out);
  const lp = c.createBiquadFilter();
  lp.frequency.value = 280;
  lp.Q.value = 0.8;
  lp.connect(g);
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.07;
  const sweep = c.createGain();
  sweep.gain.value = 70;
  lfo.connect(sweep);
  sweep.connect(lp.frequency);
  lfo.start();
  const voice = (f: number, level: number) => {
    const vg = c.createGain();
    vg.gain.value = level;
    vg.connect(lp);
    for (const d of [-7, 7]) {
      const o = c.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(vg);
      o.start();
    }
    return vg;
  };
  voice(55, 0.3);
  voice(110, 0.2);
  voice(164.81, 0.14);
  voice(246.94, 0.1);
  const third = voice(277.18, 0);
  const high = voice(440, 0);
  const high2 = voice(659.25, 0);
  return (brightness: number, t = c.currentTime) => {
    const b = clamp01(brightness);
    g.gain.setTargetAtTime(0.5, t, 1.2);
    lp.frequency.setTargetAtTime(280 + 1000 * b, t, 0.8);
    third.gain.setTargetAtTime(0.1 * b, t, 0.8);
    high.gain.setTargetAtTime(0.06 * b, t, 0.8);
    high2.gain.setTargetAtTime(0.04 * b, t, 0.8);
  };
}

let ctx: AudioContext | undefined;
let bus: ReturnType<typeof buses>;
let setDrone: ReturnType<typeof makeDrone> | undefined;
let setAmbient: ReturnType<typeof makeAmbient> | undefined;
let stepEnds: number[] = [];

function fire(kind: Kind): void {
  if (ctx) play(ctx, bus.sfx, kind);
}

function loadMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export const sfx = {
  /** Call from the first user gesture (required on iOS). Safe to call repeatedly. */
  unlock(): void {
    if (!ctx) {
      ctx = new AudioContext();
      bus = buses(ctx);
      bus.master.gain.value = sfx.muted ? 0 : 1;
    }
    if (ctx.state === "suspended") void ctx.resume();
  },
  step(): void {
    if (!ctx) return;
    stepEnds = stepEnds.filter((e) => e > ctx!.currentTime);
    if (stepEnds.length >= 3) return;
    stepEnds.push(play(ctx, bus.sfx, "step"));
  },
  ping(): void { fire("ping"); },
  lightOn(): void { fire("lightOn"); },
  lightOff(): void { fire("lightOff"); },
  /** Guide tried to exceed the power budget. */
  denied(): void { fire("denied"); },
  substation(): void { fire("substation"); },
  exitOpen(): void { fire("exitOpen"); },
  respawn(): void { fire("respawn"); },
  /** Loudness of the nearest visible drone, 0 (silent) to 1 (adjacent). Called every frame. */
  drone(level: number): void {
    if (!ctx) return;
    setDrone ??= makeDrone(ctx, bus.drone);
    setDrone(level);
  },
  /** Start or update the ambient pad. `brightness` is 0..1 and rises with each substation. */
  ambient(brightness: number): void {
    if (!ctx) return;
    setAmbient ??= makeAmbient(ctx, bus.ambient);
    setAmbient(brightness);
  },
  ending(): void { fire("ending"); },
  muted: loadMuted(),
  setMuted(m: boolean): void {
    sfx.muted = m;
    try {
      localStorage.setItem(KEY, m ? "1" : "0");
    } catch {
      // storage blocked (private mode, sandboxed iframe): mute still works for this session
    }
    if (ctx) bus.master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.03);
  },
};
