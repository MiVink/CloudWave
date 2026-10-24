import { useState, type CSSProperties, type JSX } from 'react'
import { upgradeArtworkUrl } from '@shared/artwork'
import { coverStyle } from '@/lib/covers'
import { initials } from '@/lib/format'

export interface CoverArtProps {
  /** Deterministic seed used for the generated gradient and monogram. */
  seed: string
  /** Real artwork, when the track / upload exposes one. */
  artwork?: string
  /** Text used for the monogram; falls back to the seed. */
  label?: string
  className?: string
  glyphSize?: number
}

/**
 * Generated cover art with a graceful fallback to the real artwork.
 *
 * Every cover is deterministic: the same track always receives the same
 * gradient, so the UI feels stable across launches and never depends on a
 * remote image being reachable.
 */
export function CoverArt({
  seed,
  artwork,
  label,
  className = '',
  glyphSize = 14
}: CoverArtProps): JSX.Element {
  const [failedArtwork, setFailedArtwork] = useState('')

  // Recents persist artwork URLs from earlier sessions, when the site only
  // exposed 50px thumbnails. Upgrading here fixes old entries as well as new
  // ones without a storage migration.
  const source = artwork ? upgradeArtworkUrl(artwork) : ''
  const showArtwork = Boolean(source) && failedArtwork !== source
  const text = label?.trim() || seed.trim() || 'Cloudwave'

  return (
    <span
      className={`cover ${className}`.trim()}
      style={
        {
          ...coverStyle(seed),
          '--cover-glyph': `${glyphSize}px`
        } as CSSProperties
      }
    >
      {showArtwork ? (
        <img
          src={source}
          alt=""
          draggable={false}
          decoding="async"
          loading="lazy"
          onError={() => setFailedArtwork(source)}
        />
      ) : (
        <span className="cover-art" aria-hidden="true">
          <span className="rings" />
          <span className="glyph">{initials(text)}</span>
        </span>
      )}
    </span>
  )
}
