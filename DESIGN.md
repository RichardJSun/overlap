---
name: Overlap
description: A two-player blackout co-op game. Every screen is a sheet of the city's one-line wiring drawing.
colors:
  night: "#0b1020"
  edge: "#2c3758"
  amber: "#ffd38a"
  light-red: "#ff4d5e"
  light-green: "#4dff88"
  light-blue: "#4d8bff"
  mix-magenta: "#ff4dff"
  mix-yellow: "#ffe14d"
  mix-cyan: "#4dffff"
  ink: "#e8ecff"
  ink-dim: "#a9b1d6"
  ink-faint: "#7d87b2"
  hairline: "rgba(232, 236, 255, .45)"
  grid-line: "rgba(44, 55, 88, .3)"
typography:
  display:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "clamp(84px, 24vw, min(300px, 31vh))"
    fontWeight: 700
    lineHeight: 0.8
    letterSpacing: "0.01em"
  room-code:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "clamp(96px, 22vw, 200px)"
    fontWeight: 700
    lineHeight: 0.8
    letterSpacing: "0.12em"
  headline:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.14em"
  title:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  section-heading:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.2em"
  note-label:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.12em"
  button:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "19px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  button-primary:
    fontFamily: '"DIN Condensed", "Bahnschrift", "Roboto Condensed", "Arial Narrow", sans-serif-condensed, system-ui, sans-serif'
    fontSize: "30px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.08em"
  body:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body-hud:
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: 'system-ui, sans-serif'
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.16em"
  value-mono:
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: '"tnum"'
  code-input:
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.55em"
rounded:
  none: "0px"
spacing:
  grid: "32px"
  xs: "8px"
  sm: "12px"
  md: "18px"
  cell: "12px 14px"
  touch-min: "44px"
  button-min: "48px"
components:
  button-primary:
    backgroundColor: "rgba(255, 77, 94, .08)"
    textColor: "{colors.ink}"
    typography: "{typography.button-primary}"
    rounded: "{rounded.none}"
    padding: "4px 18px 0"
    height: "64px"
  button-primary-hover:
    backgroundColor: "rgba(255, 77, 94, .18)"
  button:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.none}"
    padding: "2px 20px 0"
    height: "48px"
  button-signal-sent:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.night}"
  title-block:
    backgroundColor: "{colors.night}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  title-block-cell:
    padding: "{spacing.cell}"
  title-block-label:
    textColor: "{colors.ink-faint}"
    typography: "{typography.label}"
  title-block-value:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
  input-code:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.code-input}"
    rounded: "{rounded.none}"
    padding: "0 4px"
    height: "48px"
  note-label:
    textColor: "{colors.amber}"
    typography: "{typography.note-label}"
  step-current-marker:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.night}"
    typography: "{typography.value-mono}"
    width: "28px"
---

# Design System: Overlap

## Overview

**Creative North Star: "The One-Line Schematic Sheet"**

Every DOM surface of Overlap is a sheet from the city's electrical drawing set, laid over a night ground. The title is a drawing sheet with a heavy border, an inner hairline, and zone letters in the gap between them. Instructions are numbered general notes. Status lives in a title block of bordered cells. Tutorial notes reach the tile they mean with a leader line ending in an arrowhead and a ring. Transient messages sit under a dimension line. A milestone is a revision entered on the sheet. The Main Breaker is an actual one-line diagram with a switch blade, a gauge, and a lamp.

The sheet is dark, quiet, and line-drawn. Ink line work in two weights does all the structural work; there is no fill, no card, no chip, no rounded corner. Amber is the draftsman's highlight pen: note numbers, leaders, note-label underlines, focus rings, the current step. The light colors (red, green, blue and their additive mixes) belong to light itself and appear only as lamp symbols, colorblind glyphs, the lit wordmark, and state. The density is that of a drawing: lots of small technical lettering, generous air between groups, every value in mono.

Typography runs in three voices. DIN condensed caps are the technical lettering for headings, labels on the drawing, buttons, and title-block values. System sans carries note text, the plain municipal sentences. Mono carries values, codes, readings, and numbering. The build refuses the dark-dashboard default of chips and bordered cards.

**Key Characteristics:**
- Night ground with a faint 32px drafting grid on non-game surfaces.
- Two line weights: a 1.5px ink rule for borders and a 1px hairline for divisions.
- Hard corners everywhere; the only circles are lamp symbols, status dots, and leader rings.
- Amber marks what the drafter wants you to read next; light colors mean light.
- DIN condensed caps for lettering, system sans for sentences, mono for values.

## Colors

A night-drawing palette: one dark ground, one ink in three strengths, one amber highlight, and the light colors held back for light.

### Primary
- **Drafting Amber** (amber): The highlight pen. General-note numbers, leader lines and arrowheads, note-label underlines, focus outlines (2px), text caret, selection background, the current step marker, a sent signal, budget bars that are on, the credits headline and wordmark cell. Also the "connecting" status dot.

### Secondary
- **Lantern Red** (light-red): The Runner's light. Edges the primary action cell (Play as Runner, Pull the lever) at 1.5px with an 8% wash that rises to 18% on hover. Also error text, an invalid field underline, a failed test row (6% wash), the overload arc on the gauge, and budget denial flashes.
- **Signal Green** (light-green): Done and connected. Ticks on finished steps and passed tests, the closed breaker state, the connected status dot, a met goal label, the line-clear lamp.
- **Streetlight Blue** (light-blue): A lamp color only. Appears as a lamp symbol on the bus diagram and as a lit copy of the wordmark.

### Tertiary
- **Mixed Magenta, Mixed Yellow, Mixed Cyan** (mix-magenta, mix-yellow, mix-cyan): Additive mixes. Appear where two lights overlap on the wordmark and in the general-note swatches with their combined glyphs. Never used as UI accents.

### Neutral
- **Night** (night): The ground of every sheet, title-block fill, and the backing of the lift shadow and gradients behind the HUD top bar.
- **Wiring Edge** (edge): The unlit wordmark, the 32px grid lines (at 30% as grid-line), unlit gauge arc, idle step-number box, ping meter dashes, scrollbar thumb.
- **Ink** (ink): Primary text and the heavy 1.5px border of the sheet, title blocks, keypad, tests table, input underlines, and line work in SVG diagrams.
- **Dim Ink** (ink-dim): Note body text, diagram captions on SVGs, hint text, readings, idle signal states.
- **Faint Ink** (ink-faint): Title-block labels, zone letters, help text, placeholders, future steps, the HUD role tag.
- **Hairline** (hairline): Cell divisions inside title blocks (as inset box-shadow or 1px border), default button border, table row rules.

### Named Rules
**The Highlight Pen Rule.** Amber marks only what the drafter points at: numbers, leaders, the active step, focus. It is never a fill for a panel or a large surface.

**The Light Is Light Rule.** Red, green, blue, and the mixes appear only as lamps, glyphs, lit lettering, and state (red for the primary action and for failure, green for done). They are not decoration.

## Typography

**Display Font:** DIN Condensed (with Bahnschrift, Roboto Condensed, Arial Narrow, system condensed sans)
**Body Font:** system-ui (with -apple-system, Segoe UI, Roboto)
**Label/Mono Font:** ui-monospace (with SF Mono, Menlo, Consolas) for values; system-ui 600 caps for title-block field labels

**Character:** Condensed technical lettering against plain system sentences, with mono for anything that is a reading. All three are system stacks; nothing is downloaded.

### Hierarchy
- **Display** (700, clamp(84px, 24vw, min(300px, 31vh)), 0.8, condensed): The OVERLAP wordmark only. Shrinks to clamp(64px, 14vw, min(160px, 17vh)) in the lobby.
- **Room code** (700, clamp(96px, 22vw, 200px), 0.8, 0.12em): The lobby room code, selectable as a whole.
- **Headline** (700, 30px, 0.14em, uppercase, amber): The revision card title. The cold-open stamp goes larger (clamp(44px, 8vw, 96px), 0.12em, amber).
- **Title** (700, 17px, 0.08em, uppercase, condensed): Title-block values, the district name in the top bar, the solo link.
- **Section heading** (700, 15px, 0.2em, uppercase): "General notes" and similar sheet headings.
- **Note label** (700, 14px, 0.12em, uppercase, amber, 1px amber underline): NOTE, NOTE 2, RADIO, and the cold-open stamp in its small form.
- **Body** (400, 15px, 1.5): General notes in dim ink, max 62ch, text-wrap pretty. The lead note goes to 17px in ink. HUD note text runs at 13.5px/1.45; the breaker panel at 14px/1.45.
- **Label** (600, 11px, 0.16em, uppercase, faint ink): Title-block field labels (Goal, Lights, Ping, Time, Room code, Players).
- **Value mono** (600, 12 to 13px, tabular numerals): Sheet numbers, budget counts, the clock, test values, step numbers, note markers.

### Named Rules
**The Three Voices Rule.** DIN caps letter the drawing, sans says the sentence, mono gives the reading. A value is never set in sans and a sentence is never set in caps.

**The Field Label Rule.** Every title-block cell is a small faint label over a value. The label is 11px system-ui 600 caps at 0.16em, identical on every screen.

## Layout

The title and lobby sit inside one drawing sheet: max width 1240px, margin clamp(10px, 2vw, 22px), a heavy outer border and an inner hairline outline inset 9px. Zone letters A to D sit on the top border and 1 to 2 on the left, hidden under 600px. The head row puts the wordmark top-left and the bus diagram top-right (hidden under 760px). The body is a 7:5 grid: general notes left, title block right, aligned to the bottom. Under 760px it stacks to one column and the title block moves above the notes.

In play, the HUD reserves a 44px top bar and, on the Guide, a 44px console title block across the bottom. Under 560px container width the console wraps to two rows with the goal on its own line. Notes hang centered 54px from the top, max 500px wide. Toasts sit centered near the bottom above the console. The Main Breaker centers a panel of max 560px, widening to 1080px with two columns at 900px container width.

Spacing rhythm: gaps of 8, 10, 12, 14, and 18px inside groups; clamp(24px, 4vh, 44px) between sheet regions; cells pad 12px 14px. Non-game surfaces carry the 32px drafting grid. Interactive targets are at least 44px tall; buttons 48px, breaker controls 52px, the primary action 64px. Nothing scrolls horizontally at 360px.

## Elevation & Depth

Flat. Depth is never conveyed by shadow; a sheet is paper on a table. The structure comes from line weight: 1.5px ink outer borders, 1px hairline divisions (often drawn as an inset box-shadow, which is a rule, not elevation). Three effects exist for legibility only.

### Shadow Vocabulary
- **Lift** (`text-shadow: 0 0 2px #0b1020, 0 1px 10px #0b1020, 0 0 18px rgba(11,16,32,.9)`): Night halo behind HUD notes and toasts so text reads over the lit game canvas.
- **Plate ring** (`box-shadow: 0 0 0 1.5px #e8ecff, 0 0 0 10px #0b1020, 0 0 0 11px rgba(232,236,255,.45)`): Mounts the lobby QR code as a plate with a border and hairline, matching the sheet border.
- **Revision backing** (`radial-gradient(closest-side, rgba(11,16,32,.94) 55%, rgba(11,16,32,0))`): A night pool behind the milestone card.

### Named Rules
**The Two Weights Rule.** Structure is drawn with exactly two line weights: 1.5px ink for borders and frames, 1px hairline for internal divisions. No drop shadows.

## Shapes

Square corners everywhere (0px). Lines are straight and orthogonal, as on a schematic: borders, underlines, dimension ticks, and leader shoulders. Circles appear only where the drawing vocabulary demands them: the lamp symbol (circle with an X), status dots, the leader ring around a target tile, and the gauge arc. A breaker is a small square, a bus is a horizontal line with vertical drops. Colorblind glyphs are outlined: triangle for red, circle for green, square for blue, overlaid for mixes, stroked at 1.5px.

## Components

### Buttons
Outlined drafting cells, not pills.
- **Shape:** Square (0px), 1px hairline border.
- **Primary:** Play as Runner and Pull the lever. 1.5px lantern-red edge with an 8% red wash, DIN 30px caps on the title, left-aligned with the red triangle glyph, 64px tall.
- **Default:** Transparent with a hairline border, DIN 19px caps, 48px tall, padding 2px 20px 0 (the top pad optically centers DIN caps).
- **Hover / Focus:** Hover turns the border amber (red buttons deepen to an 18% wash). Focus is a 2px amber outline at 3px offset (inset on in-block buttons). Active scales to 0.97 over 120ms.
- **In-block buttons:** Inside a title block (signals, breaker controls, credits Play again) buttons drop their border and are divided by hairlines; hover adds a 14% amber wash; a sent signal or a pressed key fills amber with night text.

### Title Block
The signature container: status and actions live in a drawing title block.
- **Corner Style:** Square.
- **Background:** Night (92% opaque over the game).
- **Border:** 1.5px ink outer frame, 1px hairline between cells.
- **Internal Padding:** 12px 14px per cell; each cell is a faint field label over a DIN or mono value.

### Inputs / Fields
- **Style:** Written on the line. No box: a 1.5px ink underline, transparent ground, square corners. The room code is mono 24px at 0.55em spacing, four characters. The breaker rule field is mono 17px.
- **Focus:** Amber caret always; the rule field turns its underline amber, the code field takes the 2px amber outline.
- **Error:** Red underline and a red 13px message below.

### Navigation
The HUD top bar is the sheet's header strip, 44px: role tag (DIN 12px faint caps), sheet number in amber mono with the district name in DIN, room code in mono, a connection dot (amber waiting, green connected, red lost), and a 44px drawn speaker toggle.

### Note with Leader
A drawing note: a DIN amber label underlined in amber, then a sans sentence, no box, lifted by the night halo. The tutorial note draws an amber leader (1.4px) from a short shoulder under the note to an arrowhead and a 13px ring around the tile it means.

### Dimension-line Toast
Centered text under a 1px ink line at 70% with short vertical ticks at both ends, like a dimension callout.

### Lamp Symbol and Bus
Circle with an X in the lamp's light color, hung from an amber breaker square on a horizontal ink bus, with DIN dim captions. Used on the title bus diagram and the breaker one-line.

### Steps
Numbered list: mono numbers in 28px hairline boxes. The current step fills amber with night text and brightens to ink; done steps show a green drawn tick; later steps wait in faint ink.

## Do's and Don'ts

### Do:
- **Do** draw every container as a title block or a sheet: 1.5px ink frame, 1px hairline divisions, square corners, night fill.
- **Do** label every status value with an 11px faint system-ui caps field label at 0.16em.
- **Do** point at the thing an instruction means with an amber leader line ending in an arrowhead and a ring.
- **Do** set values, codes, readings, and numbering in mono with tabular numerals.
- **Do** keep the 32px drafting grid on non-game sheets and keep it faint (edge at 30%).
- **Do** pair every light color with its outlined glyph (triangle, circle, square).
- **Do** keep touch targets at least 44px tall and gate flicker, breathing dots, and lantern drift behind reduced motion.

### Don't:
- **Don't** use chips, pills, rounded cards, or filled panels; the build refuses the dark-dashboard default.
- **Don't** use a light color as decoration or a panel accent; red, green, and blue mean light, action, failure, and done.
- **Don't** fill large areas with amber; it is a highlight pen.
- **Don't** add drop shadows for depth; the only shadows are the legibility halo and the QR plate ring.
- **Don't** load web fonts or external assets; every face is a system stack and every icon is drawn in SVG or a CSS mask.
