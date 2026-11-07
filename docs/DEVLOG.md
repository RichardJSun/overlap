# Overlap devlog

Timestamped notes from the WolfJam 2026 build (theme: Visibility). Times are EST, Sat Nov 7, 2026.

## 12:27 Start
Empty repo. Plan and rules live in [HANDOFF.md](../HANDOFF.md).

## 12:35 M0 scaffold
- Vite 8 + Phaser 4.2 client (the handoff said Phaser 3; we took the current major), TypeScript 7.
- `cf init .` added the Cloudflare Vite plugin. `cloudflare.config.ts` declares the `Room` Durable Object (SQLite) and routes only `/room/*` to the Worker; every other path is the Vite build. `enable_ctx_exports` is the default at our compatibility date, so the flag is gone.
- `worker/index.ts` is a pure relay: one socket per role, forwards messages to the other role, stores the latest `snapshot` and replays it to a late-joining Guide.
- Pure shared logic: `color.ts` (3-bit RGB masks), `lighting.ts` (tile light field with line of sight), `level.ts` (level format, validator, BFS solver over runner tile x lights on x substations).
- District 1 "Canal Street" is solvable, and the solver proves it can't be solved with zero streetlights, so the Guide is required.
- Verified in the browser against `cf dev`: two sockets in room TEST, ping forwarded, snapshot replayed to a reconnecting Guide.
- Vitest gets its own config so logic tests don't boot the Workers runtime.

## 12:50 M1 + M2: Runner, Guide, local co-op
- `?local=1` runs two Phaser games side by side, wired by an in-memory `LocalTransport`.
- Runner: tile movement (arrows/WASD, tap-to-move with BFS), a red lantern, raycast visibility polygons, and a lightmap. The lightmap is a render texture filled near-black; each light's polygon is added in its color, then the texture is multiplied over the scene. Overlaps mix for free: red lantern + blue streetlight = magenta.
- Guide: the whole map dimmed, the lit field as an additive overlay, gates and lamps with colorblind glyphs, a power budget, and pings with a 2s cooldown. Drones the Runner can't currently see get an "unseen" tag.
- Gates use the same pure `lighting.ts` field as the solver, so what the solver proves is what the game enforces. A bridge that loses its light while the Runner stands on it drops them back to the checkpoint.
- `scripts/playthrough.mjs` drives headless Chromium through district 1: it checks the bridge is hidden, pings it, switches the blue light on, crosses, powers the substation, and exits. No console errors.
- Pitfall: the in-app browser pane pauses `requestAnimationFrame` while hidden, which looked like "keys don't work". Headless Playwright is the reliable check.

![Magenta bridge](shots/d1-magenta-bridge.png)
![Ending](shots/after-d1.png)

## 13:00 First deploy, M3 network
- `cf deploy` worked on the first try: https://overlap.richardsun.workers.dev. The production Room relays pings, and the headless district 1 playthrough passes against production.
- Merged the audio track: every sound is synthesized (no samples), through sfx/ambient/drone buses into a limiter. Peaks were measured with `OfflineAudioContext` renders, since an agent can't listen.
- Merged the network track: `WebSocketTransport` with backoff reconnect, a DOM title screen with a 4-letter room code and a QR join link, and Playwright tests proving a ping round-trips through `cf dev` and that the title-screen join flow connects both roles.
- Added a fourth connection status, "replaced", so a tab whose role was taken by another device says so instead of looking online.

![Title](shots/title.png)
![Lobby](shots/lobby.png)

## 13:20 Districts 2–3, art pass, UI pass, and a solver bug the autoplayer caught
- **Districts.** "Market Lights" introduces green drones that hide in red light. "Old Locks" chains a yellow door, a two-tile cyan bridge (green + blue streetlights; the lantern doesn't matter), and a magenta door, with only 2 lights allowed at once. Tests prove each district is solvable, unsolvable without the Guide, and that walling up any single gate breaks it.
- **Art pass** (`src/render/`). Each light is a smooth radial falloff clipped by its shadow polygon and cached per streetlight. The lightmap uses a custom 2× modulate blend, so lit art can get brighter as well as darker. The city is baked into one texture per district: streets with lane dashes, roofs with facades, and a canal with shimmer. Powering a substation turns its block's windows on one by one. Lamps flicker when switched on. The Runner gets a vignette and grain; the Guide gets scanlines and a CRT edge.
- **UI pass** ("The Breaker Room", see [DESIGN.md](../DESIGN.md)). The title, HUD, and credits look like a utility room with the power off, with color only where light or live state exists. The title wordmark is lit by two streetlights and a red lantern that follows the pointer, so you see magenta and yellow before reading any rule.
- **Autoplayer.** The solver now returns its action plan, and `scripts/autoplay.mjs` plays every district in a real headless browser, waiting out drones and replanning after each death.
- **Bug it found.** The autoplayer died 49 times in a row in district 3's yellow door. The game sends the Runner back when the light under their door goes out, but the solver didn't know that rule. Its plan switched the green light off with the Runner standing in the doorway. The solver now never plans a toggle that strands the Runner, so solver and game agree again.
- **Tuning.** Even with that fixed, three drones guarding the only corridor east of the cyan bridge made district 3 a grind: each death meant re-raising the bridge. The drones are now about 20% slower, and the hit radius is half a tile.

![District 1, art pass](shots/d1-magenta-bridge.png)
![Title, UI pass](shots/title.png)
