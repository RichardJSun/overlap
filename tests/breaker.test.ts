import { describe, expect, it } from "vitest";
import { BROKEN_RULE, check, pull, run, safe } from "../src/shared/breaker.ts";

const FIXED = "line_clear && (load < capacity || override)";

describe("main breaker rule", () => {
  it("starts broken: the flipped rule fails the first two safety tests", () => {
    expect(check(BROKEN_RULE).pass).toEqual([false, false, true]);
    expect(pull(BROKEN_RULE, true)).toBe("locked");
  });

  it("a rule that passes the tests alone still trips on the live surge", () => {
    const r = "line_clear && load < capacity";
    expect(safe(check(r))).toBe(true);
    expect(pull(r, false)).toBe("tripped");
    expect(pull(r, true)).toBe("tripped");
  });

  it("the fixed rule closes only with the override key on", () => {
    expect(safe(check(FIXED))).toBe(true);
    expect(pull(FIXED, false)).toBe("tripped");
    expect(pull(FIXED, true)).toBe("closed");
  });

  it("catches the precedence trap and rules that skip safety", () => {
    expect(check("line_clear && load < capacity || override").pass).toEqual([true, true, false]);
    for (const r of ["true", "override", "load < capacity || override"]) expect(pull(r, true)).toBe("locked");
  });

  it("explains bad rules instead of throwing", () => {
    expect(check("load >").error).toMatch(/can't read/);
    expect(check("voltage < 5").error).toMatch(/no reading called voltage/);
    expect(check("load").error).toMatch(/true or false/);
    expect(check("   ").error).toMatch(/empty/);
    expect(run("x".repeat(400), { load: 1n, capacity: 1n, line_clear: true, override: false }).ok).toBe(false);
    expect(pull("load +", true)).toBe("locked");
  });
});
