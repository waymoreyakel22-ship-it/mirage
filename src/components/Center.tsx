import { useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react'
import { AiThoughts } from './AiThoughts'
import { PreviewPlayer } from './PreviewPlayer'
import { ResizeHandle } from './ResizeHandle'
import { Timeline } from './Timeline'
import type { CenterMode } from '../types'
import './Center.css'

const MODES: CenterMode[] = ['timeline', 'ai-editor', 'color', 'audio']
const modeLabel = (m: CenterMode) =>
  m === 'ai-editor' ? 'AI editor' : m.charAt(0).toUpperCase() + m.slice(1)

type Props = {
  previewH: number
  onPreviewResize: (e: ReactMouseEvent) => void
  centerRef: RefObject<HTMLDivElement | null>
  tabbarRef: RefObject<HTMLDivElement | null>
}

export function Center({ previewH, onPreviewResize, centerRef, tabbarRef }: Props) {
  const [mode, setMode] = useState<CenterMode>('timeline')

  return (
    <div className="center" ref={centerRef}>
      <PreviewPlayer height={previewH} />
      <ResizeHandle orientation="row" onMouseDown={onPreviewResize} />

      <div className="timeline-section">
        {mode === 'timeline'
          ? <Timeline />
          : <div className="alt-panel"><span className="alt-label">{modeLabel(mode)}</span></div>}
        <AiThoughts />
      </div>

      <div className="mode-tabbar" ref={tabbarRef}>
        {MODES.map(m => (
          <button
            key={m}
            className={`mode-tab${mode === m ? ' active' : ''}`}
            onClick={() => setMode(m)}
          >
            {modeLabel(m)}
          </button>
        ))}
      </div>
    </div>
  )
}
