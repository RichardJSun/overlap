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

## 13:40 Protocol change: lantern filters and flares
Design calls from Richard: the Guide sees the Runner only "on camera", inside a lit streetlight or a powered block. The Runner can flare to show where they are. Lantern color changes through filter pickups. Darkness is pitch black and roofs stay dark. District 1 becomes a guided tutorial.
- Level format: optional `filters: {x, y, color}[]`, primaries only, so a lantern alone never reveals a mixed gate. They are not consumed.
- Solver: lantern color joins the BFS state `(tile, lights on, substations, lantern)`. A new test shows a corridor that is unsolvable until the lantern picks up a green filter.
- `onCamera()` is a pure function next to the solver. The lantern doesn't count, by design.
- Protocol: `Snapshot.lantern`, `{t:"lantern", c}` when the Runner picks up a filter, and `{t:"flare", p}`.
- The tag `submittable-v1` marks the live build from before these changes, in case they don't land.

## 13:55 Fresh-eyes playtest, then three design changes
A subagent that wrote none of the code played every district headless and reported back. What it found and what we did:
- **District 3's obvious route was a drone trap.** Each catch sent the Runner back across the canal, so the Guide had to rebuild a two-light bridge. Districts 2 and 3 are being redesigned with checkpoints after expensive setups, alternate lanes at drone crossings, and a streetlight camera over each one.
- **Bumping an unlit bridge said nothing.** Now the Runner hears "A bridge is here, but it only exists in magenta light." Doors say the same, and the dark exit already did.
- **The Guide never heard about catches.** The Guide now gets a toast when the Runner is sent back.
- **The solo path was a small text link.** It is now a full-width button.
- **No beat between districts.** A "District restored" card now shows before the next district loads.
- **Phone streetlights were too small to hit.** A touch now snaps to a streetlight within a tile and a half.
- **"Lamp" vs "streetlight".** It's "streetlight" everywhere now.
- **The ending had no stats.** The credits now show run time and catches (new optional fields on the `ending` message).
- A "full game reset" it saw once was a Vite hot reload, caused by the main session editing `main.ts` mid-playtest. Lesson: never edit `src/` while an agent is driving the HMR dev server. Recordings and autoplay now run against a frozen `vite preview` build.

Richard's design calls, all built:
- **The Guide sees the Runner only on camera.** Streetlights are the control room's cameras. Off camera, the Guide gets a "last seen Ns ago" ghost, and the Runner's lantern pool is hidden too, since it would give the position away. Switching a streetlight on now does two jobs: it mixes color for the Runner and lets the Guide watch them. **Space** (or tapping yourself) flares the lantern so the Guide's cameras catch the Runner for 2.5 s.
- **Darkness is pitch black.** There are no faint outlines outside light, and roofs stay black even inside a light pool. Only streets and street-facing walls catch light, so buildings read as silhouettes. Wall-mounted streetlights are excluded so they still show.
- **Lantern filters.** Colored glass on the street recolors the lantern. The solver searches lantern color too.
- **District 1 is a tutorial.** Numbered coach steps per role and a bobbing pointer over the tile that matters: walk, flare, listen for pings, and the magenta bridge for the Runner; cameras, ping, the blue streetlight, and the substation for the Guide. Later districts show a one-off tip the first time a filter or an unseen drone comes up. The Guide's coach only knows the last-seen position, so the tutorial can't leak where the Runner is.

Mistake of the hour: a scratch worktree's `node_modules` was a symlink, which the `node_modules/` (directories only) ignore rule missed. It got committed, and the merge replaced the real folder with a link to itself. Fixed, and the rule is now `node_modules`.

![Tutorial, both roles](shots/tut-flared.png)

## 14:05 Redesigned districts, demo video, production checks
- **Districts 2 and 3 rebuilt around filters.** District 2's only way out of the start yard is green glass, and the green lantern plus a blue streetlight raises a cyan bridge. Then the Runner needs red for the yellow door, so the Guide supplies it. District 3 needs both glasses in order, a two-light cyan bridge, and two locks. Every crossing has a second lane and a streetlight camera over it, and no catch sends the Runner back across the canal. A test removes each filter in turn and checks the district breaks or gets longer.
- **Autoplay, all three districts:** 52 s, 162 actions, **zero catches**, no console errors. The old district 3 took 157 s with 30 catches.
- **Demo video** (`scripts/record-demo.mjs`): 90 s at 1440×810. It records the title and a `?local=1` playthrough in headless Chromium. Playwright can't record audio, so every sound call is logged with a timestamp and re-rendered afterwards through an `OfflineAudioContext` with the game's own synth code, then muxed with ffmpeg. The sound in the video is exactly what the game plays.
- **Two-browser check on production** (`scripts/net-check.mjs`): the Runner starts from the title, the Guide joins by link on an iPhone-sized viewport, and moves, the off-camera rule, flares, and streetlights all cross the real Worker.

![Network check, Guide on a phone](shots/net-guide-phone.png)

## 14:35 Second playtest, and a quieter HUD
A second fresh agent played the live build: the tutorial, filters, cameras, and the phone Guide. Fixes:
- **The tutorial skipped the color lesson, then went blank twice.** The bridge step waited until the Runner was near the bridge, by which time the Guide had already lit it. After crossing, the step "undid" itself as the bridge went dark behind them. Now the step shows right after the ping, and "the bridge has opened" sticks once it happens.
- **"Power 1/2" read as substations.** It's now **Lights**.
- **"Ping a warning" had no warning.** Right-click (or hold on a phone) now sends a **danger ping**: a red "!" and a buzz on the Runner's side.
- **"The exit is lit" lit nothing.** The open exit now glows warm on both screens.
- **The "last seen" ghost:** hidden until a Runner is in the room, reset each district, moved to the checkpoint after a catch, and its label moved below it so the tutorial pointer doesn't cover it.
- **Phone:** the streetlight tap target shrank from 1.5 to 1.1 tiles, so you can ping next to one.
- **Copy:** gates need *all* their colors in the light (extra colors don't hurt). The title and README now say that instead of "the right mix".

Richard's notes, also done:
- The Runner's tutorial pointer no longer marks tiles that are dark for the Runner (it was pointing at the substation and exit through the blackout).
- Two computers is the main way to play: the lobby leads with a copyable link, and the QR code is the phone option.
- **The HUD showed too much at once.** We removed the Guide's two-line instruction strip, which repeated the tutorial, title, and tips. The Guide's bottom bar is one row, giving the map 20px more on phones. Goal lines are a few words. The connection pill is hidden in one-screen mode.
- **Filters gave colors the streetlights already had.** Districts 2 and 3 are being redesigned so the Runner's glass colors and the city's streetlight colors never overlap, enforced by the validator.

![Quieter HUD](shots/d1-magenta-bridge.png)

## 15:10 White light, a story, and cameras you can feel
- **White comes apart.** Richard pointed out that white light is all the colors together, so the opener now starts with every streetlight burning white. When the grid fails, each white light splits into red, green, and blue, which drift apart and die one by one. The ending runs it backwards: separated colors slide together into white as the power sweeps back on.
- **Story.** A Mythos review suggested a light radio story, and Richard's note was that the first draft of the dialogue was dull and read like a physics lecture. The story is now told only through in-world records. The opener is the utility's log ("20:43 · Calls from Canal Street. Every streetlight has split into red, green and blue."). Each district opens on a resident's call that hints at its trick ("There's a bridge over the canal, but it only shows up when the light turns purple."). Each district closes on a log line with a concrete detail ("Someone is already selling soup."). A burst of radio static plays before each call.
- **Cameras.** The blackout breaks into analog static, and the log says the streetlights are the only cameras left. The Guide's map carries faint live static, and every lit streetlight gets a CAM tag. We kept the full map for the Guide instead of making them flip between camera feeds, because planning colors and the power budget needs the whole map.
- **Legibility pass.** Streets are clearly lighter than roofs, and the canal reads as water. Streetlight heads carry their color and shape. Bridges are plank decks over the water, doors are glowing bars, the substation is a big ⚡, the exit has a sign, and glass is a gem. The Guide's map went from 55% to 92% opacity.
- **Districts 2 and 3** now split colors between players. District 2 has blue streetlights while the Runner brings red and green. District 3 has green streetlights while the Runner brings red and blue. The validator rejects a district where a streetlight shares a channel with any lantern or glass color.
- The title now leads with the camera idea and shows red + green + blue = white.

![Opener, white splitting](shots/title.png)

## 15:20 A phone call, and a lantern that grows
- **Cold open.** Richard pitched starting with the field tech asleep and the phone ringing. The opener now draws a dark bedroom in Canvas2D: a bed with someone in it, a nightstand, and a window full of white city lights. A phone buzzes on the nightstand with a synthesized ringtone. Pressing any key answers it, so the first thing a player does is pick up. Dispatch apologises for the hour while the skyline in the window splits into red, green, and blue and dies, then the scene cuts to the street for the blackout.
- **The lantern grows.** It starts every district at 3 tiles and reaches one tile farther per substation powered, up to 5. The solver models the reach, so all three districts are still proven solvable. A flare throws the light about twice as far for a second, as a visual only, so a gate or drone can never vanish under the Runner when the flare fades.
- We turned down random lights-out events, because they would drop players off bridges for no reason of their own, and the solver can't prove timed events fair.

## 15:30 Five districts, and a new demo
- **District 4, "Signal Yard"** (from the Mythos review). The Runner brings blue and red, and the city has only green. A slow red drone crosses the plaza in front of the cyan bridge, and no streetlight can show it, so this is the first district where the Guide's lights can't help and only their danger pings can.
- **District 5, "Grid Central".** The Runner brings only red, and the city has green and blue. A yellow drone exists only where the Runner's red meets a green streetlight, which makes "overlap" a hazard and not just a key. The last door needs white, so the Guide parks two streetlights over the door and the Runner brings the third color.
- Both are solver-proven like the rest: solvable within budget, unsolvable without the Guide, every gate and filter necessary. **Autoplay across all five districts took 82 s, 292 actions, and zero catches.**
- **Demo video, take 3:** 2:33 with the cold open, the tutorial, all five districts, and the white-light ending, with the game's own synthesized sound re-rendered offline.

![District 5](shots/d5-sub2.png)

## 15:45 Polish, and the lantern readout goes
- Richard asked whether the Runner needed the lantern's tile count at the bottom of the screen. It didn't, so the goal line now names only the substations or the exit. District 2 has one name everywhere ("Market Street"), and the tutorial and tips no longer hinge on colons.
- The Guide's goal line also stopped showing the lantern color. The Guide learns it from the camera, when the Runner's light pool is in view, or by asking.

## 16:00 The Main Breaker
- A sixth room after Grid Central. The main breaker keeps tripping because somebody flipped its safety rule to `load > capacity`. The Guide edits the rule, a CEL expression evaluated by `@marcbachmann/cel-js`, and watches three safety tests pass or fail while they type. Only the Runner can see the live gauges, and the restart surge has pushed the load to 104 MW against a 100 MW capacity.
- The first rule that passes the tests, `line_clear && load < capacity`, still trips. The Runner has to read the gauges out and turn the override key, and the Guide has to add the key without breaking the "crew on the line" test. `line_clear && load < capacity || override` fails that test because of operator precedence, so the working rule needs parentheses.
- The Runner's client runs the tests again before it lets the breaker close, so a Guide can't install `true`. CEL only returns a boolean, and the game owns every side effect.
- A Guide who joins late or reloads goes straight to the breaker. Scenes that have stopped now ignore network messages. Autoplay and the two-browser network check both play the breaker.

![Main Breaker](shots/breaker.png)

## 16:40 The city's wiring drawing
- Richard said the UI looked like slop. Every label sat in a small chip or a 1px box, the generic dark-dashboard look. We ran the impeccable design workflow: a concept roll, four HTML mockups laid over a real game screenshot, and Richard's pick. He liked the carbon-copy work order but not bright paper on a dark game, so we built the one-line schematic sheet.
- Every screen is now a sheet of the city's wiring drawing. The title has a drawing border, a bus diagram whose three lamps are the lights that reveal the wordmark, numbered general notes, and a title block that holds Play and Join. Tutorial steps are numbered notes with a leader line that ends on the tile they mean. Toasts sit under a dimension line. The goal and the Guide's console are title-block cells, and the power budget is a row of breaker symbols. The breaker room is a one-line diagram with a switch blade that swings shut and a load needle with mass. The credits are the drawing's last revision.
- The lit OVERLAP wordmark is the one thing that stayed, at Richard's request.

![Title sheet](shots/title.png)

## 17:10 Signals without voice
- The Guide's console has Wait, Go, and Flare? buttons. Each one shows as a callout over the Runner's head for two seconds, readable in the dark. Flare? also tells the Runner how to flare. The Guide's tutorial teaches Flare? in its first step and Wait and Go in its last.
- On a phone the console wraps to two rows, and the map moves up to stay clear of it.
