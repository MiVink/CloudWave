import type { CSSProperties } from 'react'

/**
 * Artwork is generated locally from a string seed (track title, destination,
 * playlist name). No stock photos, no extra network requests, and every track
 * gets the same colours on every launch.
 */

export function hashString(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export interface CoverPalette {
  background: string
  glow: string
}

export function coverPalette(seed: string): CoverPalette {
  const hash = hashString(seed || 'cloudwave')
  const base = hash % 360
  const second = (base + 28 + ((hash >>> 9) % 76)) % 360
  const third = (base + 188 + ((hash >>> 17) % 84)) % 360
  const angle = 108 + ((hash >>> 5) % 104)

  return {
    background: `linear-gradient(${angle}deg, hsl(${base} 68% 56%) 0%, hsl(${second} 62% 40%) 48%, hsl(${third} 48% 18%) 100%)`,
    glow: `hsla(${base}, 72%, 58%, 0.32)`
  }
}

export function coverStyle(seed: string): CSSProperties {
  return { '--cover-bg': coverPalette(seed).background } as CSSProperties
}
