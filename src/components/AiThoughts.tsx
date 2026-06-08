import { useAi } from '../context/AiContext'
import './AiThoughts.css'

const LINES = ['Analyzing clip structure', 'Detecting cut points', 'Generating suggestions']

export function AiThoughts() {
  const { analyzing, step, done, dismiss } = useAi()

  return (
    <div className={`ai-thoughts${analyzing ? ' visible' : ''}`} aria-hidden={!analyzing}>
      <div className="ai-header">
        <span>{done ? 'Analysis complete' : 'AI is thinking'}</span>
        <button className="ai-dismiss" onClick={dismiss}>✕</button>
      </div>
      <div className="ai-log">
        {LINES.map((line, i) => {
          const cls = done || i < step ? 'log-done' : i === step ? 'log-active' : 'log-pending'
          return (
            <div key={line} className={`log-line ${cls}`}>
              {line}{cls === 'log-active' ? '…' : ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}
