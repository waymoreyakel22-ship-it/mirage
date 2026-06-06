import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { CLIPS, RULER_MARKS, TRACKS } from '../data/timeline'
import { clamp, parseClockToSeconds } from '../lib/format'
import { findSlot, moveBounds } from '../lib/overlap'
import { useSelection, type SelectedClip } from '../context/SelectionContext'
import type { Asset, Clip } from '../types'

const TIMELINE_SECONDS = parseClockToSeconds(RULER_MARKS[RULER_MARKS.length - 1])
const DEFAULT_CLIP_SECONDS = 4
const KIND_PREFIX = 'application/x-mirage-kind-'
const DUR_PREFIX = 'application/x-mirage-dur-'

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

  const moveRef = useRef<{
    trackId: string
    clipId: string
    startX: number
    laneWidth: number
    originLeft: number
    currentLeft: number
    minLeft: number
    maxLeft: number
    moved: boolean
  } | null>(null)

  // Pointer-based clip move within its track. Live position is unsnapped for
  // smoothness; it snaps to the nearest second on release.
  useEffect(() => {
    function move(e: MouseEvent) {
      const m = moveRef.current
      if (!m) return
      m.moved = true
      const deltaPct = ((e.clientX - m.startX) / m.laneWidth) * 100
      const left = clamp(m.originLeft + deltaPct, m.minLeft, m.maxLeft)
      m.currentLeft = left
      setClips(prev => ({
        ...prev,
        [m.trackId]: prev[m.trackId].map(c => (c.id === m.clipId ? { ...c, left } : c)),
      }))
    }
    function up() {
      const m = moveRef.current
      if (!m) return
      moveRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      if (!m.moved) return
      const snapped = clamp(snapPctToSecond(m.currentLeft), m.minLeft, m.maxLeft)
      setClips(prev => ({
        ...prev,
        [m.trackId]: prev[m.trackId].map(c => (c.id === m.clipId ? { ...c, left: snapped } : c)),
      }))
      if (selectedRef.current?.id === m.clipId) {
        setSelectedClip({ ...selectedRef.current, startSec: (snapped / 100) * TIMELINE_SECONDS })
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

  function beginClipDrag(e: ReactMouseEvent<HTMLDivElement>, trackId: string, clip: Clip) {
    e.stopPropagation()
    setSelectedClip(describe(trackId, clip))
    const lane = e.currentTarget.parentElement
    if (!lane) return
    const others = (clips[trackId] ?? []).filter(c => c.id !== clip.id)
    const { min, max } = moveBounds(others, clip)
    moveRef.current = {
      trackId,
      clipId: clip.id,
      startX: e.clientX,
      laneWidth: lane.getBoundingClientRect().width,
      originLeft: clip.left,
      currentLeft: clip.left,
      minLeft: min,
      maxLeft: max,
      moved: false,
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

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
    selectNone,
    onTrackDragOver,
    onTrackDragLeave,
    onTrackDrop,
  }
}
