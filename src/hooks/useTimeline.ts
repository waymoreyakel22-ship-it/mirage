import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent } from 'react'
import { CLIPS, RULER_MARKS, TRACKS } from '../data/timeline'
import { clamp, parseClockToSeconds } from '../lib/format'
import { useSelection, type SelectedClip } from '../context/SelectionContext'
import type { Asset, Clip } from '../types'

const TIMELINE_SECONDS = parseClockToSeconds(RULER_MARKS[RULER_MARKS.length - 1])
const DEFAULT_CLIP_SECONDS = 4
const MIRAGE_PREFIX = 'application/x-mirage-'

export type DropTarget = { id: string; valid: boolean } | null

function initClips(): Record<string, Clip[]> {
  const out: Record<string, Clip[]> = {}
  for (const id in CLIPS) out[id] = CLIPS[id].map(c => ({ id: crypto.randomUUID(), ...c }))
  return out
}

function draggedKind(types: readonly string[]): string | null {
  const marker = types.find(t => t.startsWith(MIRAGE_PREFIX))
  return marker ? marker.slice(MIRAGE_PREFIX.length) : null
}

const snapPctToSecond = (pct: number) => {
  const sec = clamp(Math.round((pct / 100) * TIMELINE_SECONDS), 0, TIMELINE_SECONDS)
  return (sec / TIMELINE_SECONDS) * 100
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
    width: number
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
      const left = clamp(m.originLeft + deltaPct, 0, 100 - m.width)
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
      const snapped = clamp(snapPctToSecond(m.currentLeft), 0, 100 - m.width)
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

  // A drop outside any lane (or a cancelled drag) still needs the highlight cleared.
  useEffect(() => {
    const clear = () => setDropTarget(null)
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
    moveRef.current = {
      trackId,
      clipId: clip.id,
      startX: e.clientX,
      laneWidth: lane.getBoundingClientRect().width,
      originLeft: clip.left,
      currentLeft: clip.left,
      width: clip.width,
      moved: false,
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  const selectNone = () => setSelectedClip(null)

  function onTrackDragOver(e: ReactDragEvent<HTMLDivElement>, accepts: string, id: string) {
    const kind = draggedKind(e.dataTransfer.types)
    if (!kind) return
    const valid = kind === accepts
    if (valid) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    } else {
      e.dataTransfer.dropEffect = 'none'
    }
    setDropTarget(prev => (prev?.id === id && prev.valid === valid ? prev : { id, valid }))
  }

  function onTrackDragLeave(e: ReactDragEvent<HTMLDivElement>, id: string) {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDropTarget(prev => (prev?.id === id ? null : prev))
  }

  function onTrackDrop(e: ReactDragEvent<HTMLDivElement>, accepts: string, id: string) {
    e.preventDefault()
    setDropTarget(null)
    const raw = e.dataTransfer.getData('application/json')
    if (!raw) return
    let asset: Asset
    try {
      asset = JSON.parse(raw)
    } catch {
      return
    }
    if (asset.kind !== accepts) return

    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const startSec = clamp(Math.round(ratio * TIMELINE_SECONDS), 0, TIMELINE_SECONDS)
    const duration = parseClockToSeconds(asset.sub)
    const widthSec = clamp(
      Number.isNaN(duration) ? DEFAULT_CLIP_SECONDS : duration,
      1,
      Math.max(1, TIMELINE_SECONDS - startSec),
    )
    const clip: Clip = {
      id: crypto.randomUUID(),
      left: (startSec / TIMELINE_SECONDS) * 100,
      width: (widthSec / TIMELINE_SECONDS) * 100,
      label: asset.name,
    }
    setClips(prev => ({ ...prev, [id]: [...(prev[id] ?? []), clip] }))
    setSelectedClip(describe(id, clip))
  }

  return {
    clips,
    dropTarget,
    selectedId: selectedClip?.id ?? null,
    beginClipDrag,
    selectNone,
    onTrackDragOver,
    onTrackDragLeave,
    onTrackDrop,
  }
}
