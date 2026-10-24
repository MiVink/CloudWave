/** Small formatting helpers shared by the shell UI. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 87 -> "1:27", 3725 -> "1:02:05" */
export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const total = Math.floor(value)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (part: number): string => String(part).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

/** Two-character monogram used on generated cover art. */
export function initials(text: string): string {
  const words = text
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'CW'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'Still up?'
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function prettyDate(date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(date)
}

/** "https://soundcloud.com/discover" -> "soundcloud.com/discover" */
export function prettyUrl(rawUrl: string): string {
  if (!rawUrl) return 'soundcloud.com'
  try {
    const url = new URL(rawUrl)
    const host = url.hostname.replace(/^www\./, '')
    const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
    const query = url.search ? decodeURIComponent(url.search) : ''
    return `${host}${path || '/'}${query}`
  } catch {
    return rawUrl
  }
}
