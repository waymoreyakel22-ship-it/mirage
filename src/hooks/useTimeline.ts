import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { CLIPS, RULER_MARKS, TRACKS } from '../data/timeline'
import { clamp, parseClockToSeconds } from '../lib/format'
import { findSlot, gapAround } from '../lib/overlap'
import { useSelection, type SelectedClip } from '../context/SelectionContext'
import type { Asset, Clip, Tool } from '../types'

const TIMELINE_SECONDS = parseClockToSeconds(RULER_MARKS[RULER_MARKS.length - 1])
const DEFAULT_CLIP_SECONDS = 4
const MIN_CLIP_SECONDS = 1
const MIN_WIDTH_PCT = (MIN_CLIP_SECONDS / TIMELINE_SECONDS) * 100
const EPS = 0.01
const KIND_PREFIX = 'application/x-mirage-kind-'
const DUR_PREFIX = 'application/x-mirage-dur-'

export type DragMode = 'move' | 'resize-l' | 'resize-r'
export type DropTarget = { id: string; valid: boolean } | null
export type Ghost = { trackId: string; left: number; width: number; fits: boolean } | null

function initClips(): Record<string, Clip[]> {
  const out: Record<string, Clip[]> = {}
  for (const id in CLIPS) out[id] = CLIPS[id].map(c => ({ id: crypto.randomUUID(), ...c }))
  return out
}

function draggedKind(types: readonly string[]): string | null {
  const marker = types.find(t => t.startsWith(KIND_PREFIX))
  return marker ? marker.slice(KIND_PREFIX.length) : null
}

function draggedDuration(types: readonly string[]): number | null {
  const marker = types.find(t => t.startsWith(DUR_PREFIX))
  if (!marker) return null
  const sec = Number(marker.slice(DUR_PREFIX.length))
  return Number.isFinite(sec) && sec > 0 ? sec : null
}

const snapPctToSecond = (pct: number) => {
  const sec = clamp(Math.round((pct / 100) * TIMELINE_SECONDS), 0, TIMELINE_SECONDS)
  return (sec / TIMELINE_SECONDS) * 100
}

const durToWidthPct = (durSec: number) =>
  (clamp(durSec, 1, TIMELINE_SECONDS) / TIMELINE_SECONDS) * 100

// Where a width-wide clip would land if dropped at the cursor: the cursor X
// snapped to the nearest second, then resolved to the closest free gap.
function landing(rect: DOMRect, clientX: number, width: number, existing: Clip[]) {
  const ratio = (clientX - rect.left) / rect.width
  const startSec = clamp(Math.round(ratio * TIMELINE_SECONDS), 0, TIMELINE_SECONDS)
  const desiredLeft = (startSec / TIMELINE_SECONDS) * 100
  return { desiredLeft, placedLeft: findSlot(existing, desiredLeft, width) }
}

// Ripple/insert: a new clip opens space at the insert point and pushes every
// downstream clip right by its width. Inserting inside a clip lands after it
// (no split). `fits` is false when the push would overrun the timeline end.
function rippleInsertPlan(existing: Clip[], desiredLeft: number, width: number) {
  const straddler = existing.find(c => c.left < desiredLeft - EPS && c.left + c.width > desiredLeft + EPS)
  const insertLeft = straddler ? straddler.left + straddler.width : desiredLeft
  const shifted = existing.map(c => (c.left >= insertLeft - EPS ? { ...c, left: c.left + width } : c))
  const fits = insertLeft + width <= 100 + EPS && shifted.every(c => c.left + c.width <= 100 + EPS)
  return { insertLeft, shifted, fits }
}

// Ripple delete: removing a clip closes the gap — clips after it slide left by
// the removed clip's width, preserving the spacing between them.
function rippleClose(trackClips: Clip[], removed: Clip): Clip[] {
  return trackClips
    .filter(c => c.id !== removed.id)
    .map(c => (c.left >= removed.left - EPS ? { ...c, left: c.left - removed.width } : c))
}

// Move a clip (by id) to `targetTrack` at `left`, removing it from whatever
// track it currently lives on. Used by cross-layer dragging.
function relocate(clips: Record<string, Clip[]>, clipId: string, targetTrack: string, left: number) {
  let moved: Clip | undefined
  const out: Record<string, Clip[]> = {}
  for (const t in clips) {
    const found = clips[t].find(c => c.id === clipId)
    if (found) moved = found
    out[t] = clips[t].filter(c => c.id !== clipId)
  }
  if (!moved) return clips
  out[targetTrack] = [...(out[targetTrack] ?? []), { ...moved, left }]
  return out
}

// Snap candidates while moving: every other clip's edges, plus the timeline ends.
function clipEdges(clips: Record<string, Clip[]>, exceptId: string): number[] {
  const out = [0, 100]
  for (const t in clips) {
    for (const c of clips[t]) {
      if (c.id === exceptId) continue
      out.push(c.left, c.left + c.width)
    }
  }
  return out
}

// Pull a clip's nearest edge onto the closest candidate within `threshold`.
// Returns the adjusted left and the candidate x to draw a guide at (or null).
function alignEdges(left: number, width: number, edges: number[], threshold: number) {
  let best = { dist: threshold, left, guide: null as number | null }
  for (const x of edges) {
    const dl = Math.abs(left - x)
    if (dl < best.dist) best = { dist: dl, left: x, guide: x }
    const dr = Math.abs(left + width - x)
    if (dr < best.dist) best = { dist: dr, left: x - width, guide: x }
  }
  return { left: best.left, guide: best.guide }
}

const sameNums = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i])

function describe(trackId: string, clip: Clip): SelectedClip {
  const track = TRACKS.find(t => t.id === trackId)
  return {
    id: clip.id,
    name: clip.label,
    trackLabel: track?.label ?? trackId.toUpperCase(),
    kind: track?.accepts === 'music' ? 'Audio' : 'Video',
    startSec: (clip.left / 100) * TIMELINE_SECONDS,
    durationSec: (clip.width / 100) * TIMELINE_SECONDS,
  }
}

export function useTimeline() {
  const { selectedClip, setSelectedClip } = useSelection()
  const [clips, setClips] = useState<Record<string, Clip[]>>(initClips)
  const [dropTarget, setDropTarget] = useState<DropTarget>(null)
  const [ghost, setGhost] = useState<Ghost>(null)
  const [activeTool, setActiveTool] = useState<Tool>('select')
  // Move-drag alignment aids: vertical guide lines + a placeholder in the source lane.
  const [guides, setGuides] = useState<number[]>([])
  const [moveOrigin, setMoveOrigin] = useState<{ trackId: string; left: number; width: number } | null>(null)

  // Latest values, readable inside the once-registered document listeners.
  const selectedRef = useRef(selectedClip)
  selectedRef.current = selectedClip
  const activeToolRef = useRef(activeTool)
  activeToolRef.current = activeTool
  const clipsRef = useRef(clips)
  clipsRef.current = clips

  const dragRef = useRef<{
    mode: DragMode
    trackId: string
    clipId: string
    label: string
    startX: number
    laneWidth: number
    gapStart: number
    gapEnd: number
    originLeft: number
    originWidth: number
    left: number
    width: number
    moved: boolean
    // Move-only: where the clip can change lanes.
    kind: string
    currentTrack: string
    lanes: { id: string; accepts: string; rect: DOMRect }[]
  } | null>(null)

  // Geometry for a drag at a given cursor delta. Move slides within the gap;
  // resize-l drags the in point (right edge fixed); resize-r drags the out point
  // (left edge fixed). All clamp to the gap and a 1s floor.
  function geometry(d: NonNullable<typeof dragRef.current>, deltaPct: number) {
    if (d.mode === 'move') {
      const left = clamp(d.originLeft + deltaPct, d.gapStart, d.gapEnd - d.originWidth)
      return { left, width: d.originWidth }
    }
    if (d.mode === 'resize-r') {
      const width = clamp(d.originWidth + deltaPct, MIN_WIDTH_PCT, d.gapEnd - d.originLeft)
      return { left: d.originLeft, width }
    }
    const right = d.originLeft + d.originWidth
    const left = clamp(d.originLeft + deltaPct, d.gapStart, right - MIN_WIDTH_PCT)
    return { left, width: right - left }
  }

  // Pointer-based clip move/resize. Live edges are unsnapped for smoothness; the
  // moving edge snaps to the nearest second on release. Move can change lanes
  // (compatible tracks only); resize stays on its track.
  useEffect(() => {
    // Snap a position to nearby edges. The clip's own origin column wins with a
    // wider threshold, so it stays glued under the ghost as you slide side to
    // side; otherwise snap to other clips' edges / timeline ends.
    function snapMove(d: NonNullable<typeof dragRef.current>, pos: number) {
      const originEdges = [d.originLeft, d.originLeft + d.originWidth]
      const origin = alignEdges(pos, d.width, originEdges, (12 / d.laneWidth) * 100)
      if (origin.guide !== null) return origin
      return alignEdges(pos, d.width, clipEdges(clipsRef.current, d.clipId), (7 / d.laneWidth) * 100)
    }

    // Cursor Y → compatible target lane; horizontal X → snap to nearby clip edges
    // (drawing guides), else the nearest free slot in that lane.
    function moveTick(d: NonNullable<typeof dragRef.current>, e: MouseEvent) {
      setMoveOrigin(prev => prev ?? { trackId: d.trackId, left: d.originLeft, width: d.originWidth })
      const deltaPct = ((e.clientX - d.startX) / d.laneWidth) * 100
      const desired = clamp(d.originLeft + deltaPct, 0, 100 - d.width)
      const { left: aligned, guide } = snapMove(d, desired)

      const lane = d.lanes.find(
        l => l.accepts === d.kind && e.clientY >= l.rect.top && e.clientY <= l.rect.bottom,
      )
      const targetTrack = lane ? lane.id : d.currentTrack
      const others = (clipsRef.current[targetTrack] ?? []).filter(c => c.id !== d.clipId)
      const slot = findSlot(others, aligned, d.width)
      if (slot === null) return // target lane has no room at this position

      // Only show a guide when the snap actually landed where it aligned.
      const snapped = guide !== null && Math.abs(slot - aligned) < 0.001
      setGuides(prev => (sameNums(prev, snapped ? [guide!] : []) ? prev : snapped ? [guide!] : []))

      if (targetTrack === d.currentTrack && Math.abs(slot - d.left) < 0.001) return
      d.moved = true
      d.currentTrack = targetTrack
      d.left = slot
      setClips(prev => relocate(prev, d.clipId, targetTrack, slot))
    }

    function move(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      if (d.mode === 'move') {
        moveTick(d, e)
        return
      }
      d.moved = true
      const deltaPct = ((e.clientX - d.startX) / d.laneWidth) * 100
      const { left, width } = geometry(d, deltaPct)
      d.left = left
      d.width = width
      setClips(prev => ({
        ...prev,
        [d.trackId]: prev[d.trackId].map(c => (c.id === d.clipId ? { ...c, left, width } : c)),
      }))
    }
    function up() {
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (d.mode === 'move') {
        setGuides([])
        setMoveOrigin(null)
      }
      if (!d.moved) return

      if (d.mode === 'move') {
        // Prefer an edge alignment; otherwise snap to the nearest second. Then
        // re-resolve to a free slot in the landing lane.
        const { left: aligned, guide } = snapMove(d, d.left)
        const target = guide !== null ? aligned : snapPctToSecond(d.left)
        const others = (clipsRef.current[d.currentTrack] ?? []).filter(c => c.id !== d.clipId)
        const left = findSlot(others, target, d.width) ?? d.left
        setClips(prev => relocate(prev, d.clipId, d.currentTrack, left))
        if (selectedRef.current?.id === d.clipId) {
          setSelectedClip(describe(d.currentTrack, { id: d.clipId, left, width: d.width, label: d.label }))
        }
        return
      }

      // Resize: snap the edge the user was dragging, then re-derive the other.
      let left = d.left
      let width = d.width
      if (d.mode === 'resize-r') {
        const right = clamp(snapPctToSecond(d.left + d.width), d.left + MIN_WIDTH_PCT, d.gapEnd)
        width = right - d.left
      } else {
        left = clamp(snapPctToSecond(d.left), d.gapStart, d.left + d.width - MIN_WIDTH_PCT)
        width = d.left + d.width - left
      }
      setClips(prev => ({
        ...prev,
        [d.trackId]: prev[d.trackId].map(c => (c.id === d.clipId ? { ...c, left, width } : c)),
      }))
      if (selectedRef.current?.id === d.clipId) {
        setSelectedClip({
          ...selectedRef.current,
          startSec: (left / 100) * TIMELINE_SECONDS,
          durationSec: (width / 100) * TIMELINE_SECONDS,
        })
      }
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
  }, [setSelectedClip])

  // A drop outside any lane (or a cancelled drag) still needs the feedback cleared.
  useEffect(() => {
    const clear = () => {
      setDropTarget(null)
      setGhost(null)
    }
    window.addEventListener('dragend', clear)
    window.addEventListener('drop', clear)
    return () => {
      window.removeEventListener('dragend', clear)
      window.removeEventListener('drop', clear)
    }
  }, [])

  // Delete the selected clip, unless the user is typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return
      const sel = selectedRef.current
      if (!sel) return
      const ripple = activeToolRef.current === 'ripple'
      setClips(prev => {
        const out: Record<string, Clip[]> = {}
        for (const id in prev) {
          const removed = prev[id].find(c => c.id === sel.id)
          out[id] = removed
            ? ripple
              ? rippleClose(prev[id], removed)
              : prev[id].filter(c => c.id !== sel.id)
            : prev[id]
        }
        return out
      })
      setSelectedClip(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setSelectedClip])

  function beginDrag(e: ReactMouseEvent<HTMLDivElement>, mode: DragMode, trackId: string, clip: Clip) {
    e.stopPropagation()
    setSelectedClip(describe(trackId, clip))
    const lane = (e.currentTarget as HTMLElement).closest('.track-lane')
    if (!lane) return
    const others = (clips[trackId] ?? []).filter(c => c.id !== clip.id)
    const { start, end } = gapAround(others, clip)
    // Snapshot every lane's vertical bounds so a move can hit-test the cursor
    // against compatible tracks (lanes don't move during a drag).
    const laneEls = Array.from(lane.parentElement?.querySelectorAll('.track-lane') ?? [])
    const lanes = laneEls.map((el, i) => ({
      id: TRACKS[i].id,
      accepts: TRACKS[i].accepts,
      rect: el.getBoundingClientRect(),
    }))
    dragRef.current = {
      mode,
      trackId,
      clipId: clip.id,
      label: clip.label,
      startX: e.clientX,
      laneWidth: lane.getBoundingClientRect().width,
      gapStart: start,
      gapEnd: end,
      originLeft: clip.left,
      originWidth: clip.width,
      left: clip.left,
      width: clip.width,
      moved: false,
      kind: TRACKS.find(t => t.id === trackId)?.accepts ?? '',
      currentTrack: trackId,
      lanes,
    }
    document.body.style.cursor = mode === 'move' ? 'grabbing' : 'ew-resize'
    document.body.style.userSelect = 'none'
  }

  const beginClipDrag = (e: ReactMouseEvent<HTMLDivElement>, trackId: string, clip: Clip) =>
    beginDrag(e, 'move', trackId, clip)
  const beginClipResize = (e: ReactMouseEvent<HTMLDivElement>, trackId: string, clip: Clip, edge: 'l' | 'r') =>
    beginDrag(e, edge === 'l' ? 'resize-l' : 'resize-r', trackId, clip)

  const selectNone = () => setSelectedClip(null)

  function onTrackDragOver(e: ReactDragEvent<HTMLDivElement>, accepts: string, id: string) {
    const kind = draggedKind(e.dataTransfer.types)
    if (!kind) return

    // Wrong track type: reject outright, no preview ghost.
    if (kind !== accepts) {
      e.dataTransfer.dropEffect = 'none'
      setGhost(null)
      setDropTarget(prev => (prev?.id === id && !prev.valid ? prev : { id, valid: false }))
      return
    }

    const existing = clips[id] ?? []
    const width = durToWidthPct(draggedDuration(e.dataTransfer.types) ?? DEFAULT_CLIP_SECONDS)
    const { desiredLeft, placedLeft } = landing(e.currentTarget.getBoundingClientRect(), e.clientX, width, existing)

    // Ripple mode inserts (pushes downstream right); Select mode drops into a gap.
    let fits: boolean
    let left: number
    if (activeTool === 'ripple') {
      const plan = rippleInsertPlan(existing, desiredLeft, width)
      fits = plan.fits
      left = plan.insertLeft
    } else {
      fits = placedLeft !== null
      left = placedLeft ?? clamp(desiredLeft, 0, 100 - width)
    }
    if (fits) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
    setGhost(prev =>
      prev && prev.trackId === id && prev.left === left && prev.width === width && prev.fits === fits
        ? prev
        : { trackId: id, left, width, fits },
    )
    setDropTarget(prev => (prev?.id === id && prev.valid === fits ? prev : { id, valid: fits }))
  }

  function onTrackDragLeave(e: ReactDragEvent<HTMLDivElement>, id: string) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDropTarget(prev => (prev?.id === id ? null : prev))
    setGhost(prev => (prev?.trackId === id ? null : prev))
  }

  function onTrackDrop(e: ReactDragEvent<HTMLDivElement>, accepts: string, id: string) {
    e.preventDefault()
    setDropTarget(null)
    setGhost(null)
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    let asset: Asset
    try {
      asset = JSON.parse(raw)
    } catch {
      return
    }
    if (asset.kind !== accepts) return

    const existing = clips[id] ?? []
    const duration = parseClockToSeconds(asset.sub)
    const width = durToWidthPct(Number.isNaN(duration) ? DEFAULT_CLIP_SECONDS : duration)
    const { desiredLeft, placedLeft } = landing(e.currentTarget.getBoundingClientRect(), e.clientX, width, existing)

    if (activeTool === 'ripple') {
      const plan = rippleInsertPlan(existing, desiredLeft, width)
      if (!plan.fits) return // insert would overrun the timeline end
      const clip: Clip = { id: crypto.randomUUID(), left: plan.insertLeft, width, label: asset.name }
      setClips(prev => ({ ...prev, [id]: [...plan.shifted, clip] }))
      setSelectedClip(describe(id, clip))
      return
    }

    if (placedLeft === null) return // track is full — nowhere to land this clip
    const clip: Clip = { id: crypto.randomUUID(), left: placedLeft, width, label: asset.name }
    setClips(prev => ({ ...prev, [id]: [...existing, clip] }))
    setSelectedClip(describe(id, clip))
  }

  return {
    clips,
    dropTarget,
    ghost,
    guides,
    moveOrigin,
    activeTool,
    setActiveTool,
    selectedId: selectedClip?.id ?? null,
    beginClipDrag,
    beginClipResize,
    selectNone,
    onTrackDragOver,
    onTrackDragLeave,
    onTrackDrop,
  }
}
