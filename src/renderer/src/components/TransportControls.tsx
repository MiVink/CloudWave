import { Pause, Play, Repeat, Shuffle, SkipBack, SkipForward } from 'lucide-react'
import type { JSX } from 'react'

export interface TransportControlsProps {
  playing: boolean
  hasTrack: boolean
  shuffle: boolean
  repeat: boolean
  onPlayPause: () => void
  onNext: () => void
  onPrev: () => void
  onShuffle: () => void
  onRepeat: () => void
  className?: string
}

/**
 * Play / skip / shuffle / repeat. Kept separate from the player bar so the
 * focus overlay can reuse the exact same controls.
 */
export function TransportControls({
  playing,
  hasTrack,
  shuffle,
  repeat,
  onPlayPause,
  onNext,
  onPrev,
  onShuffle,
  onRepeat,
  className = ''
}: TransportControlsProps): JSX.Element {
  return (
    <div className={`transport-buttons ${className}`.trim()}>
      <button
        type="button"
        className={`icon-btn ${shuffle ? 'is-on' : ''}`.trim()}
        onClick={onShuffle}
        title="Shuffle (S)"
        aria-label="Shuffle"
        aria-pressed={shuffle}
      >
        <Shuffle />
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={onPrev}
        title="Previous (Ctrl + ←)"
        aria-label="Previous track"
        disabled={!hasTrack}
      >
        <SkipBack />
      </button>
      <button
        type="button"
        className="play-btn"
        onClick={onPlayPause}
        title={playing ? 'Pause (Space)' : 'Play (Space)'}
        aria-label={playing ? 'Pause' : 'Play'}
        disabled={!hasTrack}
      >
        {playing ? <Pause /> : <Play />}
      </button>
      <button
        type="button"
        className="icon-btn"
        onClick={onNext}
        title="Next (Ctrl + →)"
        aria-label="Next track"
        disabled={!hasTrack}
      >
        <SkipForward />
      </button>
      <button
        type="button"
        className={`icon-btn ${repeat ? 'is-on' : ''}`.trim()}
        onClick={onRepeat}
        title="Repeat (R)"
        aria-label="Repeat"
        aria-pressed={repeat}
      >
        <Repeat />
      </button>
    </div>
  )
}
