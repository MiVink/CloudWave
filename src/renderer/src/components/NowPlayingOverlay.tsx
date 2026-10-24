import { ExternalLink, Heart, Maximize2, Music2, X } from 'lucide-react'
import type { JSX } from 'react'
import type { PlayerSnapshot } from '@shared/types'
import { coverPalette } from '@/lib/covers'
import { formatTime } from '@/lib/format'
import { CoverArt } from './CoverArt'
import { TransportControls } from './TransportControls'
import { VolumeControl } from './VolumeControl'
import { Waveform } from './Waveform'

export interface NowPlayingOverlayProps {
  player: PlayerSnapshot
  onClose: () => void
  onPlayPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (seconds: number) => void
  onVolumeChange: (value: number) => void
  onToggleMute: () => void
  onToggleLike: () => void
  onToggleShuffle: () => void
  onToggleRepeat: () => void
  /** Open the current track inside the embedded SoundCloud page. */
  onOpenSource: () => void
}

/**
 * Focus mode: the one screen that is allowed to be loud.
 *
 * Artwork drives the whole surface — the generated cover gradient is always
 * there, and real artwork adds a blurred bloom behind it. Everything the
 * player bar can do is reachable here without the rest of the shell.
 */
export function NowPlayingOverlay({
  player,
  onClose,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleLike,
  onToggleShuffle,
  onToggleRepeat,
  onOpenSource
}: NowPlayingOverlayProps): JSX.Element {
  const seed = player.title || player.artist || 'Cloudwave'
  const palette = coverPalette(seed)

  return (
    <div className="immersive" role="dialog" aria-modal="true" aria-label="Focus mode">
      <div
        className="immersive-bg"
        style={{ background: palette.background }}
        aria-hidden="true"
      />
      {player.artwork ? (
        <div
          className="immersive-bg-art"
          style={{ backgroundImage: `url("${player.artwork}")` }}
          aria-hidden="true"
        />
      ) : null}

      <div className="immersive-top">
        <span className="focus-label">
          <Maximize2 aria-hidden="true" />
          Focus mode
        </span>
        <button
          type="button"
          className="immersive-close"
          onClick={onClose}
          title="Close focus mode (Esc)"
          aria-label="Close focus mode"
        >
          <X />
        </button>
      </div>

      <div className="immersive-body">
        {player.hasTrack ? (
          <>
            <div className="immersive-art">
              <CoverArt
                seed={seed}
                artwork={player.artwork}
                label={player.title}
                glyphSize={42}
              />
            </div>

            <div className="immersive-info">
              <span className="eyebrow">Now playing</span>
              <h1 className="immersive-title">{player.title || 'Unknown track'}</h1>
              <span className="immersive-artist">{player.artist || 'SoundCloud'}</span>

              <div className="immersive-actions">
                <button
                  type="button"
                  className={`icon-btn ${player.liked ? 'is-liked' : ''}`.trim()}
                  onClick={onToggleLike}
                  title={player.liked ? 'Unlike (L)' : 'Like (L)'}
                  aria-label={player.liked ? 'Unlike track' : 'Like track'}
                  aria-pressed={player.liked}
                >
                  <Heart fill={player.liked ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={onOpenSource}
                  title="Open this track in SoundCloud"
                >
                  <ExternalLink aria-hidden="true" />
                  Open on SoundCloud
                </button>
              </div>

              <div className="immersive-controls">
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

                <div className="immersive-timeline">
                  <span className="time">{formatTime(player.position)}</span>
                  <Waveform
                    position={player.position}
                    duration={player.duration}
                    onSeek={onSeek}
                    bars={140}
                  />
                  <span className="time is-duration">
                    {player.duration > 0 ? formatTime(player.duration) : '--:--'}
                  </span>
                </div>

                <div className="immersive-volume">
                  <VolumeControl
                    volume={player.volume}
                    onChange={onVolumeChange}
                    onToggleMute={onToggleMute}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="immersive-empty">
            <Music2 aria-hidden="true" />
            <strong>Nothing playing yet</strong>
            <span>Pick a track on SoundCloud and focus mode will fill itself in.</span>
          </div>
        )}
      </div>
    </div>
  )
}
