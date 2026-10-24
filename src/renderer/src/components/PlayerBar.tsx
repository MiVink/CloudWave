import { Heart, Maximize2, Music2, SlidersHorizontal } from 'lucide-react'
import type { JSX } from 'react'
import type { PlayerSnapshot } from '@shared/types'
import { formatTime } from '@/lib/format'
import { CoverArt } from './CoverArt'
import { TransportControls } from './TransportControls'
import { VolumeControl } from './VolumeControl'
import { Waveform } from './Waveform'

export interface PlayerBarProps {
  player: PlayerSnapshot
  onPlayPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (seconds: number) => void
  onVolumeChange: (value: number) => void
  onToggleMute: () => void
  onToggleLike: () => void
  onToggleShuffle: () => void
  onToggleRepeat: () => void
  onOpenImmersive: () => void
  onOpenHome: () => void
  onOpenSettings: () => void
}

/**
 * The persistent player. It is deliberately the widest, quietest element in
 * the shell: one accent-filled waveform, neutral controls, no competing chrome.
 */
export function PlayerBar({
  player,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleLike,
  onToggleShuffle,
  onToggleRepeat,
  onOpenImmersive,
  onOpenHome,
  onOpenSettings
}: PlayerBarProps): JSX.Element {
  const seed = player.title || player.artist || 'Cloudwave'

  return (
    <footer className="playerbar" aria-label="Player">
      <div className="now">
        {player.hasTrack ? (
          <button
            type="button"
            className="now-art"
            onClick={onOpenImmersive}
            title="Open focus mode (F)"
            aria-label="Open focus mode"
          >
            <CoverArt seed={seed} artwork={player.artwork} label={player.title} glyphSize={14} />
            <span className="art-expand" aria-hidden="true">
              <Maximize2 />
            </span>
          </button>
        ) : (
          <div className="now-art is-empty" aria-hidden="true">
            <Music2 />
          </div>
        )}

        <div className="now-meta">
          {player.hasTrack ? (
            <>
              <button type="button" className="now-title" onClick={onOpenImmersive}>
                {player.title || 'Unknown track'}
              </button>
              <span className="now-artist">{player.artist || 'SoundCloud'}</span>
            </>
          ) : (
            <div className="now-empty-copy">
              <strong>Nothing playing yet</strong>
              <button type="button" onClick={onOpenHome}>
                Pick something on Home
              </button>
            </div>
          )}
        </div>

        {player.hasTrack ? (
          <button
            type="button"
            className={`icon-btn now-like ${player.liked ? 'is-liked' : ''}`.trim()}
            onClick={onToggleLike}
            title={player.liked ? 'Unlike (L)' : 'Like (L)'}
            aria-label={player.liked ? 'Unlike track' : 'Like track'}
            aria-pressed={player.liked}
          >
            <Heart fill={player.liked ? 'currentColor' : 'none'} />
          </button>
        ) : null}
      </div>

      <div className="transport">
        <TransportControls
          playing={player.playing}
          hasTrack={player.hasTrack}
          shuffle={player.shuffle}
          repeat={player.repeat}
          onPlayPause={onPlayPause}
          onNext={onNext}
          onPrev={onPrev}
          onShuffle={onToggleShuffle}
          onRepeat={onToggleRepeat}
        />

        <div className="timeline">
          <span className="time">{player.hasTrack ? formatTime(player.position) : '0:00'}</span>
          <Waveform
            position={player.position}
            duration={player.duration}
            onSeek={onSeek}
            disabled={!player.hasTrack}
          />
          <span className="time is-duration">
            {player.duration > 0 ? formatTime(player.duration) : '--:--'}
          </span>
        </div>
      </div>

      <div className="player-right">
        <VolumeControl volume={player.volume} onChange={onVolumeChange} onToggleMute={onToggleMute} />
        <span className="divider-v" aria-hidden="true" />
        <button
          type="button"
          className="icon-btn settings-shortcut"
          onClick={onOpenSettings}
          title="Settings (Ctrl ,)"
          aria-label="Settings"
        >
          <SlidersHorizontal />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={onOpenImmersive}
          disabled={!player.hasTrack}
          title="Focus mode (F)"
          aria-label="Focus mode"
        >
          <Maximize2 />
        </button>
      </div>
    </footer>
  )
}
