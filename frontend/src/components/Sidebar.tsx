import { FolderOpen, Images, Search, Settings2, Sparkles } from 'lucide-react'

interface SidebarProps {
  total: number
  scanning: boolean
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ total, scanning, mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      <button className={`sidebar-scrim ${mobileOpen ? 'visible' : ''}`} onClick={onClose} aria-label="Close menu" />
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark"><Sparkles size={17} strokeWidth={1.8} /></span>
          <div>
            <strong>Prompt</strong>
            <span>IMAGE VAULT</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Library navigation">
          <p className="nav-label">LIBRARY</p>
          <button className="nav-item active" type="button">
            <Images size={17} />
            <span>All images</span>
            <em>{total}</em>
          </button>
          <button className="nav-item disabled" type="button" disabled title="Coming in v0.2">
            <Search size={17} />
            <span>Prompt search</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="source-card">
          <div className="source-icon"><FolderOpen size={17} /></div>
          <div>
            <strong>Local library</strong>
            <span>/library</span>
          </div>
          <i className={scanning ? 'status-dot scanning' : 'status-dot'} />
        </div>
        <button className="settings-link" type="button" disabled>
          <Settings2 size={16} /> Settings
        </button>
        <p className="version">LOCAL-FIRST · V0.1</p>
      </aside>
    </>
  )
}
