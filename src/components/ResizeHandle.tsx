import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import './ResizeHandle.css'

type Props = {
  orientation: 'col' | 'row'
  side?: 'right'
  style?: CSSProperties
  onMouseDown: (e: ReactMouseEvent) => void
}

export function ResizeHandle({ orientation, side, style, onMouseDown }: Props) {
  const className = orientation === 'col'
    ? `resize-col${side === 'right' ? ' resize-col-right' : ''}`
    : 'resize-row'
  return <div className={className} style={style} onMouseDown={onMouseDown} />
}
