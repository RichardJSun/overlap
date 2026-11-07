// Shared headless driver for ?local=1: plays districts with the solver's plan and dodges drones.
// Used by scripts/autoplay.mjs (testing) and scripts/record-demo.mjs (the demo video).

const KEY = { "1,0": "ArrowRight", "-1,0": "ArrowLeft", "0,1": "ArrowDown", "0,-1": "ArrowUp" };
export const keyFor = (m) => KEY[`${m.x},${m.y}`];

/** Installs page-side helpers: death log, guide tile->screen mapping, and the move chooser. */
export async function install(page) {
  await page.waitForFunction(() => window.__games?.length === 2 && window.__games[0].scene.getScene("runner")?.level);
  await page.evaluate(() => {
    window.__deaths = [];
    const runner = () => window.__games[0].scene.getScene("runner");
    const s0 = runner();
    const orig = s0.respawn;
    s0.respawn = function (reason) { window.__deaths.push({ di: this.di, reason, at: { ...this.pos } }); return orig.call(this, reason); };
    window.__tapAt = (tx, ty) => {
      const g = window.__games[1].scene.getScene("guide"), cam = g.cameras.main, rect = g.game.canvas.getBoundingClientRect();
      return { x: rect.left + ((tx + 0.5) * 32 - cam.worldView.x) * cam.zoom, y: rect.top + ((ty + 0.5) * 32 - cam.worldView.y) * cam.zoom };
    };
    const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    window.__drive = {
      state() {
        const s = runner();
        if (!s.sys.isActive()) return { done: true };
        return { di: s.di, pos: { ...s.pos }, lightsOn: [...s.lightsOn], powered: [...s.powered] };
      },
      /** Next thing to do: a guide toggle, a runner move, or a wait. */
      decide() {
        const s = runner();
        if (!s.sys.isActive()) return { done: true };
        if (s.moving || s.transitioning) return { wait: 25 };
        const p = window.__overlap.plan(window.__overlap.LEVELS[s.di], { from: { pos: s.pos, lightsOn: [...s.lightsOn], powered: [...s.powered], lantern: s.lantern } });
        if (!p || !p.length) return { wait: 100, stuck: !p };
        if (p[0].toggle) return { toggle: p[0].toggle };
        const now = (s.time.now - s.t0) / 1000;
        // Closest any drone comes to tile t around `at` seconds from now.
        const risk = (t, at) => {
          let m = Infinity;
          for (const d of s.drones)
            for (let dt = -0.1; dt <= 0.35; dt += 0.05) {
              const q = window.__overlap.dronePos(d.def, now + at + dt);
              m = Math.min(m, Math.hypot(q.x - t.x, q.y - t.y));
            }
          return m;
        };
        let pos = s.pos, clear = true;
        for (let i = 0; i < 3 && p[i]?.move; i++) {
          pos = { x: pos.x + p[i].move.x, y: pos.y + p[i].move.y };
          if (risk(pos, (i + 1) * 0.13) < 1.1) { clear = false; break; }
        }
        if (clear) return { move: p[0].move };
        if (risk(s.pos, 0.3) > 1.2 && risk(s.pos, 0.6) > 1.2) return { wait: 40 };
        // Standing still gets you caught: step to the safest open neighbour.
        let best = null, bestR = -1;
        for (const d of DIRS) {
          const t = { x: s.pos.x + d.x, y: s.pos.y + d.y };
          if (!s.canEnter(t.x, t.y)) continue;
          const r = Math.min(risk(t, 0.15), risk(t, 0.5));
          if (r > bestR) { bestR = r; best = d; }
        }
        return best ? { move: best } : { wait: 40 };
      },
      /** A drone near the runner that the runner can't see, for the guide to ping. */
      unseenDrone(range = 5) {
        const s = runner();
        if (!s.sys.isActive()) return null;
        const d = s.drones.filter((d) => !d.img.visible).map((d) => ({ t: d.tile, r: Math.hypot(d.tile.x - s.pos.x, d.tile.y - s.pos.y) })).sort((a, b) => a.r - b.r)[0];
        return d && d.r <= range ? d.t : null;
      },
    };
  });
}

/**
 * Plays from the current district until the ending. Hooks: onDistrict(di), onPowered(di, n).
 * `pingDrones` makes the guide ping unseen drones near the runner (for the demo).
 * `toggleDelay` pauses after each streetlight switch so viewers can see the light change.
 */
export async function playToEnd(page, { onDistrict, onPowered, pingDrones = false, toggleDelay = 150, maxActions = 4000 } = {}) {
  let di = -1, powered = 0, actions = 0, idle = 0, lastPing = 0;
  for (;;) {
    const st = await page.evaluate(() => window.__drive.state());
    if (st.done) return { actions };
    if (st.di !== di) { di = st.di; powered = 0; await onDistrict?.(di); }
    if (st.powered.length !== powered) { powered = st.powered.length; await onPowered?.(di, powered); }
    if (pingDrones && Date.now() - lastPing > 2600) {
      const t = await page.evaluate(() => window.__drive.unseenDrone());
      if (t) {
        const at = await page.evaluate(([x, y]) => window.__tapAt(x, y), [t.x, t.y]);
        await page.mouse.click(at.x, at.y);
        lastPing = Date.now();
      }
    }
    const a = await page.evaluate(() => window.__drive.decide());
    if (a.done) return { actions };
    if (a.toggle) {
      await page.evaluate((id) => window.__games[1].scene.getScene("guide").toggle(id), a.toggle);
      await page.waitForTimeout(toggleDelay);
    } else if (a.move) {
      await page.keyboard.press(keyFor(a.move));
      await page.waitForTimeout(15);
    } else {
      if (a.stuck && ++idle > 100) throw new Error(`no plan from ${JSON.stringify(st)}`);
      await page.waitForTimeout(a.wait);
      continue;
    }
    idle = 0;
    if (++actions > maxActions) throw new Error("too many actions");
  }
}

export const deaths = (page) => page.evaluate(() => window.__deaths);

/**
 * Plays the main breaker in ?local=1 the way two players would. The Guide's first fix passes the
 * safety tests but trips on the live surge; then the Runner turns the override key and the Guide
 * adds it to the rule. The rule is typed into the real textarea, so lost keystrokes fail loudly.
 * Returns what the Guide's panel said after each pull of the lever.
 */
export async function solveBreaker(page, { typeDelay = 0, pause = 0, onTrip } = {}) {
  await page.waitForFunction(() => window.__games?.length === 2 && window.__games.every((g) => g.scene.getScene("breaker")?.sys.isActive()), null, { timeout: 30000 });
  await page.waitForTimeout(pause);
  const text = page.locator('[data-role="guide"] .bk-text'), said = [];
  const installRule = async (rule) => {
    await text.fill("");
    await text.pressSequentially(rule, { delay: typeDelay });
    const typed = await text.inputValue();
    if (typed !== rule) throw new Error(`typed ${JSON.stringify(typed)}, wanted ${JSON.stringify(rule)}`);
    await page.locator('[data-role="guide"] .bk-install').click();
    await page.waitForTimeout(pause);
  };
  const pullLever = async () => {
    await page.locator('[data-role="runner"] .bk-lever').click();
    await page.waitForTimeout(200);
    said.push(await page.locator('[data-role="guide"] .bk-last').textContent());
  };
  await installRule("line_clear && load < capacity");
  await pullLever();
  await onTrip?.();
  await page.waitForTimeout(pause);
  await page.locator('[data-role="runner"] .bk-key').click();
  await page.waitForTimeout(pause / 2);
  await installRule("line_clear && (load < capacity || override)");
  await pullLever();
  await page.waitForFunction(() => window.__games.every((g) => g.scene.getScene("ending")?.sys.isActive()), null, { timeout: 15000 });
  return said;
}
