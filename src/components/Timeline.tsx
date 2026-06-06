import { useState } from 'react'
import { RULER_MARKS, TOOLS, TRACKS } from '../data/timeline'
import { useTimeline } from '../hooks/useTimeline'
import type { Tool } from '../types'
import './Timeline.css'

const PLAYHEAD = '28%'

export function Timeline() {
  const [activeTool, setActiveTool] = useState<Tool>('select')
  const tl = useTimeline()

  return (
    <>
      <div className="timeline-toolbar">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`tool-btn${activeTool === t.id ? ' active' : ''}`}
            title={t.label}
            onClick={() => setActiveTool(t.id)}
          >
            {t.glyph}
          </button>
        ))}
        <span className="flex-spacer" />
        <span className="timecode">0:00:30:00</span>
      </div>

      <div className="track-area">
        <div className="track-headers">
          <div className="ruler-corner" />
          {TRACKS.map(tr => (
            <div key={tr.id} className="track-header">
              <span className="track-label" style={{ color: tr.color }}>{tr.label}</span>
            </div>
          ))}
        </div>

        <div className="tracks-scroll">
          <div className="ruler">
            {RULER_MARKS.map((mark, i) => (
              <div
                key={mark}
                className="ruler-tick"
                style={{ left: `${(i / (RULER_MARKS.length - 1)) * 100}%` }}
              >
                <span className="ruler-label">{mark}</span>
              </div>
            ))}
            <div className="playhead-diamond" style={{ left: PLAYHEAD }} />
          </div>

          <div className="track-lanes">
            <div className="playhead-line" style={{ left: PLAYHEAD }} />
            {TRACKS.map(tr => {
              const active = tl.dropTarget?.id === tr.id ? tl.dropTarget : null
              const state = active ? (active.valid ? ' drop-valid' : ' drop-invalid') : ''
              return (
                <div
                  key={tr.id}
                  className={`track-lane${state}`}
                  onMouseDown={e => { if (e.target === e.currentTarget) tl.selectNone() }}
                  onDragOver={e => tl.onTrackDragOver(e, tr.accepts, tr.id)}
                  onDragLeave={e => tl.onTrackDragLeave(e, tr.id)}
                  onDrop={e => tl.onTrackDrop(e, tr.accepts, tr.id)}
                >
                  {tl.ghost?.trackId === tr.id && (
                    <div
                      className={`clip-ghost${tl.ghost.fits ? '' : ' no-fit'}`}
                      style={{ left: `${tl.ghost.left}%`, width: `${tl.ghost.width}%` }}
                    />
                  )}
                  {(tl.clips[tr.id] ?? []).map(clip => (
                    <div
                      key={clip.id}
                      className={`clip${tl.selectedId === clip.id ? ' selected' : ''}`}
                      style={{
                        left: `${clip.left}%`,
                        width: `${clip.width}%`,
                        borderLeftColor: tr.color,
                        background: `${tr.color}18`,
                      }}
                      onMouseDown={e => tl.beginClipDrag(e, tr.id, clip)}
                    >
                      <div
                        className="clip-handle left"
                        onMouseDown={e => tl.beginClipResize(e, tr.id, clip, 'l')}
                      />
                      <span className="clip-label">{clip.label}</span>
                      <div
                        className="clip-handle right"
                        onMouseDown={e => tl.beginClipResize(e, tr.id, clip, 'r')}
                      />
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
