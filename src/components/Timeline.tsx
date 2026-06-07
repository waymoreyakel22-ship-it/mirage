import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import { FPS, RULER_MARKS, TOOLS, TRACKS } from '../data/timeline'
import { useTimeline } from '../hooks/useTimeline'
import { usePlayback } from '../context/PlaybackContext'
import { clamp, formatTimecodeFrames } from '../lib/format'
import './Timeline.css'

export function Timeline() {
  const tl = useTimeline()
  const { playheadSec, setPlayheadSec, durationSec } = usePlayback()
  const playhead = `${(playheadSec / durationSec) * 100}%`
  const cutMode = tl.activeTool === 'razor' || tl.activeTool === 'cut'

  // Frame-snapped dotted line that follows the cursor while the razor is active.
  const [cutX, setCutX] = useState<number | null>(null)
  const totalFrames = durationSec * FPS
  function onLanesMove(e: ReactMouseEvent) {
    if (!cutMode) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = ((e.clientX - rect.left) / rect.width) * 100
    setCutX((Math.round((pct / 100) * totalFrames) / totalFrames) * 100)
  }

  // Click or drag anywhere on the ruler to scrub the playhead.
  function beginScrub(e: ReactMouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect()
    const toSec = (x: number) => clamp(((x - rect.left) / rect.width) * durationSec, 0, durationSec)
    setPlayheadSec(toSec(e.clientX))
    const move = (ev: MouseEvent) => setPlayheadSec(toSec(ev.clientX))
    const up = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  return (
    <>
      <div className="timeline-toolbar">
        {TOOLS.map(t => (
          <button
            key={t.id}
            className={`tool-btn${tl.activeTool === t.id ? ' active' : ''}`}
            title={t.label}
            onClick={() => tl.setActiveTool(t.id)}
          >
            {t.glyph}
          </button>
        ))}
        <span className="flex-spacer" />
        <span className="timecode">{formatTimecodeFrames(playheadSec)}</span>
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
          <div className="ruler" onMouseDown={beginScrub}>
            {RULER_MARKS.map((mark, i) => (
              <div
                key={mark}
                className="ruler-tick"
                style={{ left: `${(i / (RULER_MARKS.length - 1)) * 100}%` }}
              >
                <span className="ruler-label">{mark}</span>
              </div>
            ))}
            <div className="playhead-diamond" style={{ left: playhead }} />
          </div>

          <div
            className={`track-lanes${cutMode ? ' cut-mode' : ''}`}
            onMouseMove={onLanesMove}
            onMouseLeave={() => setCutX(null)}
          >
            <div className="playhead-line" style={{ left: playhead }} />
            {cutMode && cutX !== null && <div className="cut-cursor" style={{ left: `${cutX}%` }} />}
            {tl.moveOrigin &&
              [tl.moveOrigin.left, tl.moveOrigin.left + tl.moveOrigin.width].map((x, i) => (
                <div key={`origin-${i}`} className="align-guide origin" style={{ left: `${x}%` }} />
              ))}
            {tl.guides.map((x, i) => (
              <div key={i} className="align-guide" style={{ left: `${x}%` }} />
            ))}
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
                  {tl.moveOrigin?.trackId === tr.id && (
                    <div
                      className="clip-origin"
                      style={{ left: `${tl.moveOrigin.left}%`, width: `${tl.moveOrigin.width}%` }}
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
                      onMouseDown={e =>
                        cutMode ? tl.razorAt(e, tr.id, clip) : tl.beginClipDrag(e, tr.id, clip)
                      }
                    >
                      <div
                        className="clip-handle left"
                        onMouseDown={e =>
                          cutMode ? tl.razorAt(e, tr.id, clip) : tl.beginClipResize(e, tr.id, clip, 'l')
                        }
                      />
                      <span className="clip-label">{clip.label}</span>
                      <div
                        className="clip-handle right"
                        onMouseDown={e =>
                          cutMode ? tl.razorAt(e, tr.id, clip) : tl.beginClipResize(e, tr.id, clip, 'r')
                        }
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
