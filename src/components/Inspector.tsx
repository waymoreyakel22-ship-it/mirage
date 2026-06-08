import { useState } from 'react'
import { FP_STATS, STYLE_PATTERNS, SUGGESTIONS } from '../data/inspector'
import { useSelection } from '../context/SelectionContext'
import { usePlayback } from '../context/PlaybackContext'
import { useAi } from '../context/AiContext'
import { clamp, formatTimecode, parseClockToSeconds } from '../lib/format'
import type { RightTab } from '../types'
import './Inspector.css'

const TABS: RightTab[] = ['suggestions', 'style', 'clip']
const tabLabel = (t: RightTab) =>
  t === 'clip' ? 'Clip info' : t.charAt(0).toUpperCase() + t.slice(1)

export function Inspector() {
  const [tab, setTab] = useState<RightTab>('suggestions')
  const { selectedClip } = useSelection()
  const { setPlayheadSec, durationSec } = usePlayback()
  const ai = useAi()

  // Jump the playhead to a suggestion's timecode (clamped to the timeline).
  const seekTo = (time: string) => {
    const sec = parseClockToSeconds(time)
    if (!Number.isNaN(sec)) setPlayheadSec(clamp(sec, 0, durationSec))
  }

  const clipRows: [string, string][] = selectedClip
    ? [
        ['File', selectedClip.name],
        ['Track', selectedClip.trackLabel],
        ['Type', selectedClip.kind],
        ['In', formatTimecode(selectedClip.startSec)],
        ['Duration', formatTimecode(selectedClip.durationSec)],
      ]
    : []

  return (
    <aside className="right-panel">
      <div className="right-tabs">
        {TABS.map(t => (
          <button
            key={t}
            className={`right-tab${tab === t ? ' active' : ''}`}
            onClick={() => setTab(t)}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      <div className="right-content">
        {tab === 'suggestions' && (
          <>
            <p className="section-label">Editing fingerprint</p>
            <div className="fp-stats">
              {FP_STATS.map(s => (
                <div key={s.label} className="fp-row">
                  <span className="fp-label">{s.label}</span>
                  <div className="fp-bar">
                    <div className="fp-fill" style={{ width: `${s.value}%` }} />
                  </div>
                  <span className="fp-value">{s.display}</span>
                </div>
              ))}
            </div>

            <div className="sug-head">
              <p className="section-label">Suggestions</p>
              <button className="ai-analyze" onClick={ai.analyze} disabled={ai.analyzing}>
                {ai.analyzing ? 'Analyzing…' : 'Analyze'}
              </button>
            </div>
            <div className="suggestion-list">
              {SUGGESTIONS.map(s => (
                <button key={s.title} className="suggestion-card" onClick={() => seekTo(s.time)}>
                  <div className="sug-title">{s.title}</div>
                  <div className="sug-desc">{s.desc}</div>
                  <div className="sug-time">{s.time}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === 'style' && (
          <>
            <p className="section-label">Channel patterns</p>
            <div className="style-rows">
              {STYLE_PATTERNS.map(p => (
                <div key={p.label} className="style-row">
                  <span className="style-label">{p.label}</span>
                  <div className="style-bar">
                    <div className="style-fill" style={{ width: `${p.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'clip' && (
          <>
            <p className="section-label">Clip info</p>
            {selectedClip ? (
              <div className="meta-rows">
                {clipRows.map(([k, v]) => (
                  <div key={k} className="meta-row">
                    <span className="meta-key">{k}</span>
                    <span className="meta-val">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="inspector-empty">No clip selected</div>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
