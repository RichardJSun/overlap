import { EvaluationError, ParseError, evaluate } from "@marcbachmann/cel-js";

/**
 * The main breaker after district 5. The Guide edits its safety rule, a CEL expression over the
 * readings below. The breaker closes only when the rule passes every safety test and says true for
 * the live readings, which only the Runner can see.
 */
export type Readings = { load: bigint; capacity: bigint; line_clear: boolean; override: boolean };

/** The rule the breaker starts with. Somebody flipped the comparison. */
export const BROKEN_RULE = "load > capacity";
export const MAX_RULE = 300;

export const VARIABLES = [
  { name: "load", type: "int", about: "power the city draws, in MW" },
  { name: "capacity", type: "int", about: "what the main line can carry, in MW" },
  { name: "line_clear", type: "bool", about: "no crew is working on the line" },
  { name: "override", type: "bool", about: "the manual key at the breaker" },
] as const;

export const TESTS: { name: string; r: Readings; close: boolean }[] = [
  { name: "Normal night", r: { load: 80n, capacity: 100n, line_clear: true, override: false }, close: true },
  { name: "Overload", r: { load: 120n, capacity: 100n, line_clear: true, override: false }, close: false },
  { name: "Crew on the line", r: { load: 60n, capacity: 100n, line_clear: false, override: true }, close: false },
];

/** What the gauges read in the breaker room. The restart surge pushes the load just past capacity. */
export const LIVE = { load: 104n, capacity: 100n, line_clear: true };

export type Verdict = { ok: true; value: boolean } | { ok: false; error: string };

const NAMES = VARIABLES.map((v) => v.name).join(", ");

export function run(rule: string, r: Readings): Verdict {
  if (!rule.trim()) return { ok: false, error: "The rule is empty." };
  if (rule.length > MAX_RULE) return { ok: false, error: `Keep the rule under ${MAX_RULE} characters.` };
  try {
    const v = evaluate(rule, r);
    if (typeof v === "boolean") return { ok: true, value: v };
    return { ok: false, error: `The rule has to come out true or false, but it came out ${String(v)}.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    if (e instanceof ParseError) return { ok: false, error: `The breaker can't read that rule (${msg}).` };
    const unknown = /Unknown variable: (\w+)/.exec(msg);
    if (unknown) return { ok: false, error: `There's no reading called ${unknown[1]}. The readings are ${NAMES}.` };
    if (e instanceof EvaluationError) return { ok: false, error: `The rule fails when it runs (${msg}).` };
    throw e;
  }
}

export type Check = { error?: string; pass: boolean[] };

/** Runs the rule against every safety test. */
export function check(rule: string): Check {
  const pass: boolean[] = [];
  for (const t of TESTS) {
    const v = run(rule, t.r);
    if (!v.ok) return { error: v.error, pass: [] };
    pass.push(v.value === t.close);
  }
  return { pass };
}

export const safe = (c: Check) => !c.error && c.pass.length === TESTS.length && c.pass.every(Boolean);

export type Pull = "closed" | "locked" | "tripped";

/** What happens when the Runner pulls the lever with the override key on or off. */
export function pull(rule: string, override: boolean): Pull {
  if (!safe(check(rule))) return "locked";
  const v = run(rule, { ...LIVE, override });
  return v.ok && v.value ? "closed" : "tripped";
}
