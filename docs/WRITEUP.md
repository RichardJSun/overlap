# Overlap — Devpost writeup

## How to access

- **Play:** https://overlap.richardsun.workers.dev
- Two computers play best: one presses **Play as Runner** and sends the link (or the 4-letter code) to the other, who joins as the Guide. A phone can join by QR code, and a second browser tab works too.
- One screen: https://overlap.richardsun.workers.dev/?local=1 shows both roles side by side.
- Runner: arrows / WASD, or tap a tile; Space flares. Guide: tap a tile to ping, tap a streetlight to switch it.
- District 1 is a tutorial that walks each player through their role.
- Source: https://github.com/RichardJSun/overlap

## Inspiration

We wanted a co-op game where "visibility" is the whole mechanic, not a fog-of-war setting. One player can move but sees almost nothing. The other sees the city but can't move, and can see their partner only through the same light. The only way through is to combine what both of you can see.

## What it does

A city is in a blackout. The **Runner** walks pitch-black streets with a lantern. The **Guide**, in the utility control room, sees the map and the security drones, drops pings, and switches colored streetlights on and off within a power budget. The streetlights are also the control room's cameras: the Guide sees the Runner only under a lit streetlight or in a powered block, so the Runner flares their lantern to say "I'm here".

Light colors add. Red lantern + blue streetlight makes magenta, and the first canal bridge exists only in magenta light. Red + green makes yellow, which opens locked doors. Colored glass on the street changes the lantern's color, and in every district the glass brings colors that no streetlight has, so the two players have to combine what each of them holds. Drones show up only in their own color. One is red in a district with no red streetlights, so the Guide can only shout. Another is yellow and only appears where the Runner's red light meets a green streetlight. The last door in the city opens only in white light, which takes the lantern and two streetlights on one tile.

Each substation the Runner reaches powers its block for good, moves the checkpoint, gives the Guide more power, and lets the lantern reach a tile farther. There are five districts. When the last one is lit, the separated colors slide back together into white and both screens show the same view for the first time.

The story is told without a narrator. The game opens on the field tech asleep, with dispatch calling. After that, each district opens on a resident's call about something strange they've seen, and closes on a line in the utility's log.

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

## Playtesting

A fresh agent that wrote none of the code played every district and reported what was broken or confusing. That led to feedback when you bump an unlit bridge, catch notices for the Guide, a real "solo" button, district-cleared cards, bigger touch targets for streetlights, and a redesigned finale.

## What we learned

Designing around information asymmetry is mostly about what each player *can't* see. The best moments came from the Guide realizing the Runner can't see the drone they're looking at.

## What's next

- A bonus "substation repair" district where the Guide fixes a broken logic rule.
- A spectator view for showcases, and more districts.
