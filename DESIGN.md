---
name: Overlap
description: A two-player blackout co-op game, styled as the city's breaker room with the lights off.
colors:
  night: "#0b1020"
  wall: "#1b2238"
  wall-edge: "#2c3758"
  street: "#141a2e"
  powered: "#ffd38a"
  light-red: "#ff4d5e"
  light-green: "#4dff88"
  light-blue: "#4d8bff"
  mix-magenta: "#ff4dff"
  mix-yellow: "#ffe14d"
  mix-cyan: "#4dffff"
  ink: "#e8ecff"
  ink-dim: "#a9b1d6"
  ink-faint: "#7d87b2"
  tape-highlight: "rgba(232, 236, 255, .09)"
  tape-shadow: "rgba(0, 0, 0, .5)"
typography:
  display:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontStretch: "condensed"
    fontSize: "clamp(84px, 27vw, min(320px, 33vh))"
    fontWeight: 700
    lineHeight: 0.8
  display-lobby:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "clamp(64px, 16vw, min(168px, 18vh))"
    fontWeight: 700
    lineHeight: 0.8
  room-code:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "clamp(104px, 30vw, 220px)"
    fontWeight: 700
    lineHeight: 0.8
  heading:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
  credit-headline:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "clamp(28px, 3.2vw, 40px)"
    fontWeight: 700
    lineHeight: 0.9
  button-primary:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "24px"
    fontWeight: 700
    letterSpacing: "0.08em"
  button:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "19px"
    fontWeight: 700
    letterSpacing: "0.08em"
  field-label:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 700
    letterSpacing: "0.16em"
  pitch:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.45
  tape:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontStretch: "condensed"
    fontSize: "15px"
    fontWeight: 700
    letterSpacing: "0.14em"
    textTransform: "uppercase"
  body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  hud:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.35
  hud-hint:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "12px"
  readout:
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
    fontSize: "13px"
    fontWeight: 600
    fontVariantNumeric: "tabular-nums"
  code-input:
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
    fontSize: "22px"
    fontWeight: 600
    letterSpacing: "0.4em"
rounded:
  none: "0px"
  hairline: "2px"
spacing:
  hud-top: "44px"
  hud-bottom: "64px"
  gutter: "16px"
  touch: "44px"
---

# Design System: Overlap

## Overview

**Creative North Star: "The Breaker Room"**

The Guide works in the city's utility room and the Runner walks the street outside it. Every screen is that room with the power off: unlit wall-blue surfaces, black embossed label tape stuck on the panel, and a row of breakers. Nothing has color until something emits light. When a light is on, its color is the only paint on the screen; when power is drawn, the console reads warm amber.

The title screen dramatizes the one mechanic: the wordmark is a sign on a dark wall. Two streetlights (blue, green) hang over it and the visitor's lantern (red) follows the pointer. The letters are readable only where light falls, and where the lantern overlaps a streetlight the letters turn magenta or yellow. The visitor learns additive light before they read a word of the rules.

The in-game HUD gets out of the way. The Runner's bar is a dim strip of label tape and a status readout, because the darkness is the game. The Guide's bar is the console: a breaker row for the power budget, a ping charge meter, and a clock.

This system replaces an earlier look of chromatic-aberration logo, glass card, tri-color gradient button, and glow halos everywhere. That look is the generic "near-black with neon glow" cluster and appears nowhere now.

**Key Characteristics:**
- Unlit by default. Surfaces are night, wall, and street; edges are 1px wall-edge hairlines.
- Light colors (red, green, blue and their mixes) appear only as light or as the color of something light-gated. Never as decoration.
- Powered amber (`#ffd38a`) means "drawing power" or "console readout": breakers in use, the clock, the lobby's waiting state.
- Black embossed label tape for names and tags: district names, role tags, the room label.
- Every color carries its glyph: red triangle, green circle, blue square, mixes overlay the shapes.
- Square corners. The room is sheet metal and tape, not plastic.

## Colors

The palette is fixed by the game's art. The UI adds three ink steps derived from `ink` for secondary text.

### Primary
- **Night** (`#0b1020`): page and HUD ground. The dark the Runner walks in.
- **Ink** (`#e8ecff`): primary text and the embossed letters on label tape.

### Light (state, never decoration)
- **Light Red** (`#ff4d5e`), **Light Green** (`#4dff88`), **Light Blue** (`#4d8bff`): the three light sources. Red is also the Runner's lantern and the primary title action, because pressing it hands you the lantern.
- **Magenta** (`#ff4dff`), **Yellow** (`#ffe14d`), **Cyan** (`#4dffff`): additive mixes, used only in the legend and wherever two lights overlap.
- **Powered** (`#ffd38a`): power drawn, console readouts, waiting state.

### Neutral
- **Wall** (`#1b2238`): label tape, unlit breakers, input wells.
- **Wall Edge** (`#2c3758`): every hairline, the unlit wordmark, the split-screen seam.
- **Street** (`#141a2e`): button and panel fill.
- **Ink Dim** (`#a9b1d6`, 9.0:1 on night) and **Ink Faint** (`#7d87b2`, 5.4:1 on night): secondary and tertiary text. Never go dimmer than Ink Faint for readable text.

### Named Rules
- **Lit Means Live.** A color appears only when something emits light or holds a state. Hover and focus "switch on" a control (its edge lights); idle controls stay unlit.
- **Light Is The Only Paint.** No gradients as decoration, no gradient text, no colored glow on idle chrome. A light gets a soft pool only where it is a light source.
- **Never Color Alone.** Every light color is paired with its glyph and its name.

## Typography

- **Display** (DIN Condensed, Bahnschrift condensed on Windows, Roboto Condensed on Android): the wordmark, the room code, credit headlines. DIN is the lettering of utility signage and panel engraving. Tight, uppercase, very large.
- **Tape** (same stack, 13 to 16px, uppercase, wide tracking): label-tape strips. Always on a Wall-colored strip with a 1px top highlight and a soft bottom shadow, like embossed tape.
- **Body** (system UI stack): instructions, pitch, toasts. 15px on the title, 13px in the HUD.
- **Readout** (system monospace, tabular numerals): the clock, the budget count, the room code under the QR, the join link. Monospace is used only for data.

### Named Rules
- **No Eyebrows.** No small caps labels above headings. Tape labels name a thing on a panel; they never introduce a section.
- **No Em Dashes.** Copy uses periods, commas, and colons.

## Layout

- Title (desktop): the wordmark spans the width at the top, left aligned. Below it a two-column panel: actions on the left (Play as Runner, Join as Guide, the local link), the light legend on the right. Columns collapse to one below 760px; actions come first.
- Lobby: the room code and status on the left, the QR on a lit plate on the right. On phones the QR follows the code.
- HUD: top bar exactly 44px, Guide bottom bar exactly 64px (the scenes reserve that space in `src/scenes/fit.ts`). The HUD uses container queries on its own pane, so `?local=1` panes and phones collapse the same way.
- Gutter 16px on phones, safe-area insets on `#app`. No horizontal scroll at 360px.

## Elevation & Depth

Flat. The room has two depths: the wall, and things stuck on it (tape, the QR plate). Tape carries a 1px inner top highlight and a `0 1px 2px` night shadow. Lit things get a light pool only when they are light sources (the wordmark beams, lit breakers).

## Shapes

Square. Corners are 0px, label tape is 2px. Touch targets are at least 44px.

## Components

### Label tape
Black-tape strip: Wall fill, Ink embossed letters in the Tape face, inset top highlight. Used for district names, role tags (RUNNER, GUIDE), the room label, and credit lines.

### Buttons
Street fill, 1px Wall Edge border, square, 52px tall on the title and 44px in the HUD. Hover and focus light the edge: Powered for neutral actions, Light Red for the Runner action. Press scales to 0.97 in 120ms. The primary "Play as Runner" button is the lantern: a red edge and a red triangle glyph, lit fill on hover.

### Code input
A wall-colored well, readout face, wide tracking, 4 characters. Label above ("Join as Guide"), error text below in Light Red with a plain recovery instruction.

### Breaker row (the Guide's power budget)
One breaker per unit of budget. In use: Powered fill with the handle thrown up. Spare: Wall fill, handle down, Wall Edge outline. A denied switch flashes the row Light Red twice. A tabular "1/2" readout follows the row.

### Ping meter
A 56px bar that empties when the Guide pings and refills over the cooldown, labeled "PING". Ready reads Ink; charging reads Ink Faint.

### Status readout
A dot and a word. The dot is the only status dot in the system and it carries real state: Light Green connected, Powered waiting, Light Red lost.

### Toasts
Night at 92% with a hairline edge, body face, wraps on narrow panes. Runner toasts sit 22px from the bottom; Guide toasts sit above the console bar.

### Credits
A directory card in the 120px band the ending reserves: "The city is back on." in Powered display type, then tape lines for "Made at WolfJam 2026" and "Richard Sun", and a "Play again" button.

### Motion
One authored moment per surface. Title: the lantern beam follows the pointer with an eased lag (and drifts on its own until the visitor moves). Lobby: the waiting dot breathes. Credits: lines rise in with a 90ms stagger. HUD: breaker throws are 160ms, toasts 200ms. `prefers-reduced-motion` removes movement and keeps opacity changes; the title shows the beams parked in their overlap.

## Do's and Don'ts

### Do:
- Keep idle UI unlit. Let light and state be the only color.
- Pair every light color with its glyph and name.
- Use the Tape face for names on the panel and the Readout face only for numbers and codes.
- Keep the HUD bars at exactly 44px and 64px.

### Don't:
- Don't add glow halos, gradient text, glass panels, or tri-color gradients.
- Don't use the light colors for decoration or for role branding beyond the Runner's red lantern.
- Don't put eyebrows above headings or use em dashes in copy.
- Don't round corners.
