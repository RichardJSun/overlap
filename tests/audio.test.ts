import { afterEach, describe, expect, it, vi } from "vitest";

const load = async () => {
  vi.resetModules();
  return (await import("../src/audio/sfx.ts")).sfx;
};

afterEach(() => vi.unstubAllGlobals());

describe("sfx before unlock", () => {
  it("every call is a silent no-op", async () => {
    const sfx = await load();
    for (const k of ["step", "ping", "lightOn", "lightOff", "denied", "substation", "exitOpen", "respawn", "ending"] as const) {
      expect(() => sfx[k]()).not.toThrow();
    }
    expect(() => sfx.drone(0.5)).not.toThrow();
    expect(() => sfx.ambient(0.5)).not.toThrow();
  });

  it("persists mute and survives throwing storage", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    (await load()).setMuted(true);
    expect(store.get("overlap.muted")).toBe("1");
    expect((await load()).muted).toBe(true);

    const boom = () => { throw new Error("blocked"); };
    vi.stubGlobal("localStorage", { getItem: boom, setItem: boom });
    const sfx = await load();
    expect(sfx.muted).toBe(false);
    expect(() => sfx.setMuted(true)).not.toThrow();
    expect(sfx.muted).toBe(true);
  });
});
