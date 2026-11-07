# Overlap — Devpost writeup (draft)

## How to access

- **Play:** https://overlap.richardsun.workers.dev
- Two devices: on a laptop press **Play as Runner**, then scan the QR code with a phone (the Guide). Or type the 4-letter code under **Join as Guide**.
- One screen: https://overlap.richardsun.workers.dev/?local=1 shows both roles side by side.
- Runner: arrows / WASD, or tap a tile. Guide: tap a tile to ping, tap a streetlight to switch it.
- Source: (GitHub link)

## Inspiration

We wanted a co-op game where "visibility" is the whole mechanic, not a fog-of-war setting. One player can see everything but can't move. The other can move but sees almost nothing. The only way through is to combine what both of you can see.

## What it does

A city is in a blackout. The **Runner** walks the dark streets with a red lantern. The **Guide**, in the utility control room, sees the whole map, drops pings, and switches colored streetlights on and off within a power budget.

Light colors add. Red lantern + blue streetlight makes magenta, and some canal bridges exist only in magenta light. Red + green makes yellow, which opens locked doors. In the last district, green + blue streetlights make cyan for a bridge the lantern can't help with. Green security drones are invisible in red light, so the Guide has to warn the Runner with pings or flood the street with green.

Each substation the Runner reaches powers its block for good, moves the checkpoint, and gives the Guide more power. When the third district is lit, both screens show the same view for the first time.

Every color has a shape too (red triangle, green circle, blue square), so the game works without telling colors apart.

## How we built it

- TypeScript, Phaser 4, and Vite on the client. Every texture and sound is generated in code: there are no image or audio files.
- One Cloudflare Worker serves the client and routes `/room/CODE` to a Durable Object per room. The Room only relays messages and stores the last snapshot for late joiners.
- Both clients run the same pure light-field function, so lighting never goes over the network. Only changes are sent.
- A breadth-first solver proves every district is solvable within the power budget, that none can be solved without the Guide, and that every gate is needed. The same solver drives a headless autoplayer that plays the whole game in a real browser.
- The game was built by AI coding agents (Claude Code) directed by Richard Sun. A main session owned the shared contracts. Parallel agents in separate git worktrees built the network layer, audio, districts, art, and UI. The devlog and prompts are in the repo.

## Challenges

- **Keeping two screens honest.** The gate logic, the solver, and the renderer had to agree on exactly which tiles are lit. We made one pure function the source of truth for logic, and used the raycast polygons only for looks.
- **Colored light that reads.** Multiplying a lightmap over dark tiles turns red light into mud. We store the tiles brighter than the palette and let the lightmap darken them, then add a soft additive bloom so mixed colors pop.
- **Testing a game no one could watch.** The in-app browser pauses animation when hidden, which looked like broken input. Headless Playwright became the source of truth: a scripted district 1 run, a two-tab network test, and a solver-driven full playthrough.

## Accomplishments

- Real two-device play over the internet with a QR join, plus a one-screen mode for demos.
- Every district is machine-checked to need both players.
- No asset files at all.

## What we learned

Designing around information asymmetry is mostly about what each player *can't* see. The best moments came from the Guide realizing the Runner can't see the drone they're looking at.

## What's next

- A bonus "substation repair" district where the Guide fixes a broken logic rule.
- Lantern filters, so the Runner chooses colors too.
- A spectator view for showcases, and more districts.
