# Overlap

A two-player co-op puzzle game about a city in blackout, made for WolfJam 2026 (theme: **Visibility**).

**Play:** https://overlap.richardsun.workers.dev
**One screen, both roles:** https://overlap.richardsun.workers.dev/?local=1
**Source:** https://github.com/My-Name-Is-Jeff/overlap

![Red lantern plus blue streetlight raises the magenta bridge](docs/shots/d1-magenta-bridge.png)

## The idea

One player is the **Runner**. They walk the dark streets carrying a lantern and see only what light reaches. Outside the light there is nothing at all. The other player is the **Guide**, in the utility control room. The Guide sees the city map and its security drones, but sees the Runner only **on camera**: the streetlights are the control room's cameras, so the Guide sees the Runner only under a lit streetlight or inside a block that is back on the grid. The Guide drops pings and switches colored streetlights on and off within a power budget. The Runner can **flare** to show the Guide where they are.

Light colors add. Some bridges and doors exist only under a specific mixed color, and some drones show up only under theirs. Colored glass **filters** on the street change the Runner's lantern color, so both players choose colors. Neither player can see the solution alone, so the puzzles happen where the two players' lights overlap.

| Mix | Makes | Used for |
|---|---|---|
| red lantern + blue streetlight | magenta | canal bridges, the last door |
| red lantern + green streetlight | yellow | locked doors |
| green + blue streetlights | cyan | the bridge in district 3 (the lantern doesn't matter) |
| green streetlight alone | green | exposing green drones that hide in red light |

Every color also has a shape, so the game is playable without telling colors apart: red is a triangle, green a circle, blue a square, and mixes overlay their shapes.

Each substation the Runner reaches powers its block for good, moves the checkpoint, and gives the Guide more power. When every block is lit, both screens show the same view for the first time.

## How to play

1. On one computer, open the game and press **Play as Runner**. A 4-letter room code appears.
2. On a second computer, open the link (there's a **Copy link** button), or type the code under **Join as Guide**. Two computers play best. A phone works too: scan the QR code. So does a second browser tab.
3. Talk to each other. That's the game.

No second device? Open [`?local=1`](https://overlap.richardsun.workers.dev/?local=1) to get both roles side by side in one window.

| | Runner | Guide |
|---|---|---|
| Move | arrows / WASD, or tap a tile | — |
| Flare | Space, or tap yourself (4 s cooldown) | — |
| Ping | — | tap any tile (2 s cooldown) |
| Streetlight | — | tap a streetlight to switch it (power budget shown as bars) |

District 1 is a tutorial: each screen walks its player through their half of the game with numbered steps and a pointer over the tile to look at.

A drone touching the Runner sends them back to the last substation. If the Guide switches off the light holding up the bridge the Runner is standing on, the bridge vanishes, and so does the Runner. There are no lives and no game over.

## Theme

"Visibility" is the mechanic itself, in both directions. The Runner sees only what light reaches. The Guide sees the city but sees the Runner only through light too, because every streetlight is a camera. Switching a streetlight on both reveals the street to the Runner and reveals the Runner to the Guide. What one player can see, the other can't, and progress needs both views combined. The closest prior art we know is *Hue* (2016), where objects vanish when they match the background color. In Overlap, two players each control one light color and mix them to reveal the level.

## How it's built

```mermaid
flowchart LR
  subgraph Laptop["Runner (laptop)"]
    R[Runner scene<br/>authoritative: position, drones,<br/>substations, district]
  end
  subgraph Phone["Guide (phone)"]
    G[Guide scene<br/>authoritative: streetlights, pings]
  end
  subgraph CF["Cloudflare Worker"]
    W[fetch handler] --> DO[(Room Durable Object<br/>relay + last snapshot)]
  end
  R <-- WebSocket /room/CODE --> DO
  G <-- WebSocket /room/CODE --> DO
  R -. same pure lighting.ts .- G
```

- **Client:** TypeScript, Phaser 4, Vite. Every texture and every sound is generated in code. There are no image or audio files.
- **Server:** one Cloudflare Worker that serves the built client and routes `/room/CODE` to a SQLite-backed Durable Object per room. The Room does no game logic. It forwards messages to the other player and keeps the last snapshot, so a Guide who joins late (or reconnects) catches up.
- **Two kinds of seeing, one function.** The gate logic, the solver, the Runner's view, and the Guide's cameras (`onCamera` in [`src/shared/level.ts`](src/shared/level.ts)) all read the same pure light field.
- **Lighting is never sent over the wire.** Both clients compute the light field from shared state with the same pure function in [`src/shared/lighting.ts`](src/shared/lighting.ts). Messages go out only on change (a new tile, a toggled lamp, drones at most 5 times a second), which keeps a session well inside the Workers free plan.
- **Every district is proven solvable.** [`src/shared/level.ts`](src/shared/level.ts) has a breadth-first solver over (Runner tile, lights on, substations powered, lantern color) within the power budget. The tests check that each district can be solved, that it can't be solved without the Guide's lights, and that walling up any gate makes it unsolvable. The same solver drives a headless autoplayer ([`scripts/autoplay.mjs`](scripts/autoplay.mjs)) that plays the whole game in a real browser and waits out drones.

```
src/shared/   protocol, color masks, light field, level format + solver
src/scenes/   Runner, Guide, Ending
src/render/   procedural textures, visibility polygons, lightmap, post effects
src/net/      Transport interface, WebSocket and in-memory (?local=1) transports
src/audio/    procedural WebAudio
src/levels/   district JSON
worker/       Worker + Room Durable Object
```

## Run it locally

Needs Node.js 22.18+ and Bun (for installs).

```bash
bun install
bun run dev          # cf dev: client + Worker + Durable Object on http://localhost:5173
bun run test         # Vitest: color, lighting, levels and solver, audio
bun run e2e          # Playwright: two-tab room test through cf dev
node scripts/autoplay.mjs   # headless full playthrough of ?local=1 (needs a dev server)
node scripts/net-check.mjs  # two browsers play one room through the deployed Worker
node scripts/record-demo.mjs http://localhost:5173 docs/demo.mp4   # demo video with the game's own sound
bun run deploy       # cf deploy
```

## Made with AI

Overlap was built in one day by AI coding agents (Claude Code), directed by Richard Sun. A main session owned the shared contracts and integration. Parallel agents built the network relay, the audio, the districts, the art, and the UI design, each in its own git worktree. The build log is in [docs/DEVLOG.md](docs/DEVLOG.md), and the key prompts are in [docs/PROMPTS.md](docs/PROMPTS.md). The original plan is [HANDOFF.md](HANDOFF.md).

Made at WolfJam 2026 by Richard Sun.
