import { MediaBin } from './MediaBin'
import './Sidebar.css'

const NAV = ['Editor', 'Auto-edit', 'Fingerprint', 'Settings'] as const

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo-wordmark">Mirage</span>
      </div>

      <nav className="nav">
        {NAV.map(label => (
          <button key={label} className={`nav-link${label === 'Editor' ? ' active' : ''}`}>
            {label}
          </button>
        ))}
      </nav>

      <MediaBin />
    </aside>
  )
}
