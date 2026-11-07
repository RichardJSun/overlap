# Overlap (WolfJam 2026) handoff

Working title is **Overlap**. Rename freely.

## Hard constraints

- Deadline: **Sat Nov 7, 2026, 11:00pm EST** on Devpost (wolfjam-2026.devpost.com). Nothing ships after that.
- Theme: **Visibility**.
- Judging criteria: Creativity, Documentation, Theme, Gameplay, Design (looks and sounds).
- Devpost submission needs a playable link or access instructions (itch.io is suggested, not required), source (GitHub), a short writeup, and a demo video.
- All art and audio are generated in code. No external asset packs, no image generation tools.
- Git commits are authored as `Richard Sun <sunr5@rpi.edu>`.
- Always keep the game in a submittable state. Commit and push after every milestone.

## Pitch

A city is in a blackout and the world is adjusting to being reconnected. Two players work together on two devices.

- The **Runner** walks the dark streets with a colored lantern and sees only what light reaches.
- The **Guide** sits in the utility control room, sees the whole map, drops pings, and switches colored streetlights on and off.
- Light colors add. Red lantern plus blue streetlight makes magenta. Some bridges, doors, and hazards only exist or show up under specific colors, so the puzzles happen where the two players' lights overlap.
- Each substation the Runner reaches restores power to a block for good. The ending is the whole city lit, with both screens showing the same view for the first time.

Prior art note for the writeup: Hue (2016) hides objects that match the background color. Our new part is two players each controlling one color and mixing them to reveal the level.

## Agent setup

- **Main session** runs on the strongest model in the picker (Fable 5.1 if available, otherwise Opus 5.5). It owns `src/shared/protocol.ts`, `src/shared/color.ts`, `src/shared/lighting.ts`, integration, merges, and the final call on every design question.
- **Subagents on Opus** for tracks that need judgment and touch rendering or networking:
  - Worker relay, `WebSocketTransport`, Playwright two-tab test
  - `render/visibility.ts`, lighting visuals, procedural textures
  - Procedural audio
  - Level design and the solvability checker
- **Subagents on Sonnet** for well-specified, checkable chores: DEVLOG screenshot passes, README and Devpost writeup drafts, test boilerplate, lint fixes.
- Usage isn't really the constraint today; integration bugs are, and stronger models make fewer of them.
- Run parallel subagents in separate git worktrees. Each track owns its own directories. Subagents treat `protocol.ts` as read-only and ask the main session for changes.
- Before M6, a fresh subagent that wrote none of the code plays through all districts in `?local=1` with Playwright, screenshots each district, and reports anything broken or confusing.

## Stack

| Piece | Choice |
|---|---|
| Client | TypeScript, Vite, Phaser 3 (latest 3.x) |
| Backend | One Cloudflare Worker with one SQLite-backed Durable Object per room |
| Cloudflare tooling | `cf` CLI (open beta) with `cloudflare.config.ts` and `@cloudflare/vite-plugin`. Do not use Wrangler or `wrangler.toml` |
| Hosting | The same Worker serves the Vite client build as static assets. One deploy, one origin, HTTPS and WSS included |
| Tests | Vitest (logic), Playwright (screenshots, two-tab network test) |
| Runtime | Node.js 22.18 or later. Not Bun (`cf` can't load `cloudflare.config.ts` under Bun) |

Not Godot. Everything must be text that Claude can write, run, and screenshot headlessly, and the Guide plays on a phone where a small JS bundle loads fast.

### cf notes

`cf` is in open beta, so commands and config can change. When unsure of syntax, run `cf cli search "<task>"`, `cf <command> --help`, or read https://developers.cloudflare.com/cf/llms.txt. Don't guess flags.

- Install: `npm i -g cf` once, and `npm i -D cf` in the project so `cf/config` resolves.
- Login: `cf auth login` (separate from any Wrangler login). Richard does this on his machine.
- `cf init .` inside the existing Vite app creates `cloudflare.config.ts` and installs `@cloudflare/vite-plugin`.
- `cf dev` runs Vite and the Worker (including the Durable Object) locally. `cf deploy` builds, uploads, and makes the version live.
- `cloudflare.config.ts` has no `assets.directory`. In a Vite project the static assets are Vite's client build output.
- `package.json` must have `"type": "module"`.
- `tsconfig.json` needs `"allowImportingTsExtensions": true`, `"noEmit": true`, and `.cloudflare/types` in `include` for the generated `Env` types.
- **Fallback:** if `cf` blocks deploys tonight for a beta reason, drop back to Wrangler with an equivalent `wrangler.jsonc` rather than debugging the beta. Note it in DEVLOG.

## Repo layout

One Vite project. Client and Worker live together so `cf dev` runs both.

```
/
  HANDOFF.md
  package.json            # "type": "module"
  cloudflare.config.ts
  vite.config.ts          # phaser client + cloudflare() plugin
  tsconfig.json
  index.html
  src/                    # client
    main.ts
    shared/
      protocol.ts         # message types, the contract between all tracks
      color.ts            # RGB bitmask helpers
      lighting.ts         # light field computation (pure, no Phaser)
      level.ts            # level types + loader + validation
    levels/
      d1.json d2.json d3.json
    net/
      transport.ts        # Transport interface
      ws.ts               # WebSocketTransport
      local.ts            # LocalTransport (same window, no network)
    scenes/
      Boot.ts Title.ts Runner.ts Guide.ts Ending.ts
      SplitLocal.ts       # both views side by side, for ?local=1
    render/
      visibility.ts       # raycast visibility polygon for shadows
      textures.ts         # all procedural art
    audio/
      sfx.ts              # procedural WebAudio
  worker/
    index.ts              # fetch handler + Room Durable Object
  tests/
  docs/
    DEVLOG.md             # timestamped notes + screenshots, feeds Documentation score
    PROMPTS.md            # key prompts used, since the game is AI-made
```

### cloudflare.config.ts (starting point, verify against cf docs)

```ts
import { defineConfig, exports } from "cf/config";
import * as entrypoint from "./worker/index.ts" with { type: "cf-worker" };

export default defineConfig({
  worker: {
    name: "overlap",
    entrypoint,
    compatibilityDate: "2026-11-07",
    compatibilityFlags: ["enable_ctx_exports"],
    assets: { runWorkerFirst: ["/room/*"] },
    exports: {
      Room: exports.durableObject({ storage: "sqlite" }),
    },
    // domains: ["overlap.<richard's domain>"],  // optional, see Deploy
  },
});
```

The Worker reaches its own class through `ctx.exports.Room` (enabled by `enable_ctx_exports`), so no `env` binding is needed.

## Core rules

### Grid and movement

- Tile size 32px. Each district is about 24x16 tiles.
- Runner moves tile to tile (arrows or WASD, tap-to-move on touch), tweened over ~120ms.
- Walls block movement and light.

### Color

Colors are 3-bit RGB masks.

```ts
// src/shared/color.ts
export const R = 0b100, G = 0b010, B = 0b001;
export type ColorMask = number; // 0..7
export const NAMES = ["black","blue","green","cyan","red","magenta","yellow","white"];
export const mix = (...cs: ColorMask[]) => cs.reduce((a, c) => a | c, 0);
export const reveals = (lit: ColorMask, required: ColorMask) =>
  required !== 0 && (lit & required) === required;
```

- Light at a tile is the OR of every light source that reaches it (line of sight, within radius, walls block).
- A color-gated tile (bridge, door, platform) **exists** for the Runner when `reveals(lit, required)`. Otherwise a bridge is a gap and a door is a wall.
- A hazard of color `c` is **visible to the Runner** only when `reveals(lit, c)` at its tile. The Guide always sees hazards.
- Keep white light rare in level design, since it reveals everything.
- Every color also gets a distinct glyph or stripe pattern on gated tiles and lights, so colorblind players can play.

### Light sources

| Source | Owner | Color | Radius |
|---|---|---|---|
| Lantern | Runner | set per district in level data | 4 |
| Streetlight | Guide toggles | fixed per light in level data | 3 to 5 |
| Powered block | Substation | warm white glow, cosmetic only, does not reveal gated tiles | whole block |

- The Guide has a **power budget**: at most N streetlights on at once (N per district, rises after each substation).

### Guide actions

- Tap a tile to **ping**. 2s cooldown. The Runner sees a pulsing marker for 3s, even in darkness.
- Tap a streetlight to toggle it, subject to the power budget.
- Guide view shows full map, Runner position, all hazards, all gated tiles with their required color, and the current lit field as a faint overlay.

### Hazards

- Security drones patrol fixed waypoint loops. Each has a color.
- Touching a drone sends the Runner back to the last substation checkpoint. No lives, no game over.

### Progress

- Each district has 1 to 2 substations. Reaching one powers its block, checkpoints, raises the budget.
- All substations in a district open the exit to the next district.
- After district 3, play the Ending scene.

### Districts

1. Tutorial. Movement, one ping prompt, one blue streetlight, one magenta bridge (red lantern + blue light). No hazards.
2. Drones. Green drones invisible under red/blue light. Guide must warn with pings or switch on a green streetlight to expose them.
3. Combined. Two drone colors, power budget of 2, a door that needs yellow (red lantern + green light) and a bridge that needs cyan (two streetlights, Runner's lantern irrelevant).

Level JSON is hand-authored. Write a validator in `level.ts` and a Vitest test that loads every level and checks each district is solvable by BFS over (runner tile, set of lights on) within the budget.

## Networking

### Model

- Runner client is authoritative for Runner position, drones, substations, district index.
- Guide client is authoritative for streetlight states and pings.
- Both clients compute the light field locally from shared state with the same pure `lighting.ts`, so lighting is never sent over the wire.
- The Room Durable Object does no game logic. It forwards messages to the other socket in the room and keeps the latest `snapshot` so a late joiner can sync.

### Message budget

Workers free plan allows 100,000 requests per day and WebSocket messages count. Send on change, never per frame.
- `runner_move` only when the Runner enters a new tile.
- `drones` at most 5 per second, and only when a drone changes tile.

### Protocol

This file is the contract between tracks. Change it only from the main session, with a note in DEVLOG.

```ts
// src/shared/protocol.ts
export type Role = "runner" | "guide";
export type Vec = { x: number; y: number };

export type Msg =
  | { t: "hello"; role: Role }
  | { t: "peer"; connected: boolean }                 // server -> client
  | { t: "snapshot"; s: Snapshot }                    // runner -> server -> guide
  | { t: "runner_move"; p: Vec }
  | { t: "drones"; d: { id: string; p: Vec }[] }
  | { t: "ping"; id: string; p: Vec }
  | { t: "light"; id: string; on: boolean }
  | { t: "substation"; id: string }
  | { t: "district"; index: number }
  | { t: "ending" };

export type Snapshot = {
  district: number;
  runner: Vec;
  lightsOn: string[];
  substationsPowered: string[];
  drones: { id: string; p: Vec }[];
};
```

### Transport

```ts
// src/net/transport.ts
export interface Transport {
  send(m: Msg): void;
  onMessage(cb: (m: Msg) => void): void;
  onPeer(cb: (connected: boolean) => void): void;
  close(): void;
}
```

- `WebSocketTransport` connects to the same origin the page was served from: `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/room/{CODE}?role={role}`. Auto-reconnect with backoff, resend `hello` on reconnect.
- `cf dev` serves the client and the Worker on one origin, so local dev uses the same code path as production. No proxy.
- `LocalTransport` pairs two in-memory endpoints. `?local=1` loads `SplitLocal` with Runner and Guide side by side in one window. This is the showcase fallback if venue Wi-Fi blocks the connection, and the main dev loop.

### Worker and Room

- `GET /room/:code` with `Upgrade: websocket` routes to `ctx.exports.Room.get(ctx.exports.Room.idFromName(code))`. `runWorkerFirst: ["/room/*"]` makes sure these requests reach the Worker before asset handling.
- Every other path is served from the static assets. Do not enable single-page-app fallback; the game is one `index.html` that reads query params.
- Room uses the Hibernation API: `this.ctx.acceptWebSocket(server, [role])`, `ws.serializeAttachment({ role })`.
- Max one socket per role. A second socket for the same role replaces the first.
- On `snapshot`, store it with `this.ctx.storage.put("snapshot", s)`. On guide connect, send the stored snapshot if present.
- Validate that messages parse as JSON and are under 4 KB. No CORS or auth needed for a jam.

### Joining

- Title screen: "Play as Runner" creates a 4-letter room code (no ambiguous letters like O/0, I/1) and shows it large, plus a QR code (npm `qrcode`) that links to `${location.origin}/?room=CODE&role=guide`. This is the main join path.
- "Join as Guide" also has a 4-letter code input, for players who can't scan.
- Show connection state in the corner of both views (connected, waiting for partner, reconnecting).

## Rendering and art

All textures are generated at runtime in `render/textures.ts` with Phaser Graphics + `generateTexture`, or inline SVG strings loaded as textures.

### Palette

| Use | Hex |
|---|---|
| Night background | `#0b1020` |
| Wall / building | `#1b2238` |
| Wall edge highlight | `#2c3758` |
| Street | `#141a2e` |
| Warm powered glow | `#ffd38a` |
| Light red | `#ff4d5e` |
| Light green | `#4dff88` |
| Light blue | `#4d8bff` |
| UI text | `#e8ecff` |

Mixed light colors come from additive blending of the three base colors, so they don't need their own entries.

### Runner view

- Base layer is the full map drawn dark.
- Light layer: for each light source, compute the raycast visibility polygon (`render/visibility.ts`, rays to wall corners) clipped to the radius, fill with the light color at low alpha, blend mode `ADD`. Overlaps mix for free.
- Everything outside any light is near-black. Gated tiles render only where `reveals()` passes.
- Ping markers draw on top of darkness.
- A soft vignette and slight film grain set the mood.

### Guide view

- Top-down "control room monitor" look. Thin scanlines, slight green tint on the frame, a clock, the power budget as bars.
- Full map visible at reduced brightness, lit field overlaid, Runner as a bright dot with a trail.
- Must work in portrait on a phone. Scale the map to fit width, put controls below.

### Ending

Every block powers on in a sweep from the last substation outward. Then both clients swap to the same fully lit street view with both characters visible together. Credits list "Made at WolfJam 2026" and the team.

## Audio

Procedural WebAudio in `audio/sfx.ts`. Unlock on first user gesture (required on iOS).

- Footstep: short filtered noise burst, slight random pitch.
- Ping: two-tone sine blip with short delay echo.
- Streetlight on/off: low hum swell / click.
- Substation: rising major chord, then sustained warm pad.
- Drone nearby: buzzing saw wave, volume by distance, only when the drone is visible.
- Ambient: quiet low drone pad that brightens a little with each substation.
- Mute toggle in both views.

## Milestones

Each milestone ends with: tests pass, a screenshot added to `docs/DEVLOG.md`, commit, push.

| # | Goal | Done when |
|---|---|---|
| M0 | Scaffold | Vite + Phaser app, `cf init .` done, `cf dev` serves a Phaser scene and answers `/room/TEST` with a WebSocket, `npm test` runs |
| M1 | Runner solo | District 1 playable in one tab with darkness, lantern, walls blocking light |
| M2 | Local co-op | `?local=1` split view, Guide sees map, pings and streetlight toggles work, color gates work |
| M3 | Network | Two tabs join the same room through `cf dev`, Playwright test proves a ping round-trips |
| M4 | Content | Districts 2 and 3, drones, substations, checkpoint respawn, ending |
| M5 | Polish | Procedural art pass, audio, colorblind glyphs, title screen, QR join, mobile Guide layout |
| M6 | Ship | `cf deploy` live, QR join tested phone-to-laptop, README written, fresh-agent playthrough clean |

**M2 is the minimum submittable game.** If time runs short, deploy with `?local=1` as the default and say so in the writeup.

### Parallel tracks

After M0 and with `protocol.ts` fixed, these run as separate subagents in worktrees (see Agent setup):
- Core gameplay (M1, M2, M4) on the main session.
- Worker relay + `WebSocketTransport` + Playwright test (M3), developed against `LocalTransport` behavior.
- Rendering and art (M5 visuals), developed against a static test scene.
- Audio (M5 audio), developed against a button test page.
- Levels 2 and 3 + solver tests, developed against `level.ts` types.

## Testing

- Vitest: `color.ts`, `lighting.ts` (walls block light, overlaps OR together), level validator, solvability BFS for every district.
- Playwright: launch headless Chromium, take screenshots of Runner and Guide views for the DEVLOG, run the two-tab room test against `cf dev`.
- Before M6, manually check on an iPhone-sized viewport (Guide) and a laptop viewport (Runner).

## Deploy

- `cf deploy` from the repo root builds the client and Worker and makes the new version live. Richard runs `cf auth login` once on his machine first.
- The free `*.workers.dev` URL is already HTTPS and is enough to submit.
- Custom subdomain (optional): add it to `worker.domains` in `cloudflare.config.ts`. This needs the domain's zone on Cloudflare. If the domain's DNS lives elsewhere, skip it and use `workers.dev`.
- itch.io (optional): a page with screenshots, the trailer, and a link to the hosted game. Don't upload an HTML5 build there, since the iframe breaks the QR join flow.

## Submission checklist

- [ ] Hosted game URL works on a laptop (Runner) and a phone (Guide), and `?local=1` works on one laptop
- [ ] Devpost "how to access" note: the URL, "needs two devices, or add `?local=1` for one screen", controls
- [ ] GitHub repo public with README (pitch, how to play, how to run, architecture diagram, AI-made disclosure)
- [ ] Devpost writeup: theme interpretation, how the color mixing works, what was hard, what's next
- [ ] Demo video under 3 minutes, showing both screens side by side (record `?local=1`)
- [ ] `docs/DEVLOG.md` and `docs/PROMPTS.md` linked from README
- [ ] (Optional) itch.io page that links to the hosted game
- [ ] Submit before 11:00pm EST

## Stretch goals

Build these in order once M6 is done and deployed. Each one must leave the game shippable, so redeploy after each.

1. **CEL substation.** A bonus district where the Guide repairs a broken one-line rule (for example `load < capacity || override`) in a small editor. Use `@marcbachmann/cel-js`, show available variables next to the editor, catch parse errors with a friendly message. The game owns all side effects; CEL only returns a boolean.
2. **Lantern filters.** Pickups that change the Runner's lantern color mid-district, so the Runner also chooses colors.
3. **Spectator view.** A third join role that shows both screens side by side, for the showcase projector.
4. **More districts** using existing mechanics.
5. **Quick emotes** for the Guide (arrow, stop, wait) on top of pings.
6. **Run timer** and a per-room completion time on the ending screen.

Extra stretch: accounts, matchmaking, more than two players per room, save files.
