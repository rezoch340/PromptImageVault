import { ChevronDown, Menu, RefreshCw } from 'lucide-react'
import type { SortKey } from '../types'
import { IconButton } from './common/IconButton'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'filename', label: 'Filename' },
  { value: 'resolution', label: 'Resolution' },
  { value: 'file_size', label: 'File size' },
  { value: 'seed', label: 'Seed' },
  { value: 'model', label: 'Model' },
  { value: 'sampler', label: 'Sampler' },
  { value: 'steps', label: 'Steps' },
  { value: 'cfg', label: 'CFG' },
]

interface HeaderProps {
  total: number
  sort: SortKey
  scanning: boolean
  onSort: (value: SortKey) => void
  onRefresh: () => void
  onMenu: () => void
}

export function Header({ total, sort, scanning, onSort, onRefresh, onMenu }: HeaderProps) {
  return (
    <header className="application-header">
      <IconButton accessibleLabel="Open menu" className="mobile-menu" onClick={onMenu}>
        <Menu size={20} />
      </IconButton>
      <div className="heading-group">
        <p>YOUR COLLECTION</p>
        <h1>All images <span>{total.toLocaleString()}</span></h1>
      </div>
      <div className="header-actions">
        <IconButton accessibleLabel="Refresh images" className="refresh-button" onClick={onRefresh}>
          <RefreshCw size={17} className={scanning ? 'spin' : ''} />
        </IconButton>
        <label className="sort-control">
          <span>Sort by</span>
          <select value={sort} onChange={(event) => onSort(event.target.value as SortKey)}>
            {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <ChevronDown size={15} />
        </label>
      </div>
    </header>
  )
}
