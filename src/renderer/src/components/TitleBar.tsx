import type { FormEvent, JSX, RefObject } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Command,
  Copy,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Square,
  X
} from 'lucide-react'
import { BrandMark } from './BrandMark'

export interface TitleBarProps {
  collapsed: boolean
  onToggleSidebar: () => void
  searchRef: RefObject<HTMLInputElement | null>
  searchTerm: string
  onSearchTermChange: (value: string) => void
  onSearchSubmit: (term: string) => void
  canGoBack: boolean
  canGoForward: boolean
  onBack: () => void
  onForward: () => void
  online: boolean
  loading: boolean
  maximized: boolean
  onOpenPalette: () => void
  onOpenSettings: () => void
  onConnectionClick: () => void
}

export function TitleBar({
  collapsed,
  onToggleSidebar,
  searchRef,
  searchTerm,
  onSearchTermChange,
  onSearchSubmit,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  online,
  loading,
  maximized,
  onOpenPalette,
  onOpenSettings,
  onConnectionClick
}: TitleBarProps): JSX.Element {
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    onSearchSubmit(searchTerm)
  }

  return (
    <header className="titlebar">
      <div className="titlebar-brand">
        <BrandMark />
        <div className="brand-type">
          <strong>Cloudwave</strong>
          <span>SoundCloud shell</span>
        </div>
      </div>

      <div className="titlebar-center">
        <button
          type="button"
          className="icon-btn"
          onClick={onToggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-pressed={collapsed}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>

        <div className="nav-cluster">
          <button
            type="button"
            className="icon-btn"
            onClick={onBack}
            disabled={!canGoBack}
            title="Back (Alt + ←)"
            aria-label="Back"
          >
            <ArrowLeft />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onForward}
            disabled={!canGoForward}
            title="Forward (Alt + →)"
            aria-label="Forward"
          >
            <ArrowRight />
          </button>
        </div>

        <form className="search" role="search" onSubmit={submit}>
          <Search aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Search SoundCloud"
            aria-label="Search SoundCloud"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="kbd" aria-hidden="true">
            Ctrl K
          </kbd>
        </form>
      </div>

      <div className="titlebar-right">
        <button
          type="button"
          className={`connection-pill ${loading ? 'is-loading' : ''}`.trim()}
          onClick={onConnectionClick}
          title={online ? 'Connected to soundcloud.com' : 'You appear to be offline'}
        >
          <span className={`status-dot ${online ? '' : 'is-offline'}`.trim()} aria-hidden="true" />
          <span>{online ? 'SoundCloud' : 'Offline'}</span>
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onOpenPalette}
          title="Command palette (Ctrl K)"
          aria-label="Command palette"
        >
          <Command />
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={onOpenSettings}
          title="Settings (Ctrl ,)"
          aria-label="Settings"
        >
          <Settings2 />
        </button>

        <div className="window-controls">
          <button
            type="button"
            className="window-btn"
            onClick={() => window.desktop?.window.minimize()}
            title="Minimize"
            aria-label="Minimize window"
          >
            <Minus />
          </button>
          <button
            type="button"
            className="window-btn"
            onClick={() => window.desktop?.window.maximize()}
            title={maximized ? 'Restore' : 'Maximize'}
            aria-label={maximized ? 'Restore window' : 'Maximize window'}
          >
            {maximized ? <Copy /> : <Square />}
          </button>
          <button
            type="button"
            className="window-btn is-close"
            onClick={() => window.desktop?.window.close()}
            title="Close"
            aria-label="Close window"
          >
            <X />
          </button>
        </div>
      </div>
    </header>
  )
}
