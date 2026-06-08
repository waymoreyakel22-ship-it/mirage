# Mirage — dev log

## Phase 2 checklist (functionality)

Living tracker for Phase 2 — the shell becomes a working editor. Phase 2 is
complete when every box below is checked.

**Timeline / clips**
- [x] Drag-and-drop media pool → timeline (kind-gated V/A tracks)
- [x] Clip select / move / delete
- [x] Selection → Clip Info tab (live metadata)
- [x] Overlap handling (block style) + drop-preview ghost
- [x] Clip trim/resize — drag edges to change in/out + duration
- [x] Ripple / insert mode — neighbours shift instead of block (Ripple tool)
- [x] Cross-layer clip move — drag a clip to another compatible track
- [x] Alignment aids — snap-to-edge dotted guides + origin ghost while moving
- [x] Razor / Cut — split a clip at the click point (frame-accurate)
- [x] Snap (magnet) as a real toggle, not always-on
- [x] Zoom in/out — variable timeline scale

**Playback / playhead**
- [x] Play/pause — wire transport, running timecode
- [x] Scrubbing — draggable playhead + click-to-seek (ruler)
- [x] Top-bar timecode reflects playhead position

**AI / right panel**
- [ ] AI thoughts panel trigger (built, never surfaced)
- [ ] Suggestions are interactive (click → jump/apply), not static mock

**Persistence / data**
- [x] Persist timeline (localStorage save + rehydrate + reset)
- [ ] Verify media import (+Import / file picker) adds usable assets

## 2026-06-06 — Timeline persistence

- Timeline now persists to `localStorage` (`mirage.timeline.v1`): debounced save
  (400ms) on clip change, rehydrate on mount via `loadClips()` (validates shape,
  falls back to seed on missing/corrupt). Survives full refresh.
- Reset button (⟲) in the timeline toolbar restores the seed layout and clears
  the saved copy (with a confirm).

## 2026-06-06 — Snap toggle + Zoom

- Magnet (⊕) is now a real snap on/off toggle, separate from the active tool
  (`snapEnabled` in useTimeline). Off → clip move/drop is free (frame precision,
  no edge guides, no second-quantise); overlap prevention stays. Razor always
  frame-accurate. `landing()` takes a snap flag; `snapMove`/second-snap gated.
- Zoom in/out widens the ruler + lanes (×1.5, 1–8) via inline width; horizontal
  scroll appears. All drag/drop/scrub/razor math holds because positions are %
  read against the live element width. Toolbar special-cases magnet (toggle) and
  zoom (actions) vs the exclusive mode tools.

## 2026-06-06 — Playback (play/scrub/timecode) + Razor

### Playback / playhead
- New minimal `context/PlaybackContext.tsx`: `playheadSec`, `setPlayheadSec`,
  `playing`, `toggle`, `durationSec`. Play advances the playhead via rAF in real
  time and stops at the end (restarts from 0 if played from the end).
- Playhead is now real state (was static 28%). Ruler is click/drag scrubbable.
- PreviewPlayer transport wired: skip-to-start/end, ±5s, play/pause (icon swaps).
- Both timecodes (preview top-bar + timeline toolbar) show the live playhead as
  `h:mm:ss:ff` via new `formatTimecodeFrames`. Shared `TIMELINE_SECONDS`/`FPS`
  constants moved to `data/timeline.ts`.

### Razor / Cut
- Razor or Cut tool → crosshair over clips; clicking splits the clip in two.
- Cuts snap to the frame (30fps) for accuracy (was second-snapped); each piece
  ≥1 frame. A red dotted cut-cursor follows the pointer (frame-snapped) so you
  see exactly where the cut lands before clicking.
- Pieces are independent clips (move/trim/ripple/cross-layer like any other).

## 2026-06-06 — Sticky origin snap + resize grips

- Origin column now snaps with a wider threshold (~12px) and priority over other
  edges (`snapMove`), so a clip stays glued under the ghost while sliding side to
  side on any layer. Other edges keep the normal ~7px.
- Resize seams (preview/timeline, sidebar, right) now show a grip affordance —
  two bars + chevrons, quiet by default, brightens on hover. Row seam vertical;
  col seams rotate the grip 90° to point along the drag axis.

## 2026-06-06 — Alignment aids (guides + origin ghost)

- While moving a clip, a faint placeholder stays in the source lane with two
  dotted vertical lines rising from its left/right edges. Those origin edges are
  snap candidates, so a clip drops back into the same horizontal position on a
  different layer; the line brightens when an edge snaps onto it.
- `clipEdges()` gathers every other clip's edges + timeline ends; `alignEdges()`
  pulls the nearest dragged edge onto the closest candidate within ~6px and
  reports the x to draw. Edge-snap takes priority over second-snap on release.
- Fix (the "only moves down a layer" report): it wasn't direction — the target
  lane was full. `Main_theme` spanned 0–95% of A1, so nothing could move up into
  it. Gave every track headroom in the seed (A1 60%, V1 opened a gap) so
  cross-layer moves land in both directions.

## 2026-06-06 — Cross-layer clip move

- A move-drag can now change lanes: it snapshots each lane's vertical bounds at
  grab time and hit-tests the cursor's Y against compatible tracks (video →
  V1/V2, audio → A1/A2). Incompatible lanes are ignored (clip stays put).
- Horizontal placement reuses `findSlot`, so cross-track lands obey the same
  no-overlap rule; `relocate()` moves the clip between track arrays.
- Behaviour shift: move now uses nearest-free-slot instead of clamp-to-gap, so a
  clip dragged past a neighbour hops to the nearest open gap. Resize unchanged.

## 2026-06-06 — Ripple / insert mode

- Wired to the Ripple tool. Tool state moved from `Timeline.tsx` into
  `useTimeline` so drop + delete logic can read it.
- **Insert on drop:** in ripple mode a dropped clip opens space at the insert
  point and pushes every downstream clip right by its width (`rippleInsertPlan`).
  Dropping inside a clip lands after it (no split). Rejected if the push would
  overrun the timeline end; ghost goes red.
- **Ripple delete:** in ripple mode deleting a clip closes the gap — downstream
  clips slide left by its width (`rippleClose`), spacing preserved.
- Select tool keeps block behaviour (drop into gaps, delete leaves a hole).
- Known gap: ghost shows insert point + length, not the live downstream shift.

## 2026-06-06 — Clip trim/resize

- Drag a clip's left edge to set the in point (right edge anchored) or the right
  edge to set the out point / duration (left anchored). Snaps to the second on
  release; Clip Info In/Duration update live.
- Move + both resizes unified into one drag path: `geometry()` computes left/width
  per mode, `gapAround()` (in `lib/overlap.ts`) gives the free span. Trimming
  obeys the same overlap rules as moving and can't shrink below 1s.
- 6px invisible edge hit-zones with a faint grip line on hover; handles
  `stopPropagation` so an edge resizes instead of moving the whole clip.

## 2026-06-06 — Overlap handling + drop-preview ghost

### Overlap handling (block style, Select tool)
- Clips can no longer stack on a track. New pure-function module `lib/overlap.ts`
  (`overlaps`, `moveBounds`, `findSlot`) holds the percent-space geometry.
- **Move:** a dragged clip is clamped to its current gap — it slides until it
  butts against the nearest neighbour and can't jump past one. Bounds are
  computed once at drag start (`moveBounds`) and stored on the move ref.
- **Drop:** a new clip routes through `findSlot` and lands in the nearest free
  gap to the cursor; if no gap fits the clip's width, the drop is rejected.
- Ripple/insert behaviour deferred — would tie to the Ripple tool later.

### Drop-preview ghost
- Dragging a media-pool asset over a track now shows a transparent dashed ghost
  sized to the asset's real duration, snapped to the second and resolved to the
  actual landing gap (preview == result; shared `landing()` helper).
- Duration rides in a second custom MIME name (`application/x-mirage-dur-<sec>`)
  set at dragstart, readable during dragover. Kind marker renamed to
  `application/x-mirage-kind-<kind>` so the two prefixes don't collide.
- Ghost + lane go red when the track has no room or the kind is wrong.

### Fixed
- Full / occupied track no longer shows a false-valid (green) highlight. Drag
  validity is now `fits = findSlot(...) !== null`, not just a kind match.

## 2026-06-05 — Phase 2 begins

Phase 2 (functionality) authorized. Also pushed Phase 1 to GitHub:
`github.com/waymoreyakel22-ship-it/mirage` (public, branch `main`).

### Preview transport relocation
- Moved transport controls out of the top bar to a centered row directly below the
  preview screen. Top bar now holds only the timecode (right-aligned).
- Replaced unicode media glyphs (rendered as blue emoji on Windows) with inline
  monochrome SVG icons using `fill: currentColor` — color `#444444`, play larger.

### Media pool → timeline drag and drop
- Bin items are `draggable`; on dragstart the asset JSON rides in `application/json`
  and its kind rides in a custom MIME type (`application/x-mirage-<kind>`) so drop
  targets can read kind during dragover (when getData is blocked).
- Tracks carry `accepts` ('video' for V1/V2, 'music' for A1/A2).
- Valid track → 1px `#7B6EF6` inset highlight; wrong type → red tint + reject
  (`dropEffect='none'`, no preventDefault). Source dims to 0.4 while dragging.
- Drop computes position from cursor X, snaps to nearest second.

### Clips as objects: select / move / delete
- `useTimeline` hook owns clip state + all interaction logic (Timeline.tsx is
  presentational again).
- Click selects (1px accent ring). Drag within a track moves via pointer events
  (separate from native DnD); live-follows cursor, snaps to second on release.
- Delete/Backspace removes selected clip (ignored while typing in a field).

### Selection context + Clip Info wiring
- Minimal `context/SelectionContext.tsx` — just `selectedClip` + `setSelectedClip`.
- Inspector Clip Info tab now shows live derived metadata (File/Track/Type/In/
  Duration) or a "No clip selected" empty state. Removed static `CLIP_META`.

### Accent rule clarification
- Transient interaction states (drop-valid highlight, selection ring) use `#7B6EF6`
  and do NOT count against the 4 persistent-spot cap.

Note: clips are in-memory only — no persistence yet (resets on refresh).

## 2026-06-04 (gate) — Phase 1 complete

Final Phase 1 gate adjustments (build clean, CSS bundle ~13.7 kB):
- Preview panel initial height 0.28 → **0.22** of viewport (`useResizablePanels.ts`)
- Wordmark color `#686868` → **`#444444`** (`Sidebar.css`)
- Accent count trimmed 5 → **4**: dropped the AI-thoughts active-step dot to neutral `#7A7A7A` (`AiThoughts.css`)

**Phase 1 gate — all 10 verified:**
1. Three columns, resizable, preview + timeline + mode tabs ✓
2. Media pool: folder tree, thumbnail grid, list/grid toggle, + New folder ✓
3. No gradients/glows/neon; accent `#7B6EF6` in 4 places (playhead · active mode tab · suggestion card border · folder-rename focus) ✓
4. All panels resizable — preview/timeline vertical, sidebar + right horizontal ✓
5. Suggestion cards left border accent ✓
6. Empty track area `#0A0A0A` ✓
7. Preview ~22% height ✓
8. Wordmark 11px `#444444` weight 400 ✓
9. All timecodes + metadata monospace ✓
10. Pure shell — nothing functional ✓

Status: **Phase 1 closed, awaiting sign-off before Phase 2.** Do not start Phase 2 until user confirms.

## 2026-06-04 (later) — modular refactor

Adopted standing pro-NLE design + engineering standards (muted palette, real video microcopy, stateful async UX, strict modularization, no ghost actions, secure server-side media handling). The modularization rule reverses the original "one App.tsx" decision.

Split the ~600-line monolith into a module tree (behavior identical, build clean, CSS bundle unchanged at ~13.7 kB):

```
src/
  App.tsx                  — thin shell: grid + useResizablePanels, composes the 3 panels + handles
  App.css                  — tokens, base elements, .app grid, shared utils (.flex-spacer/.timecode/.section-label)
  types.ts                 — CenterMode / RightTab / Tool / Kind / BinView / Folder / Asset
  lib/format.ts            — clamp, kindFromName, formatSize
  data/
    media.ts               — ASSET_ICONS, DEFAULT_FOLDERS, INITIAL_MEDIA
    timeline.ts            — TRACKS, CLIPS, RULER_MARKS, TOOLS
    inspector.ts           — FP_STATS, SUGGESTIONS, STYLE_PATTERNS, CLIP_META
  hooks/
    useResizablePanels.ts  — pointer drag sizing for all 3 seams (min/max + live timeline-floor clamp)
    useMediaBin.ts         — folders/media/view/rename/context-menu/import state
  components/  (+ co-located .css each)
    Sidebar, MediaBin, PreviewPlayer, Timeline, AiThoughts, Center, Inspector, ResizeHandle
```

Component state now lives where it's used (Timeline owns activeTool, Center owns mode, Inspector owns its tab). Panel-size refs (centerRef/tabbarRef) created in App, passed to Center + the resize hook so the preview ceiling stays accurate.

## 2026-06-04

### Design overhaul — make it feel like real software
Refs: DaVinci Resolve (near-zero color, pure function), Linear, Zed (mono-forward, brutally clean). Goal: dense, technical, low-chrome; accent rationed.

**Killed**
- Wordmark gradient → flat `#EFEFEF`
- All decorative glows / drop-shadows (playhead, AI active dot, suggestion card hover)
- Gradient stat bars → flat single color (`#5A5A5A` fingerprint, `#4A4A4A` style), no border-radius
- Brightness/box-shadow clip hover → border highlight only

**Added / changed**
- Monospace (JetBrains Mono, loaded in `index.html`) via `--mono` token, applied to all numerics/technical text: timecodes, ruler labels, track labels, filenames (asset list + clips), fp values, sug-time, clip-info values, AI log lines
- Accent `#7B6EF6` now used in exactly TWO places: playhead (diamond + line) and active mode tab top-border. Every other active state (nav, asset tabs, tools, right tabs) → neutral (`#EFEFEF` text / `#5A5A5A`–`#2C2C2C` borders)
- Muted slate track colors: V2 `#5E8B7E` · V1 `#7079A8` · A1 `#9A8662` · A2 `#9B6B7D` (was jewel teal/purple/amber/pink)
- Subtler chrome: `--border` `#1A1A1A`→`#181818`, new `--line #141414` for internal timeline grid; `--muted`/`--dim` retuned
- Tighter density: track-h 42→40, ruler-h 26→24, header 64→60, smaller paddings/radii, section labels now UPPERCASE tracked
- Build confirmed clean

## 2026-06-03

### Project bootstrap
- Created fresh Vite + React + TypeScript project at `source/repos/mirage/`
- Installed dependencies, confirmed clean build

### Full shell layout built (`App.tsx` + `App.css`)
Three-column layout, full viewport height:

**Left sidebar (188px)**
- Wordmark: "Mirage" with purple→indigo→blue gradient, Outfit 500
- Nav: Editor (active), Auto-edit, Fingerprint, Settings — accent left-border on active
- Asset library with Video / Music / Images tabs, thumbnail rows

**Center**
- Preview panel (44% height): transport toolbar (⏮ ⏪ ▶ ⏩ ⏭) + 16:9 video screen with dot-grid empty state
- Timeline section (flex: 1):
  - Toolbar: Select ↖ · Cut ✂ · Razor ⌿ · Snap ⊕ · Ripple ⊘ · Zoom +/−
  - 64px track header column — V2 (teal), V1 (purple), A1 (amber), A2 (pink)
  - Ruler with timecodes (0:00–0:30), playhead diamond + vertical line at 28%
  - Mock clips: V2 title card, V1 two clips, A1 full-width, A2 two SFX clips
  - AI thoughts panel: hidden by default (`translateY(100%)`), slides up on `.visible`
- Mode tab bar pinned to bottom (DaVinci-style top-border accent): Timeline · AI editor · Color · Audio

**Right panel (224px)**
- Suggestions tab: fingerprint stats (Cut rate / Energy / Silence) with gradient bars + 3 suggestion cards (left accent border)
- Style tab: 4 channel pattern bars (Pacing / Color grade / Cut style / Music sync)
- Clip info tab: 6 metadata rows (file, duration, resolution, fps, codec, audio)

### Styling
- Font: Outfit (Google Fonts, `wght@400;500`) — loaded in `index.html`
- Wordmark gradient: `linear-gradient(90deg, #c084fc 0%, #818cf8 52%, #60a5fa 100%)`
- Tokens: `--bg #0C0C0C` · `--surface #0F0F0F` · `--border #1A1A1A` · `--accent #7B6EF6` · `--text #D0D0D0` · `--muted #2E2E2E` · `--dim #505050`
- Track height 42px, ruler 26px, header column 64px
- Fingerprint and style bars share the wordmark gradient
- Suggestion cards: left accent border that brightens to full accent on hover
- Playhead glow: `drop-shadow` on diamond, `box-shadow` on line
- Alt track rows: `rgba(255,255,255,0.007)` tint for visual separation
- AI thoughts panel: `backdrop-filter: blur(8px)`

### File structure
```
src/
  App.tsx       — full static layout, all data as top-level constants
  App.css       — all styles, single file
  index.css     — base reset only (*, html, body, #root)
  main.tsx      — unchanged Vite entry
index.html      — Outfit font link, title "Mirage"
```

### Status
Static shell complete. No functionality yet — tab switching (asset library, right panel, mode tabs) and tool selection are the only live interactions. Everything else is placeholder data.

### Next
- Wire up actual playback / timeline scrubbing
- Implement drag-and-drop from asset library to timeline
- AI thoughts panel trigger logic
- Actual clip selection → Clip info tab update
