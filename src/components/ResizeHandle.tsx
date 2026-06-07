import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import './ResizeHandle.css'

type Props = {
  orientation: 'col' | 'row'
  side?: 'right'
  style?: CSSProperties
  onMouseDown: (e: ReactMouseEvent) => void
}

// Drag-affordance grip: two bars flanked by chevrons. Drawn vertically (for the
// row seam you drag up/down); rotated 90° via CSS for the col seams.
function Grip() {
  return (
    <svg
      className="grip-icon"
      viewBox="0 0 20 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 7 L10 3.5 L14 7" />
      <line x1="4.5" y1="12" x2="15.5" y2="12" />
      <line x1="4.5" y1="16.5" x2="15.5" y2="16.5" />
      <path d="M6 21 L10 24.5 L14 21" />
    </svg>
  )
}

export function ResizeHandle({ orientation, side, style, onMouseDown }: Props) {
  const className = orientation === 'col'
    ? `resize-col${side === 'right' ? ' resize-col-right' : ''}`
    : 'resize-row'
  return (
    <div className={className} style={style} onMouseDown={onMouseDown}>
      <span className="resize-grip"><Grip /></span>
    </div>
  )
}
