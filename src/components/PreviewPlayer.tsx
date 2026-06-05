import './PreviewPlayer.css'

export function PreviewPlayer({ height }: { height: number }) {
  return (
    <div className="preview-panel" style={{ height, flex: '0 0 auto' }}>
      <div className="preview-toolbar">
        <button className="tbtn" title="Skip to start">⏮</button>
        <button className="tbtn" title="Rewind">⏪</button>
        <button className="tbtn tbtn-play" title="Play">▶</button>
        <button className="tbtn" title="Fast forward">⏩</button>
        <button className="tbtn" title="Skip to end">⏭</button>
        <span className="flex-spacer" />
        <span className="timecode">0:00:00:00</span>
      </div>
      <div className="video-screen">
        <div className="video-inner">
          <span className="video-empty">No clip loaded</span>
        </div>
      </div>
    </div>
  )
}
