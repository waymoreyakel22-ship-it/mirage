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

  // Horizontal zoom: widen the ruler + lanes (clip %s stay valid). 1 = fit.
  const [zoom, setZoom] = useState(1)
  const zoomIn = () => setZoom(z => Math.min(z * 1.5, 8))
  const zoomOut = () => setZoom(z => Math.max(z / 1.5, 1))
  const scaleStyle = { width: `${zoom * 100}%` }

  function toolProps(id: string) {
    if (id === 'magnet') return { active: tl.snapEnabled, onClick: tl.toggleSnap }
    if (id === 'zoom-in') return { active: false, onClick: zoomIn }
    if (id === 'zoom-out') return { active: false, onClick: zoomOut }
    return { active: tl.activeTool === id, onClick: () => tl.setActiveTool(id as typeof tl.activeTool) }
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
        {TOOLS.map(t => {
          const { active, onClick } = toolProps(t.id)
          return (
            <button
              key={t.id}
              className={`tool-btn${active ? ' active' : ''}`}
              title={t.id === 'magnet' ? `Snapping ${tl.snapEnabled ? 'on' : 'off'}` : t.label}
              onClick={onClick}
            >
              {t.glyph}
            </button>
          )
        })}
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
          <div className="ruler" onMouseDown={beginScrub} style={scaleStyle}>
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
            style={scaleStyle}
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
