import { useState } from 'react'
import { CLIP_META, FP_STATS, STYLE_PATTERNS, SUGGESTIONS } from '../data/inspector'
import type { RightTab } from '../types'
import './Inspector.css'

const TABS: RightTab[] = ['suggestions', 'style', 'clip']
const tabLabel = (t: RightTab) =>
  t === 'clip' ? 'Clip info' : t.charAt(0).toUpperCase() + t.slice(1)

export function Inspector() {
  const [tab, setTab] = useState<RightTab>('suggestions')

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

            <p className="section-label" style={{ marginTop: 18 }}>Suggestions</p>
            <div className="suggestion-list">
              {SUGGESTIONS.map(s => (
                <div key={s.title} className="suggestion-card">
                  <div className="sug-title">{s.title}</div>
                  <div className="sug-desc">{s.desc}</div>
                  <div className="sug-time">{s.time}</div>
                </div>
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
            <div className="meta-rows">
              {CLIP_META.map(([k, v]) => (
                <div key={k} className="meta-row">
                  <span className="meta-key">{k}</span>
                  <span className="meta-val">{v}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
