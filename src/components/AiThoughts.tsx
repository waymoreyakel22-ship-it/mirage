import './AiThoughts.css'

export function AiThoughts() {
  return (
    <div className="ai-thoughts" aria-hidden="true">
      <div className="ai-header">
        <span>AI is thinking</span>
        <button className="ai-dismiss">✕</button>
      </div>
      <div className="ai-log">
        <div className="log-line log-done">Analyzing clip structure</div>
        <div className="log-line log-active">Detecting cut points…</div>
        <div className="log-line log-pending">Generating suggestions</div>
      </div>
    </div>
  )
}
