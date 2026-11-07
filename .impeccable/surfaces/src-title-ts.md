---
version: 1
slug: "src-title-ts"
primary_target: "src/title.ts"
related_targets: ["src/hud.ts","src/scenes/Breaker.ts","src/credits.ts"]
---

Scope: every DOM surface of Overlap (title, lobby, in-game HUD, coach and call notes, toasts, Guide console, Main Breaker panels, credits). Visitor mode: Persuade on the title and lobby, Operate in the HUD.

## Direction contract

THESIS: Every screen is a sheet of the city's wiring drawing. Instructions are numbered notes with leader lines to the thing they mean, status lives in a title block, history is a revision table. It refuses the dark-dashboard default of chips and bordered cards.

OWN-WORLD: Night ground with a faint 32px drafting grid on non-game surfaces, drawing border with zone letters, ink line work at two weights, technical lettering (DIN condensed caps) for labels, system sans for note text, mono for values. Amber is the drafting highlight for note numbers and leaders; light colors appear only as lamp symbols and light. Electrical symbols: lamp circle-with-X, breaker square, bus line.

STORY: The visitor sees the city as a drawing of its grid, learns that light adds up from the general notes, opens or joins a job from the title block, and in play reads notes that point at the tile to act on.

FIRST VIEWPORT: The lit OVERLAP wordmark top-left inside the sheet border. A one-line bus diagram top-right with lamp symbols. General notes lower-left. The title block lower-right holds Play as Runner (primary, red-edged cell), Join as Guide with the job-number field, and the solo bench test.

FORM: One-line schematic sheet, candidate 1 of 7 on the ordered list (taken as impeccable's pick over the rolled candidate 6, carbon-copy work order, because the user rejected bright paper on the dark game). Seed key d3cc2281.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
