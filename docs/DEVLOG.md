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
