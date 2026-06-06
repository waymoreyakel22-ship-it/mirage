import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { CLIPS, RULER_MARKS, TRACKS } from '../data/timeline'
import { clamp, parseClockToSeconds } from '../lib/format'
import { findSlot, gapAround } from '../lib/overlap'
import { useSelection, type SelectedClip } from '../context/SelectionContext'
import type { Asset, Clip } from '../types'

const TIMELINE_SECONDS = parseClockToSeconds(RULER_MARKS[RULER_MARKS.length - 1])
const DEFAULT_CLIP_SECONDS = 4
const MIN_CLIP_SECONDS = 1
const MIN_WIDTH_PCT = (MIN_CLIP_SECONDS / TIMELINE_SECONDS) * 100
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

  // Latest selection, readable inside the once-registered document listeners.
  const selectedRef = useRef(selectedClip)
  selectedRef.current = selectedClip

  const dragRef = useRef<{
    mode: DragMode
    trackId: string
    clipId: string
    startX: number
    laneWidth: number
    gapStart: number
    gapEnd: number
    originLeft: number
    originWidth: number
    left: number
    width: number
    moved: boolean
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

  // Pointer-based clip move/resize within its track. Live edges are unsnapped
  // for smoothness; the moving edge snaps to the nearest second on release.
  useEffect(() => {
    function move(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
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
      if (!d.moved) return

      // Snap the edge the user was dragging, then re-derive the other.
      let left = d.left
      let width = d.width
      if (d.mode === 'resize-r') {
        const right = clamp(snapPctToSecond(d.left + d.width), d.left + MIN_WIDTH_PCT, d.gapEnd)
        width = right - d.left
      } else if (d.mode === 'resize-l') {
        left = clamp(snapPctToSecond(d.left), d.gapStart, d.left + d.width - MIN_WIDTH_PCT)
        width = d.left + d.width - left
      } else {
        left = clamp(snapPctToSecond(d.left), d.gapStart, d.gapEnd - d.width)
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
      setClips(prev => {
        const out: Record<string, Clip[]> = {}
        for (const id in prev) out[id] = prev[id].filter(c => c.id !== sel.id)
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
    dragRef.current = {
      mode,
      trackId,
      clipId: clip.id,
      startX: e.clientX,
      laneWidth: lane.getBoundingClientRect().width,
      gapStart: start,
      gapEnd: end,
      originLeft: clip.left,
      originWidth: clip.width,
      left: clip.left,
      width: clip.width,
      moved: false,
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

    const width = durToWidthPct(draggedDuration(e.dataTransfer.types) ?? DEFAULT_CLIP_SECONDS)
    const { desiredLeft, placedLeft } = landing(
      e.currentTarget.getBoundingClientRect(), e.clientX, width, clips[id] ?? [],
    )
    const fits = placedLeft !== null
    if (fits) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
    const left = placedLeft ?? clamp(desiredLeft, 0, 100 - width)
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

    const duration = parseClockToSeconds(asset.sub)
    const width = durToWidthPct(Number.isNaN(duration) ? DEFAULT_CLIP_SECONDS : duration)
    const { placedLeft } = landing(e.currentTarget.getBoundingClientRect(), e.clientX, width, clips[id] ?? [])
    if (placedLeft === null) return // track is full — nowhere to land this clip

    const clip: Clip = { id: crypto.randomUUID(), left: placedLeft, width, label: asset.name }
    setClips(prev => ({ ...prev, [id]: [...(prev[id] ?? []), clip] }))
    setSelectedClip(describe(id, clip))
  }

  return {
    clips,
    dropTarget,
    ghost,
    selectedId: selectedClip?.id ?? null,
    beginClipDrag,
    beginClipResize,
    selectNone,
    onTrackDragOver,
    onTrackDragLeave,
    onTrackDrop,
  }
}
