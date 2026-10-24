import { useState, type CSSProperties, type JSX } from 'react'
import { Volume1, Volume2, VolumeX } from 'lucide-react'
import { clamp } from '@/lib/format'

export interface VolumeControlProps {
  /** 0..1 */
  volume: number
  onChange: (value: number) => void
  onToggleMute: () => void
  className?: string
}

/** Volume icon + slim range input. Dragging only reports the raw 0..1 value. */
export function VolumeControl({
  volume,
  onChange,
  onToggleMute,
  className = ''
}: VolumeControlProps): JSX.Element {
  const [dragging, setDragging] = useState(false)
  const percent = Math.round(clamp(volume, 0, 1) * 100)
  const Icon = volume <= 0.001 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div className={`volume-group ${className}`.trim()}>
      <button
        type="button"
        className="icon-btn"
        onClick={onToggleMute}
        title={volume > 0 ? 'Mute (M)' : 'Unmute (M)'}
        aria-label={volume > 0 ? 'Mute' : 'Unmute'}
      >
        <Icon />
      </button>
      <input
        className="volume-range"
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        aria-label="Volume"
        aria-valuetext={`${percent}%`}
        style={{ '--fill': `${percent}%` } as CSSProperties}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        onBlur={() => setDragging(false)}
        onChange={(event) => onChange(clamp(Number(event.target.value) / 100, 0, 1))}
      />
      {dragging ? <span className="sr-only">{percent}%</span> : null}
    </div>
  )
}
