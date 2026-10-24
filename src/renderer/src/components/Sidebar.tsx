import { LogIn, PanelLeftClose, PanelLeftOpen, Settings2, UserRound } from 'lucide-react'
import type { JSX } from 'react'
import type { SiteSession } from '@shared/types'
import { DESTINATIONS, NAV_GROUPS } from '@/lib/destinations'
import type { RecentTrack } from '@/hooks/useRecents'
import { CoverArt } from './CoverArt'

export interface SidebarProps {
  activeNav: string
  collapsed: boolean
  recents: RecentTrack[]
  showRecents: boolean
  version: string
  session: SiteSession
  onNavigate: (id: string) => void
  onOpenTrack: (track: RecentTrack) => void
  onSignIn: () => void
  onOpenProfile: () => void
  onToggleCollapsed: () => void
  onOpenSettings: () => void
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return 'CW'
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * Primary navigation. The sidebar mirrors SoundCloud's own sections but keeps
 * the labels and ordering in the shell's voice, so the app reads as one product
 * rather than a website in a frame.
 */
export function Sidebar({
  activeNav,
  collapsed,
  recents,
  showRecents,
  version,
  session,
  onNavigate,
  onOpenTrack,
  onSignIn,
  onOpenProfile,
  onToggleCollapsed,
  onOpenSettings
}: SidebarProps): JSX.Element {
  const signedIn = session.status === 'signed-in'
  const accountName = signedIn
    ? session.userName || 'SoundCloud listener'
    : session.status === 'signed-out'
      ? 'Guest listener'
      : 'SoundCloud'
  const accountHint = signedIn
    ? 'Open your profile'
    : session.status === 'signed-out'
      ? 'Sign in to SoundCloud'
      : 'Checking session…'

  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="sidebar-scroll">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.ids.map((id) => {
              const destination = DESTINATIONS.find((item) => item.id === id)
              if (!destination) return null
              const Icon = destination.icon
              const active = activeNav === id

              return (
                <button
                  key={id}
                  type="button"
                  className="nav-item"
                  data-destination={id}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(id)}
                  title={collapsed ? destination.label : destination.hint}
                >
                  <Icon aria-hidden="true" />
                  <span className="nav-text">{destination.label}</span>
                </button>
              )
            })}
          </div>
        ))}

        {showRecents && recents.length > 0 ? (
          <div className="sidebar-recents">
            <div className="nav-label">Recently played</div>
            {recents.slice(0, 5).map((track) => (
              <button
                key={`${track.url}|${track.title}`}
                type="button"
                className="nav-item"
                onClick={() => onOpenTrack(track)}
                title={`${track.title}${track.artist ? ` — ${track.artist}` : ''}`}
              >
                <CoverArt
                  seed={track.title}
                  artwork={track.artwork}
                  label={track.title}
                  className="nav-cover"
                  glyphSize={8}
                />
                <span className="nav-text">{track.title}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="sidebar-footer">
        <button
          type="button"
          className="user-card"
          onClick={signedIn ? onOpenProfile : onSignIn}
          title={accountHint}
        >
          <span className={`user-avatar${session.avatar ? ' has-image' : ''}`} aria-hidden="true">
            {session.avatar ? (
              <img src={session.avatar} alt="" draggable={false} />
            ) : signedIn ? (
              initialsOf(accountName)
            ) : session.status === 'signed-out' ? (
              <LogIn />
            ) : (
              <UserRound />
            )}
          </span>
          <span className="user-meta">
            <strong>{accountName}</strong>
            <span>{accountHint}</span>
          </span>
        </button>

        <div className="sidebar-tools">
          <span className="sidebar-version">v{version}</span>
          <div className="sidebar-tool-actions">
            <button
              type="button"
              className="icon-btn"
              onClick={onOpenSettings}
              title="Open settings"
              aria-label="Open settings"
            >
              <Settings2 />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onToggleCollapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-pressed={collapsed}
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
