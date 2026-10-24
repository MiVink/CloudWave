import { useCallback, useMemo, useRef, type JSX, type KeyboardEvent, type PointerEvent } from 'react'
import { clamp, formatTime } from '@/lib/format'

export interface WaveformProps {
  /** Playback position in seconds. */
  position: number
  /** Track length in seconds; 0 while unknown. */
  duration: number
  onSeek: (seconds: number) => void
  disabled?: boolean
  className?: string
  /** Number of bars. Denser for the focus view. */
  bars?: number
}

/**
 * A seek surface disguised as a waveform.
 *
 * The bars are deterministic decoration; the actual control is a slider with
 * pointer drag and full keyboard support, so it stays usable without a mouse.
 */
export function Waveform({
  position,
  duration,
  onSeek,
  disabled = false,
  className = '',
  bars = 96
}: WaveformProps): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const heights = useMemo(() => {
    const values: number[] = []
    let seed = 0x9e3779b9
    for (let index = 0; index < bars; index += 1) {
      seed ^= seed << 13
      seed ^= seed >>> 17
      seed ^= seed << 5
      const noise = ((seed >>> 0) % 1000) / 1000
      // A gentle arch keeps the middle of the waveform visually taller.
      const arch = Math.sin((index / Math.max(1, bars - 1)) * Math.PI)
      values.push(clamp(0.28 + noise * 0.5 + arch * 0.34, 0.2, 1))
    }
    return values
  }, [bars])

  const ratio = duration > 0 ? clamp(position / duration, 0, 1) : 0
  const canSeek = !disabled && duration > 0

  const seekFromPointer = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const surface = surfaceRef.current
      if (!surface || !canSeek) return
      const rect = surface.getBoundingClientRect()
      if (rect.width <= 0) return
      const nextRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
      onSeek(nextRatio * duration)
    },
    [canSeek, duration, onSeek]
  )

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (!canSeek) return
    event.currentTarget.setPointerCapture(event.pointerId)
    draggingRef.current = true
    seekFromPointer(event)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    seekFromPointer(event)
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    draggingRef.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (!canSeek) return
    const step = event.shiftKey ? 30 : 5
    let next: number | null = null

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = position - step
        break
      case 'ArrowRight':
      case 'ArrowUp':
        next = position + step
        break
      case 'PageDown':
        next = position - 15
        break
      case 'PageUp':
        next = position + 15
        break
      case 'Home':
        next = 0
        break
      case 'End':
        next = duration
        break
      default:
        return
    }

    event.preventDefault()
    event.stopPropagation()
    onSeek(clamp(next, 0, duration))
  }

  const headIndex = Math.round(ratio * (bars - 1))
  const timeLabel = duration > 0 ? `${formatTime(position)} of ${formatTime(duration)}` : 'No track loaded'

  return (
    <div
      ref={surfaceRef}
      className={`wave ${disabled ? 'is-disabled' : ''} ${className}`.trim()}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Seek in track"
      aria-valuemin={0}
      aria-valuemax={Math.max(0, Math.round(duration))}
      aria-valuenow={Math.max(0, Math.round(canSeek ? position : 0))}
      aria-valuetext={timeLabel}
      aria-disabled={disabled || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
    >
      {heights.map((height, index) => {
        const filled = canSeek && index / Math.max(1, bars - 1) <= ratio
        const head = canSeek && index === headIndex
        return (
          <span
            key={index}
            className={`wave-bar ${filled ? 'is-filled' : ''} ${head ? 'is-head' : ''}`.trim()}
            style={{ height: `${Math.round(height * 100)}%` }}
          />
        )
      })}
    </div>
  )
}
