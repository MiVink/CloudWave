import {
  ArrowRight,
  Cloud,
  Command,
  Compass,
  Disc3,
  Heart,
  Info,
  Keyboard,
  LogIn,
  Maximize2,
  Radio,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UploadCloud,
  type LucideIcon
} from 'lucide-react'
import type { JSX } from 'react'
import type { PlayerSnapshot, Settings, SiteSession } from '@shared/types'
import type { RecentTrack } from '@/hooks/useRecents'
import { coverStyle } from '@/lib/covers'
import { destinationById } from '@/lib/destinations'
import { greeting, prettyDate } from '@/lib/format'
import { BrandMark } from './BrandMark'
import { CoverArt } from './CoverArt'

const START_IDS = ['discover', 'feed', 'charts', 'likes', 'library', 'playlists']

interface BrowseEntry {
  id: string
  title: string
  copy: string
  icon: LucideIcon
}

const BROWSE: BrowseEntry[] = [
  { id: 'charts', title: 'Charts', copy: 'What the world is playing', icon: TrendingUp },
  { id: 'feed', title: 'Your feed', copy: 'Fresh from people you follow', icon: Radio },
  { id: 'likes', title: 'Liked tracks', copy: 'The ones you kept', icon: Heart },
  { id: 'upload', title: 'Upload', copy: 'Share something new', icon: UploadCloud }
]

const SHORTCUTS: { icon: LucideIcon; label: string; keys: string[] }[] = [
  { icon: Command, label: 'Command palette', keys: ['Ctrl', 'K'] },
  { icon: Search, label: 'Search SoundCloud', keys: ['/'] },
  { icon: Maximize2, label: 'Focus mode', keys: ['F'] },
  { icon: Settings2, label: 'Settings', keys: ['Ctrl', ','] },
  { icon: Keyboard, label: 'Play / pause', keys: ['Space'] }
]

export interface HomeViewProps {
  player: PlayerSnapshot
  recents: RecentTrack[]
  settings: Settings
  online: boolean
  version: string
  session: SiteSession
  onNavigate: (id: string) => void
  onOpenTrack: (track: RecentTrack) => void
  onOpenPalette: () => void
  onOpenSettings: () => void
  onSignIn: () => void
}

/**
 * The first surface a listener sees. It deliberately does not try to mirror
 * SoundCloud's own home feed: it is a quiet launchpad into the real product,
 * with the player state and keyboard model explained in plain language.
 */
export function HomeView({
  player,
  recents,
  settings,
  online,
  version,
  session,
  onNavigate,
  onOpenTrack,
  onOpenPalette,
  onOpenSettings,
  onSignIn
}: HomeViewProps): JSX.Element {
  const nowSeed = player.title || player.artist || 'Cloudwave'
  const signedIn = session.status === 'signed-in'
  const signedOut = session.status === 'signed-out'

  return (
    <section className="home" aria-label="Home">
      <div className="home-inner">
        <header className="home-head">
          <div>
            <span className="eyebrow">{prettyDate()}</span>
            <h1>
              {greeting()}. <em>Find your next loop.</em>
            </h1>
          </div>
          <span className="head-note">
            <Cloud aria-hidden="true" />
            {online ? 'soundcloud.com connected' : 'Offline — reconnect to stream'}
          </span>
        </header>

        <div className="hero">
          <div className="hero-copy">
            <span className="hero-kicker">
              <Sparkles aria-hidden="true" />
              The quiet way in
            </span>
            <h2>
              SoundCloud, <em>without the noise.</em>
            </h2>
            <p>
              A native shell around the catalogue you already know. Discover, follow and upload
              inside a calm frame — while the player, media keys and session stay under one roof.
            </p>
            <div className="hero-actions">
              {signedOut ? (
                <button type="button" className="btn btn-primary" onClick={onSignIn}>
                  <LogIn aria-hidden="true" />
                  Sign in to SoundCloud
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onNavigate('discover')}
                >
                  <Compass aria-hidden="true" />
                  Open Discover
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onNavigate(signedOut ? 'discover' : 'charts')}
              >
                {signedOut ? <Compass aria-hidden="true" /> : <TrendingUp aria-hidden="true" />}
                {signedOut ? 'Browse first' : 'Browse charts'}
              </button>
            </div>
            <div className="hero-facts">
              <span>
                <ShieldCheck aria-hidden="true" />
                {signedIn ? 'Signed in' : signedOut ? 'Sign in once' : 'Checking session'}
              </span>
              <span>
                <Keyboard aria-hidden="true" />
                Media keys ready
              </span>
              <span>
                <Sparkles aria-hidden="true" />
                {settings.hideAds ? 'Ads hidden' : 'Native controls'}
              </span>
            </div>
          </div>

          <div className="hero-viz" aria-hidden="true">
            <div className="vinyl">
              <div className="vinyl-label">
                <Disc3 />
              </div>
              <span className="vinyl-hole" />
            </div>
            <div className="float-card">
              <span className="eq">
                {[0, 1, 2, 3].map((bar) => (
                  <i
                    key={bar}
                    style={{ animationPlayState: player.playing ? 'running' : 'paused' }}
                  />
                ))}
              </span>
              <div>
                <strong>{player.hasTrack ? player.title : 'SoundCloud, in sync'}</strong>
                <span>{player.hasTrack ? player.artist || 'Now playing' : 'soundcloud.com'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="home-grid">
          <div>
            <div className="section-head">
              <h3>Start somewhere</h3>
              <button type="button" className="section-action" onClick={() => onNavigate('discover')}>
                All destinations
                <ArrowRight aria-hidden="true" />
              </button>
            </div>
            <div className="start-grid">
              {START_IDS.map((id) => {
                const destination = destinationById(id)
                if (!destination) return null
                return (
                  <button
                    key={id}
                    type="button"
                    className="dest-card"
                    onClick={() => onNavigate(id)}
                    title={destination.hint}
                  >
                    <CoverArt
                      seed={destination.label}
                      label={destination.label}
                      glyphSize={13}
                    />
                    <span className="dest-meta">
                      <strong>{destination.label}</strong>
                      <span>{destination.hint}</span>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="section-head">
              <h3>Keyboard first</h3>
              <button type="button" className="section-action" onClick={onOpenPalette}>
                Command palette
                <Command aria-hidden="true" />
              </button>
            </div>
            <div className="panel">
              <div className="shortcut-list">
                {SHORTCUTS.map((shortcut) => {
                  const Icon = shortcut.icon
                  return (
                    <div key={shortcut.label} className="shortcut-row">
                      <Icon aria-hidden="true" />
                      <span>{shortcut.label}</span>
                      <span className="kbd-group">
                        {shortcut.keys.map((key) => (
                          <kbd key={key} className="kbd">
                            {key}
                          </kbd>
                        ))}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div className="panel-divider" />
              <div className="session-note">
                {signedIn ? <ShieldCheck aria-hidden="true" /> : <Info aria-hidden="true" />}
                <span>
                  {signedIn
                    ? `Signed in as ${session.userName || 'your SoundCloud account'}. Likes, uploads and your library stay in the same persistent session.`
                    : signedOut
                      ? 'Sign in with Google, Facebook, Apple or email. The page handles OAuth in a secure popup, and Cloudwave only reads the name and avatar it renders — never your password or tokens.'
                      : 'Cloudwave keeps the SoundCloud session warm in the background. Sign in once and the shell, player and media keys stay around it.'}
                </span>
                {signedOut ? (
                  <button type="button" className="section-action" onClick={onSignIn}>
                    Sign in
                    <LogIn aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <section className="browse" aria-label="Explore SoundCloud">
          <div className="section-head">
            <h3>Explore SoundCloud</h3>
            <button type="button" className="section-action" onClick={() => onNavigate('discover')}>
              Open Discover
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
          <div className="browse-grid">
            {BROWSE.map((entry) => {
              const Icon = entry.icon
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="browse-card"
                  onClick={() => onNavigate(entry.id)}
                >
                  <span className="browse-art" style={coverStyle(entry.title)} aria-hidden="true" />
                  <span className="browse-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="browse-copy">
                    <strong>{entry.title}</strong>
                    <span>{entry.copy}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {recents.length > 0 ? (
          <section className="browse" aria-label="Recently played">
            <div className="section-head">
              <h3>Recently played</h3>
              <span className="section-action">From this device</span>
            </div>
            <div className="recent-grid">
              {recents.slice(0, 4).map((track) => (
                <button
                  key={`${track.url}|${track.title}`}
                  type="button"
                  className="recent-card"
                  onClick={() => onOpenTrack(track)}
                  title={`${track.title}${track.artist ? ` — ${track.artist}` : ''}`}
                >
                  <CoverArt
                    seed={track.title}
                    artwork={track.artwork}
                    label={track.title}
                    glyphSize={20}
                  />
                  <strong>{track.title}</strong>
                  <span>{track.artist || 'SoundCloud'}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="home-foot">
          <span>
            <BrandMark className="home-foot-mark" />
            Cloudwave v{version}
          </span>
          <span>
            <Heart aria-hidden="true" />
            Made for SoundCloud · unofficial client
          </span>
        </footer>
      </div>
    </section>
  )
}
