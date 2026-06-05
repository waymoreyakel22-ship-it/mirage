import { useState } from 'react'
import { CLIPS, RULER_MARKS, TOOLS, TRACKS } from '../data/timeline'
import type { Tool } from '../types'
import './Timeline.css'

const PLAYHEAD = '28%'

export function Timeline() {
  const [activeTool, setActiveTool] = useState<Tool>('select')

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
            {TRACKS.map(tr => (
              <div key={tr.id} className="track-lane">
                {(CLIPS[tr.id] ?? []).map(clip => (
                  <div
                    key={clip.label + clip.left}
                    className="clip"
                    style={{
                      left: `${clip.left}%`,
                      width: `${clip.width}%`,
                      borderLeftColor: tr.color,
                      background: `${tr.color}18`,
                    }}
                  >
                    <span className="clip-label">{clip.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
