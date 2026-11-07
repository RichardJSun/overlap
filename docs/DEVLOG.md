# Overlap devlog

Timestamped notes from the WolfJam 2026 build (theme: Visibility). Times are EST, Sat Nov 7, 2026.

## 12:27 Start
Empty repo. Plan and rules live in [HANDOFF.md](../HANDOFF.md).

## 12:40 M0 scaffold
- Vite 8 + Phaser 4.2 client (the handoff said Phaser 3; we took the current major), TypeScript 7.
- `cf init .` added the Cloudflare Vite plugin. `cloudflare.config.ts` declares the `Room` Durable Object (SQLite) and routes only `/room/*` to the Worker; every other path is the Vite build. `enable_ctx_exports` is the default at our compatibility date, so the flag is gone.
- `worker/index.ts` is a pure relay: one socket per role, forwards messages to the other role, stores the latest `snapshot` and replays it to a late-joining Guide.
- Pure shared logic: `color.ts` (3-bit RGB masks), `lighting.ts` (tile light field with line of sight), `level.ts` (level format, validator, BFS solver over runner tile x lights on x substations).
- District 1 "Canal Street" is solvable, and the solver proves it can't be solved with zero streetlights, so the Guide is required.
- Verified in the browser against `cf dev`: two sockets in room TEST, ping forwarded, snapshot replayed to a reconnecting Guide.
- Vitest gets its own config so logic tests don't boot the Workers runtime.
