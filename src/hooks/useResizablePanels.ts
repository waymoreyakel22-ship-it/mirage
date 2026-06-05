import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import { clamp } from '../lib/format'

type DragKind = 'sidebar' | 'right' | 'preview'

const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 320
const RIGHT_MIN = 180
const RIGHT_MAX = 340
const PREVIEW_MIN = 120
const TIMELINE_MIN = 150
const HANDLE = 4

/**
 * Pointer-driven sizing for the three workspace seams. Sizes live in state;
 * the active drag is tracked in a ref so document listeners stay stable.
 * The preview ceiling is derived from live element heights so the timeline
 * can never be squeezed below TIMELINE_MIN.
 */
export function useResizablePanels(
  centerRef: RefObject<HTMLDivElement | null>,
  tabbarRef: RefObject<HTMLDivElement | null>,
) {
  const [sidebarW, setSidebarW] = useState(188)
  const [rightW, setRightW]     = useState(224)
  const [previewH, setPreviewH] = useState(() => Math.round(window.innerHeight * 0.22))
  const dragRef = useRef<{ kind: DragKind; startPos: number; startSize: number } | null>(null)

  useEffect(() => {
    function move(e: MouseEvent) {
      const d = dragRef.current
      if (!d) return
      if (d.kind === 'sidebar') {
        setSidebarW(clamp(d.startSize + (e.clientX - d.startPos), SIDEBAR_MIN, SIDEBAR_MAX))
      } else if (d.kind === 'right') {
        setRightW(clamp(d.startSize - (e.clientX - d.startPos), RIGHT_MIN, RIGHT_MAX))
      } else {
        const center = centerRef.current
        const tabbar = tabbarRef.current
        const max = center && tabbar
          ? center.clientHeight - tabbar.clientHeight - HANDLE - TIMELINE_MIN
          : Infinity
        setPreviewH(clamp(d.startSize + (e.clientY - d.startPos), PREVIEW_MIN, Math.max(PREVIEW_MIN, max)))
      }
    }
    function up() {
      if (!dragRef.current) return
      dragRef.current = null
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
    return () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
  }, [centerRef, tabbarRef])

  function startDrag(kind: DragKind, e: ReactMouseEvent) {
    e.preventDefault()
    const startSize = kind === 'sidebar' ? sidebarW : kind === 'right' ? rightW : previewH
    dragRef.current = { kind, startPos: kind === 'preview' ? e.clientY : e.clientX, startSize }
    document.body.style.cursor = kind === 'preview' ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return { sidebarW, rightW, previewH, startDrag }
}
