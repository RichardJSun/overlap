## Inspiration
We wanted a co-op game where visibility is the whole mechanic. One player can move but sees almost nothing. The other sees the city but can't move, and can see their partner only through the same light. The only way through is to put what each of you can see together.

## What it does
A city is in a blackout. The **Runner** walks pitch-black streets with a lantern. The **Guide** sits in the utility control room, sees the map and the security drones, drops pings, and switches colored streetlights on and off within a power budget. The streetlights are also the control room's only cameras, so the Guide sees the Runner only under a lit streetlight or inside a powered block. When the Guide loses them, the Runner flares their lantern.

Light colors add. A red lantern plus a blue streetlight makes magenta, and the first canal bridge exists only in magenta light. Red plus green makes yellow, which opens locked doors. Colored glass on the street changes the lantern's color, and in every district the glass brings colors that no streetlight has, so neither player can make the right mix alone. Drones show up only in their own color. One is red in a district with no red streetlights, so the Guide can only warn. Another is yellow and only appears where the Runner's red meets a green streetlight. The last door opens only in white light, which takes the lantern and two streetlights on one tile.

Each substation powers its block for good, moves the checkpoint, raises the Guide's power budget, and lets the lantern reach one tile farther. After five districts comes the main breaker. Somebody has flipped its safety rule, so the Guide rewrites it as a small CEL expression against three safety tests, while only the Runner can read the live gauges. The first rule that passes the tests still trips on the restart surge, so the two players have to talk it through. When the breaker holds, the separated colors slide back together into white and both screens show the same view for the first time.

The story has no narrator. It opens with the field tech asleep and dispatch calling. Each district opens on a resident's call about something strange and closes on a line in the utility's log. Every color also has a shape (red triangle, green circle, blue square), so the game works without telling colors apart.

## How to play
- Play at https://overlap.richardsun.workers.dev. Two computers work best. One player presses **Play as Runner** and sends the link or the 4-letter code to the other, who joins as the Guide. A phone can join by QR code, and a second browser tab works too.
- For one screen, https://overlap.richardsun.workers.dev/?local=1 shows both roles side by side.
- The Runner moves with the arrow keys, WASD, or a tap on a tile, and Space flares.
- The Guide taps a tile to ping, right-clicks or holds to warn, taps a streetlight to switch it, and uses Wait, Go and Flare? to signal without talking.
- District 1 is a tutorial that walks each player through their role.

## How we built it
- TypeScript, Phaser 4 and Vite on the client. Every texture and every sound is generated in code, and the repo has no image or audio files.
- One Cloudflare Worker serves the client and routes `/room/CODE` to a Durable Object per room. The room only relays messages and stores the last snapshot for players who join late.
- Both clients run the same pure light-field function, so lighting never goes over the network.
- A breadth-first solver proves that every district is solvable within the power budget, that none can be solved without the Guide, and that every gate is needed. The same solver drives a headless autoplayer that plays the whole game in a real browser.
- The breaker rule runs on CEL. It only returns true or false, and the Runner's client runs the safety tests again before the breaker closes.
- The UI is drawn as a sheet of the city's wiring drawing, with numbered notes whose leader lines point at the tile they mean.
- The game was built by AI coding agents (Claude Code) directed by Richard Sun. The build log and the key prompts are in the repo.

## Challenges we ran into
- **Keeping two screens honest.** The gate logic, the solver and the renderer had to agree on exactly which tiles are lit, so one pure function decides, and the raycast polygons are only for looks.
- **Colored light that reads.** Multiplying a lightmap over dark tiles turns red light into mud, so the tiles are stored brighter than the palette and the lightmap darkens them, with a soft additive bloom on top.
- **A logic puzzle that needs both players.** With the safety tests on screen, the Guide could solve the breaker alone. The live surge, which only the Runner can see, is what makes the first passing rule trip.
- **Testing a game nobody could watch.** Headless Playwright became the source of truth, with a scripted tutorial run, a two-browser network check through the real Worker, and a solver-driven playthrough of the whole game.

## Accomplishments that we're proud of
- Real two-device play over the internet with a QR join, plus a one-screen mode for demos.
- Every district is machine-checked to need both players.
- No asset files at all.

## What we learned
Designing around information asymmetry is mostly about what each player can't see. The best moments came when the Guide realized the Runner couldn't see the drone they were both talking about.

## What's next for Overlap
- Direction arrows for the Guide's signals.
- A spectator view for showcases, and more districts.
