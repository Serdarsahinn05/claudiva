---
name: claude-manager
description: Çok ajanlı Claude paneli — proje durumunu bir gösterge tablosu değil, bir gök plakası olarak okutur.
colors:
  night-ink: "rgb(10 16 33)"
  plate-body: "rgb(19 28 51)"
  plate-raised: "rgb(27 39 67)"
  plate-active: "rgb(36 49 79)"
  void: "rgb(7 11 22)"
  edge: "rgb(36 55 79)"
  edge-lit: "rgb(61 85 115)"
  stardust: "rgb(242 242 233)"
  muted: "rgb(151 163 184)"
  dim: "rgb(118 131 152)"
  vermilion: "rgb(255 77 46)"
  vermilion-deep: "rgb(214 62 34)"
  nominal: "rgb(95 199 155)"
  caution: "rgb(255 193 94)"
  alarm: "rgb(255 107 138)"
  aux: "rgb(159 198 255)"
  inert: "rgb(74 86 112)"
typography:
  display:
    fontFamily: "'Bodoni Moda', Georgia, 'Times New Roman', serif"
    fontSize: "clamp(28px, 3.4vw, 46px)"
    fontWeight: 400
    lineHeight: 1.12
    letterSpacing: "0"
  headline:
    fontFamily: "'Bodoni Moda', Georgia, 'Times New Roman', serif"
    fontSize: "26px"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0"
  title:
    fontFamily: "'Bodoni Moda', Georgia, 'Times New Roman', serif"
    fontSize: "19px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0"
  hero:
    fontFamily: "'JetBrains Mono', Consolas, 'Cascadia Mono', monospace"
    fontSize: "40px"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  hero-sm:
    fontFamily: "'JetBrains Mono', Consolas, 'Cascadia Mono', monospace"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.01em"
    fontFeature: "tabular-nums"
  headline-sm:
    fontFamily: "'Bodoni Moda', Georgia, 'Times New Roman', serif"
    fontSize: "24px"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0"
  figure:
    fontFamily: "'JetBrains Mono', Consolas, 'Cascadia Mono', monospace"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.2
    letterSpacing: "0"
    fontFeature: "tabular-nums"
  title-sm:
    fontFamily: "'Bodoni Moda', Georgia, 'Times New Roman', serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "0"
  base:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  subtitle:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0"
  body:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0.01em"
  body-sm:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "0.01em"
  row:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
  row-sm:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
  label:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.14em"
  label-sm:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "9.5px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.14em"
  micro:
    fontFamily: "Archivo, system-ui, -apple-system, sans-serif"
    fontSize: "9px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.14em"
  readout:
    fontFamily: "'JetBrains Mono', Consolas, 'Cascadia Mono', monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0"
    fontFeature: "tabular-nums"
  readout-sm:
    fontFamily: "'JetBrains Mono', Consolas, 'Cascadia Mono', monospace"
    fontSize: "10.5px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
    fontFeature: "tabular-nums"
rounded:
  key: "1px"
  plate: "2px"
  screen: "3px"
  milled: "4px"
  milled-lg: "6px"
  badge: "8px"
  badge-lg: "10px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
components:
  button:
    backgroundColor: "transparent"
    textColor: "{colors.stardust}"
    typography: "{typography.body}"
    rounded: "{rounded.plate}"
    padding: "6px 12px"
  button-hover:
    backgroundColor: "rgb(255 77 46 / 0.07)"
    textColor: "{colors.stardust}"
  button-primary:
    backgroundColor: "{colors.vermilion}"
    textColor: "{colors.night-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "7px 16px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.alarm}"
    typography: "{typography.body}"
    rounded: "{rounded.plate}"
    padding: "6px 12px"
  icon-button:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.plate}"
    height: "30px"
    width: "30px"
  input:
    backgroundColor: "{colors.void}"
    textColor: "{colors.stardust}"
    rounded: "{rounded.plate}"
    padding: "7px 9px"
    width: "100%"
  badge:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "3px 6px"
  chip-running:
    backgroundColor: "rgb(159 198 255 / 0.12)"
    textColor: "{colors.aux}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "3px 7px"
  catalog-row:
    backgroundColor: "transparent"
    textColor: "{colors.stardust}"
    padding: "12px 8px"
  rail-item:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    padding: "7px 12px 7px 0"
    width: "168px"
  modal:
    backgroundColor: "{colors.plate-body}"
    textColor: "{colors.stardust}"
    rounded: "{rounded.plate}"
    padding: "24px"
    width: "620px"
---

# Design System: claude-manager

## Overview

**Creative North Star: "Gök Plakası" — the engraved sky plate**

Project state is not a dashboard; it is an astronomical plate. Agents are stars,
their token weight is magnitude (dot diameter), their status is colour *and* form,
and a delegation is a real constellation line drawn between two of them. Everything
the plate draws comes from live data — the mapping is documented in
`src/components/Sky.tsx` and there is no decorative geometry anywhere in it. The
system deliberately refuses the category default it grew out of: card grid, status
pills, sparkline row.

The surface is print, not glass. Ground is night ink carrying a real grain tile and
a 128px graticule; plates are flat ink fields with hairline frames and a 2px corner;
type is engraved Bodoni italic for names and the status sentence, Archivo for the
interface, JetBrains Mono for every number. There is exactly one accent — vermilion —
and it behaves like annotation ink written *on* the plate rather than a brand fill.
Density is high (this is a tool for someone running eight agents at once) but the
first viewport spends its space on a single sentence, because the product's first
job is to report state, not to report data.

Two editions exist, and each answers a real observing condition rather than a
colour preference: **Gece** (night ink, a panel left open for hours) and
**Gündüz** (printed plate on paper for a lit room; print does not glow, so the halo
token goes to 0). A third, **Kırmızı Fener** (red lamp), was removed on 2026-11-25. Interface language is Turkish throughout.

**Key Characteristics:**
- Data-true diagram: magnitude = tokens, colour + form = status, line = delegation
- One accent (vermilion), used as annotation, never as a large fill
- Hairline separation (1px) and space instead of cards and shadows
- Print materials: grain tile, graticule, engraved italic; no glass, no gradients-as-decor
- Contrast is measured by a script, not judged by eye
- One authored entrance animation for the whole app

## Colors

A night-ink plate with a single vermilion annotation ink; every other hue is a status
signal that has to earn its appearance.

### Primary
- **Vermilion** (`{colors.vermilion}`): the annotation ink. Small-caps labels, section
  rules, the active index bullet, focus outline, the primary stamp, selected-state
  washes at 7%/14% opacity. It is the only chromatic voice in the chrome.
- **Vermilion Deep** (`{colors.vermilion-deep}`): the calm tone of the same ink —
  terminal accents and secondary marks where full vermilion would shout.

### Secondary
- **Aux Blue-White** (`{colors.aux}`): a hot star. Marks *role* and *thinking/working* —
  the working star, the role badge, running chips, diff hunk headers.

### Tertiary (status signals)
- **Nominal** (`{colors.nominal}`): healthy / done. Added diff lines, done chips.
- **Caution** (`{colors.caution}`): amber, waiting for approval. Always paired with a
  ring (variable-star notation), never colour alone.
- **Alarm** (`{colors.alarm}`): error, destructive action, failed step.

### Neutral
- **Night Ink** (`{colors.night-ink}`): outermost ground, header wash, and the
  knockout colour on the vermilion stamp.
- **Plate Body / Raised / Active** (`{colors.plate-body}`, `{colors.plate-raised}`,
  `{colors.plate-active}`): the three-step surface ladder — plate, popovers/modals,
  hover fills (used at 0.5–0.6 alpha so the grain still reads through).
- **Void** (`{colors.void}`): the space *under* the plate — terminals, diffs, inputs,
  code blocks. Anything that is a screen rather than a page sits on void.
- **Edge / Edge Lit** (`{colors.edge}`, `{colors.edge-lit}`): the hairline ruler and
  its emphasised variant (button borders, scrollbar thumb, registration marks).
- **Stardust** (`{colors.stardust}`), **Muted**, **Dim**: the text ladder — body,
  secondary, and coordinate-level metadata.
- **Inert** (`{colors.inert}`): the unplotted object — offline agents, empty index bullets.

### Named Rules

**The Channel Rule.** Every colour is stored as an `R G B` channel triple
(`--accent-rgb: 255 77 46`) and consumed as `rgb(var(--accent-rgb) / a)`. Raw colour
literals are forbidden in component CSS; the only exception is pure-black shadow.
A theme that cannot be expressed as channel overrides is not a theme.

**The Twice-Derived Rule.** Named colours (`--fg`, `--hud`, `--nominal`…) are declared
in a *separate* block whose selector is `:root, [data-theme]` — never `:root` alone.
Custom properties inherit as computed values, so a `:root`-only derivation resolves
once at the root and cannot be re-derived by a nested container. The theme picker's
miniature preview is exactly such a container (a `<span>` carrying its own
`data-theme`); before the split, all three previews rendered identically.

**The Measured Contrast Rule.** Contrast is never judged by eye. `node scripts/contrast.mjs`
measures every role against both the plate surface and the outer ground and exits 1 on
any failure: `fg ≥ 7`, `muted ≥ 4.5`, `dim / accent / ok / warn / err / aux ≥ 3`. All
three editions currently pass. A new plate is not done until the script is green.

**The Annotation Rule.** Vermilion annotates, it does not upholster. It appears as
1px rules, 5px bullets, 10px labels, a focus ring, and one filled stamp per view.
Wide vermilion fills belong to no surface in this system.

## Typography

**Display Font:** Bodoni Moda, italic (with Georgia, Times New Roman)
**Body Font:** Archivo (with system-ui, -apple-system)
**Label/Mono Font:** JetBrains Mono (with Consolas, Cascadia Mono)

All three are self-hosted from `@fontsource` and imported at the top of `index.css`,
so the panel renders identically offline — the same reason the grain is an embedded
SVG. Only the weights actually used are imported (Bodoni 400/500 italic + 400,
Archivo 400/500/600, Mono 400/700); the browser pulls only the needed unicode subset,
which matters because Turkish lives in `latin-ext`.

**Character:** an engraved plate legend against a technician's interface. The Bodoni
italic is the plate's *hand* — it names things (the status sentence, agent names,
section titles) and never carries data. Archivo does the working text and the
small-caps annotation. Mono carries anything that is a coordinate: tokens, cost,
percentages, paths, timestamps, transcript.

### Hierarchy
- **Display** (Bodoni italic 400, `clamp(28px, 3.4vw, 46px)`, 1.12): the status
  sentence on the first viewport — the largest type in the product, capped at 46ch,
  `text-wrap: balance`. The number inside it is wrapped in `<em>` and set in vermilion.
- **Headline** (Bodoni italic 400, 26px, 1.1): app title, plate titles, empty-state
  headings, boot-curtain wordmark (same face and size, so the word does not move when
  the curtain lifts).
- **Title** (Bodoni italic 400, 18–24px): catalogue agent name (19px), modal heading
  (24px), prompt card title (18px), memory panel title (24px).
- **Body** (Archivo 400, 12–13px, 1.6–1.8): rows, descriptions, help text. Prose is
  capped at 44–72ch depending on surface.
- **Label** (Archivo 500, 9–10px, `0.14em`, uppercase, vermilion): section heads,
  field labels, column heads, badges, chips. This is the annotation voice.
- **Readout** (JetBrains Mono 400, 9–13px, `tabular-nums`): every number and path.

**The ramp steps by 0.5px between 9 and 13, and that is deliberate.** This is a dense
instrument panel: nine rows of a transcript, a token column and a status chip can share
one 300px column, and a whole-pixel ramp is too coarse to separate them without changing
weight or colour — channels already spent on meaning here. Measured usage across
`index.css` and `themes.css`: 12px (41 declarations), 10px (34), 11px (29), 11.5px (19),
9px (18), 13px (16), 12.5px (15), 9.5px (14), 10.5px (14). The band from 9 to 13 carries
219 of ~232 declarations; the ramp is real, not drift.

The frontmatter above now enumerates every step. It previously listed one value per role
while this prose already stated the ranges — so the two halves of this document
disagreed, and the detector (which reads only the frontmatter) flagged the panel's own
established sizes. Sizes still absent from the frontmatter are absent **on purpose**:
8.5px, 13.5px, 14px, 18px, 22px, 28px, 30px and 40px appear once or twice each and are
one-offs to be folded into the ramp, not steps to be blessed.

### Named Rules

**The Engraved Name Rule.** Bodoni italic is reserved for *names and one sentence*:
titles, agent names, the status line. A number, a path, or a status word never gets
the display face.

**The Coordinate Rule.** Anything measured is mono with `font-variant-numeric:
tabular-nums`, right-aligned in tabular columns. `body` explicitly disables `tnum`
(`font-feature-settings: 'tnum' 0`) so proportional text stays proportional — the
tabular figure is a deliberate signal, not a global default.

## Layout

A three-column shell inside a full-height flex column: `header` / `.layout` /
content. `.layout` is the plate index (`.rail`, 168px, drops to 132px under 860px),
the star roster (`aside`, 260px → 210px), and `main` (scrolling, 24/32px padding).
The right-hand pane changes by section; the roster and index do not move.

Rhythm is a 4/8/12/16/24/32 scale (`--s1`…`--s6`); it is used for every gap and pad,
and arbitrary spacing values do not appear. Sub-token values (7px, 5px, 3px) exist
only inside control internals where the scale would be too coarse.

The first viewport (`Survey`) is a two-column grid: sky at `minmax(0,1fr)` and a
320px ephemeris column of readouts, collapsing to one column at 1180px. Below it a
`repeat(auto-fit, minmax(210px, 1fr))` foot strip carries project / system / runtime
readouts on a single hairline.

Observed breakpoints: **1180px** (survey splits), **1100px** (catalogue drops
role/model/status columns and hides its header row; compose grid collapses),
**1000px** (changes split collapses), **900px** (CLI welcome and memory map stack),
**860px** (shell tightens: rail, roster and main padding all shrink).

### Named Rules

**The Shared Ruler Rule.** A tabular surface declares its `grid-template-columns`
once and both the header row and every data row use it (`.cat-head, .cat-row`). If a
column is dropped at a breakpoint, it is dropped from the shared declaration — never
by patching one side.

**The Card-Grid Refusal.** Repeating entities are hairline rows on a shared ruler
with an expanding detail, not a grid of equally weighted boxes. The agent catalogue
was a nine-card grid; it became nine rows because nine identical cards say nothing
about which agent matters.

## Elevation & Depth

This is a print system, not a glass one. Depth comes from (1) the ground/plate/void
tonal ladder, (2) 1px hairlines, and (3) genuinely offset soft shadows. There is no
backdrop blur on plates (`--glass-blur: 0`), no ring shadows, no border-glow. The
single blur in the shell is 6px behind the header and 3px behind the modal scrim,
where the content genuinely floats over scrolling material.

Two materials do the atmospheric work instead of shadow. **Grain**: an embedded
`feTurbulence` 140px tile (`--grain`), composited `soft-light` on the dark plates and
`multiply` on paper — a flat colour reads as "empty screen", a grained one reads as
"printed". **Starfield**: three densities of dot gradients on `.app::before`, drifting
sidereally over 240s.

`--glow-a` is a real token, but this world spends it sparingly: the night plate uses
a soft halo on status stars only (6–9px), the red-lamp plate dims it to 0.85, and the
day plate sets it to **0** — print does not glow.

### Shadow Vocabulary
- **Card** (`0 1px 2px rgb(0 0 0 / 0.35)`): plates, prompt cards, diff panes. Barely
  there — it exists so a plate sits on paper rather than being cut out of it.
- **Pop** (`0 10px 30px rgb(0 0 0 / 0.55)`): slash-command menu, the office viewscreen.
- **Modal** (`0 24px 70px rgb(0 0 0 / 0.6)`): the only genuinely lifted surface.
- **Screen** (`none`): the terminal is *recessed*, not raised; it carries no shadow.

The day edition re-tints all three toward warm black (`rgb(40 36 28)`) at roughly half
the opacity, because ink on paper does not throw a neutral shadow.

### Named Rules

**The Recessed Screen Rule.** Anything that is a screen — terminal, diff body, input,
code block — sits on `void` with no shadow. Anything that is a page sits on a plate
with the card shadow. Nothing sits on both.

## Shapes

Corners are effectively square: `--radius: 2px`, `--radius-lg: 3px`, and the bevelled
polygon token (`--bevel`, `--clip-panel`) is deliberately switched off in every
shipped edition. Borders are always `--border-w: 1px` — the system has no 2px rules,
no coloured left-bars thicker than a hairline, no rounded pills. Status dots and
stars are the only circles.

Separation is by hairline plus space: lists use `border-bottom` at 0.45–0.6 alpha and
drop it on `:last-child`; sections use a top or bottom hairline plus a vermilion rule
that terminates in a 2.5px dot. Chains draw a 1px vermilion left rail.

### Named Rules

**The Hairline Rule.** One weight (1px), one radius (2px). If a boundary needs more
emphasis, brighten it (`--edge` → `--edge-lit` → `--hud`); never thicken it.

**The Terminated Rule.** A section rule is a 1px vermilion line ending in a small
filled dot, not a plain divider. It reads as a plate annotation and it is what marks
a heading as a heading (`.rule`, `.eph-mod-head::after`, `.panel h3::after`).

## Components

### Buttons
- **Shape:** square-ish (2px), 1px `edge-lit` border, transparent fill.
- **Default:** Archivo 12px, `6px 12px`, `stardust` text. Hover shifts the border to
  vermilion and lays a 7% vermilion wash behind it; there is no fill change.
- **Primary (the stamp):** solid vermilion, night-ink knockout text, uppercase 10px/600
  at `0.14em`, `7px 16px`. Hover does not change colour — it brightens (`filter:
  brightness(1.1)`), the way more pressure on a stamp does. One per view.
- **Danger:** alarm text on a 40%-alarm border; hover brings an 8% alarm wash.
- **Icon:** 30×30, muted, `edge` border; `warn`/`alarm` variants only recolour.
- **Disabled:** `opacity: 0.35`, cursor default. No greyed-out palette.

### Chips and Badges
- **Badge** (identity): hairline outline, transparent fill, 9px uppercase label. `role`
  uses aux, `model` uses muted, `warn` gets a 10% amber fill.
- **Chip** (task status): 3px/7px, transparent border by default; `running` aux,
  `done` nominal, `failed` alarm — each at ~10% fill with a 35–40% border. `pending`
  is deliberately colourless.

### Cards / Containers
- **Plate:** `surface-grad` fill, 1px `edge` border, 2px radius, card shadow. Used for
  genuinely bounded things (prompt cards, modal, diff pane, memory detail). Most
  sections are *not* plates — `.panel` is a transparent group whose only chrome is a
  vermilion terminated rule.
- **Padding:** 16px (card), 24px (modal), 12px (dense).

### Inputs / Fields
- **Style:** `void` fill, 1px `edge`, 2px radius, `7px 9px`, 13px.
- **Focus:** border goes vermilion plus a 1px `hud-wash-2` ring; the native outline is
  removed only here, and `:focus-visible` keeps a 2px vermilion outline at 2px offset
  everywhere else.
- **Choice cards** replace dropdowns for small option sets: hairline box, label plus a
  9.5px mono description, selected state = vermilion border + 7% wash.

### Navigation
- **Plate index (`Rail`):** text, not icons — an atlas index carries names. 12.5px
  Archivo, no uppercase, a 5px bullet that is `inert` at rest, `muted` on hover and
  vermilion (with a 22% halo ring) when active. Amber count badges ride the right edge
  for attention states. A mono foot line names the current project directory.
- **Icons** exist only as two authored 20px/1.5px line glyphs (`ICONS.settings`,
  `ICONS.plate`) plus an inline chevron in the catalogue. There is no icon font and no
  icon library.

### Signature: the Sky
The thesis surface (`Sky.tsx`), rendered in real pixels via `ResizeObserver` rather
than a scaled `viewBox`, so labels never scale with the box.
- **Star = agent.** Radius `4 + sqrt(tok/maxTok) * 8` — magnitude is token weight, and
  the legend (top right, "Kadir") states the scale.
- **Colour + form = status:** working = aux with a halo, idle = stardust, waiting =
  caution **plus a ring** (variable-star notation, so the state survives colour
  blindness), offline = hollow `inert` circle.
- **Constellation line = a real delegation** (`assignedBy → assignedTo`), dashed
  because the line is drawn by the observer, not present in the sky; live tasks draw
  it in vermilion.
- **Role bands** are labelled ellipses, and they are the plate's scale: layout is
  already sorted by role rank, so the ring's claim ("inside this circle is the boss")
  is true. An unlabelled grid was removed because it measured nothing.
- **Reticle** marks the object under observation (selected → needs permission →
  waiting → heaviest working) and turns once every 32s.
- **Below the horizon:** offline agents live in an HTML strip under the field, not in
  the SVG, because fixed-step SVG placement collided on names of different lengths.
- Placement is stable (FNV hash on agent id + golden-angle spiral): position carries
  no meaning, but the same roster always draws the same pattern so the eye can learn it.

### Charts (`charts.tsx` + the Harcama board)
Mark specs come from the dataviz method; colour and type stay on this plate. Bars are
8px on a shared ruler with a 4px rounded data-end and a square baseline corner; the
line is 2px with a ≥8px end-marker carrying a 2px surface ring; the area fill is the
accent at 10%; gridlines are **solid** hairlines (never dashed) one step off the
surface; touching fills are separated by a 2px **surface gap**, never a stroke.

Four rules decide what may be drawn:
- **No value-ramp on nominal categories.** Agents have no natural order and the bar
  length already carries the value, so every bar is the same vermilion. A darker-where-
  bigger ramp would spend the only free channel on information already shown.
- **One axis, always.** Cost and tokens are two magnitudes, so they are two states of
  one chart (a toggle), never two y-scales — a second scale invents a correlation.
- **Text never wears the data colour.** Values, labels and legends stay on the text
  ladder; identity comes from the swatch beside them.
- **The hero figure is Archivo, not Bodoni.** This is where the Engraved Name Rule and
  the dataviz "never a serif hero" rule agree: the display face names things, it never
  carries a number.

The donut is the one radial form and it is allowed only where it is genuinely a
part-to-whole read at a glance (≤ 6 slices, tail folded into "Diğer", a hero total in
the hole). Its slices are ordered by size, so the single-ink opacity ramp follows an
order the data already has rather than inventing one. Two-part proportions
(budget, quota, context fill) are **meters**, not two-slice pies, and a meter whose
limit is undefined draws no track at all — an empty bar would read as "0% used", which
is a different claim.

### Terminal
Structure imitates the Claude Code CLI (marks, welcome box, prompt line); colour,
type and frame come from the plate. Transcript lines animate individually only when
they are genuinely new (keyed by event id).

**CLI skins are an exempt island.** `.terminal[data-cli='claude' | 'codex' | 'grok']`
overrides `--void`, `--fg`, `--muted`, `--dim`, `--cli`, `--edge`, `--border` and even
`--radius` with *fixed literal hex values*, so each CLI reads like the real thing.
This is the one place the Channel Rule and the plate palette do not apply, and it is
intentional: the skinned transcript components carry embedded, site-accurate colours,
so a terminal wearing a skin must stop following the plate or it would be neither.
The exemption is scoped to `.terminal[data-cli]` and must not leak outward.

### Boot curtain
Lives in `index.html`, inline, not in React — a React curtain would only appear after
the bundle parsed, i.e. in the middle of the gap it exists to cover. It paints opaque
on the first frame (no fade-in, which would reveal the blank page), delays its content
by 140ms so a fast start shows only a flat ground, and lifts on `store.ready` rather
than a timer. Its wordmark uses the same face and size as the header, so the word
stays put when the curtain leaves.

## Do's and Don'ts

### Do:
- **Do** define every new colour as an `R G B` channel token and consume it as
  `rgb(var(--x-rgb) / a)`.
- **Do** add derived colour names to the `:root, [data-theme]` block, never to `:root`
  alone — otherwise the theme-preview swatch silently stops working.
- **Do** run `node scripts/contrast.mjs` before accepting any palette change; all
  thresholds must pass against both `--surface-rgb` and `--bg-rgb`.
- **Do** register a new plate in exactly two places: a token-only block in `themes.css`
  and one row in `themes.ts`.
- **Do** put every `transition` for interactive elements in the motion layer's shared
  selector list near the top of `index.css`. A `transition` written inside a component
  rule lands *after* the motion layer and overrides it, and the interaction snaps.
- **Do** use `animation-fill-mode: backwards`. `both` permanently applies
  `transform: none` at the end and kills hover motion entirely.
- **Do** keep spacing on the `--s1`…`--s6` scale and numbers in mono with tabular figures.
- **Do** encode status with colour **and** form (ring, hollow, fill), so the red-lamp
  plate and colour-blind readers still separate the states.
- **Do** keep interface copy in Turkish, including empty states and aria labels.

### Don't:
- **Don't** write a raw colour literal in component CSS. The only exception is black in
  a shadow — and the day plate proves even that gets re-tinted per edition.
- **Don't** write selectors in `themes.css`. A plate overrides tokens; if a plate needs
  a new structural behaviour, the token for it goes in `index.css` first.
- **Don't** add a second entrance animation. `plate-in` on `main > *` is the only
  authored entrance in the app; the world's continuous motion is sidereal drift,
  reticle turn and star pulse. Genuine appearance events — modal, slash menu,
  permission banner, a new transcript line, a disclosure panel — are separate and
  allowed; a section that merely re-renders is not one of them.
- **Don't** disable feedback under `prefers-reduced-motion`. Positional motion is
  removed and durations are cut, but the working/waiting pulses and the CLI spinner are
  explicitly preserved — with them gone, "is it running?" has no visual answer.
- **Don't** thicken a border or round a corner for emphasis. Brighten the edge instead.
- **Don't** introduce glass, ring shadows, or glow on plate chrome. `--glass-blur` is 0
  and the day plate sets `--glow-a: 0`; anything that reads as luminous will look broken
  on paper.
- **Don't** let the CLI skin palettes escape `.terminal[data-cli]`, and don't add plate
  tokens to them — they are fixed-palette islands by design.
- **Don't** draw geometry the data does not support. No invented coordinates, no
  unlabelled grid, no decorative constellation. Every mark on the sky maps to a field.
- **Don't** rebuild a repeating list as a card grid.

## Styles (design language, separate from palette)

The sky-plate identity above is the **Observatory** style, the default. A
second style, **Studio**, re-skins the same tokens for users who want a plain
product surface. Style lives on `data-style` (`src/styles.css`); palette stays
on `data-theme`.

| | Observatory | Studio |
|---|---|---|
| Display type | Bodoni Moda italic | system sans (Segoe UI Variable / SF), 600 |
| UI type | Archivo | system sans |
| Corners | 2/3px (premium 4/6px) | 6/10px |
| Texture | grain, graticule, starfield | none, flat ground |
| Labels | vermilion/cyan small caps | muted small caps, 0.06em |
| Palette | Obsidian only (since 2026-11-25 every style has exactly one palette) | Paper only |

Studio rules: no ornament that is not data; status colors stay distinct from
the accent; contrast is measured with `scripts/contrast.mjs` like every plate.
