import './PreviewPlayer.css'

export function PreviewPlayer({ height }: { height: number }) {
  return (
    <div className="preview-panel" style={{ height, flex: '0 0 auto' }}>
      <div className="preview-toolbar">
        <span className="timecode">0:00:00:00</span>
      </div>

      <div className="video-screen">
        <div className="video-inner">
          <span className="video-empty">No clip loaded</span>
        </div>
      </div>

      <div className="transport">
        <button className="transport-btn" title="Skip to start"><IconSkipBack /></button>
        <button className="transport-btn" title="Rewind"><IconRewind /></button>
        <button className="transport-btn transport-play" title="Play"><IconPlay /></button>
        <button className="transport-btn" title="Fast forward"><IconForward /></button>
        <button className="transport-btn" title="Skip to end"><IconSkipForward /></button>
      </div>
    </div>
  )
}

function IconSkipBack() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="2" height="12" />
      <path d="M19 6 L19 18 L9 12 Z" />
    </svg>
  )
}

function IconRewind() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12 L21 6 L21 18 Z" />
      <path d="M3 12 L12 6 L12 18 Z" />
    </svg>
  )
}

function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5 L19 12 L8 19 Z" />
    </svg>
  )
}

function IconForward() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 6 L12 12 L3 18 Z" />
      <path d="M12 6 L21 12 L12 18 Z" />
    </svg>
  )
}

function IconSkipForward() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 6 L5 18 L15 12 Z" />
      <rect x="16" y="6" width="2" height="12" />
    </svg>
  )
}
