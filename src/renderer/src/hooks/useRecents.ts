import { useCallback, useEffect, useState } from 'react'
import { upgradeArtworkUrl } from '@shared/artwork'

const STORAGE_KEY = 'cloudwave.recents.v1'
const MAX_RECENTS = 8

export interface RecentTrack {
  title: string
  artist: string
  url: string
  artwork: string
  playedAt: number
}

export interface RecentInput {
  title: string
  artist: string
  url?: string
  artwork?: string
}

function readRecents(): RecentTrack[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentTrack[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((track) => track && typeof track.title === 'string')
      .slice(0, MAX_RECENTS)
      .map((track) => ({
        title: track.title,
        artist: typeof track.artist === 'string' ? track.artist : '',
        url: typeof track.url === 'string' ? track.url : '',
        artwork: typeof track.artwork === 'string' ? track.artwork : '',
        playedAt: Number(track.playedAt) || 0
      }))
  } catch {
    return []
  }
}

function identity(track: { title: string; artist: string; url?: string }): string {
  if (track.url) return `url:${track.url}`
  return `meta:${track.artist.trim().toLowerCase()}|${track.title.trim().toLowerCase()}`
}

export interface UseRecentsResult {
  recents: RecentTrack[]
  addRecent: (track: RecentInput) => void
  clearRecents: () => void
}

export function useRecents(): UseRecentsResult {
  const [recents, setRecents] = useState<RecentTrack[]>(readRecents)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recents))
    } catch {
      /* non-critical */
    }
  }, [recents])

  const addRecent = useCallback((track: RecentInput) => {
    const title = track.title?.trim()
    if (!title) return
    const entry: RecentTrack = {
      title,
      artist: track.artist?.trim() ?? '',
      url: track.url ?? '',
      artwork: track.artwork ? upgradeArtworkUrl(track.artwork) : '',
      playedAt: Date.now()
    }
    const key = identity(entry)
    setRecents((previous) => [entry, ...previous.filter((item) => identity(item) !== key)].slice(0, MAX_RECENTS))
  }, [])

  const clearRecents = useCallback(() => setRecents([]), [])

  return { recents, addRecent, clearRecents }
}
