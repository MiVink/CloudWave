import {
  Compass,
  Heart,
  Home,
  Library,
  ListMusic,
  Radio,
  Search,
  TrendingUp,
  UploadCloud,
  type LucideIcon
} from 'lucide-react'

export type NavGroup = 'Listen' | 'Your music' | 'Create'

export interface Destination {
  id: string
  label: string
  hint: string
  /** SoundCloud path used for active-state matching */
  path: string
  url: string
  icon: LucideIcon
  group: NavGroup
  /** Hidden from the sidebar but still routable from search / the palette */
  hidden?: boolean
}

export const DISCOVER_URL = 'https://soundcloud.com/discover'

/**
 * The page's own sign-in route. Cloudwave opens it in the embedded webview so
 * the OAuth popups inherit the same persistent partition and the shell never
 * touches credentials.
 */
export const SIGN_IN_URL = 'https://soundcloud.com/signin'

export const DESTINATIONS: Destination[] = [
  {
    id: 'home',
    label: 'Home',
    hint: 'A quiet front door',
    path: '/cloudwave-home',
    url: 'cloudwave://home',
    icon: Home,
    group: 'Listen'
  },
  {
    id: 'discover',
    label: 'Discover',
    hint: 'Fresh uploads, charts and picks',
    path: '/discover',
    url: DISCOVER_URL,
    icon: Compass,
    group: 'Listen'
  },
  {
    id: 'feed',
    label: 'Feed',
    hint: 'What the people you follow post',
    path: '/stream',
    url: 'https://soundcloud.com/stream',
    icon: Radio,
    group: 'Listen'
  },
  {
    id: 'charts',
    label: 'Charts',
    hint: 'Top 50 by genre, refreshed daily',
    path: '/charts',
    url: 'https://soundcloud.com/charts/top',
    icon: TrendingUp,
    group: 'Listen'
  },
  {
    id: 'likes',
    label: 'Likes',
    hint: 'Everything you have hearted',
    path: '/you/likes',
    url: 'https://soundcloud.com/you/likes',
    icon: Heart,
    group: 'Your music'
  },
  {
    id: 'library',
    label: 'Library',
    hint: 'Your uploads and collected tracks',
    path: '/you/library',
    url: 'https://soundcloud.com/you/library',
    icon: Library,
    group: 'Your music'
  },
  {
    id: 'playlists',
    label: 'Playlists',
    hint: 'Sets and albums you keep close',
    path: '/you/playlists',
    url: 'https://soundcloud.com/you/playlists',
    icon: ListMusic,
    group: 'Your music'
  },
  {
    id: 'upload',
    label: 'Upload',
    hint: 'Put something new into the world',
    path: '/upload',
    url: 'https://soundcloud.com/upload',
    icon: UploadCloud,
    group: 'Create'
  },
  {
    id: 'search',
    label: 'Search',
    hint: 'Find a track, artist or playlist',
    path: '/search',
    url: 'https://soundcloud.com/search',
    icon: Search,
    group: 'Listen',
    hidden: true
  }
]

export const NAV_GROUPS: { label: NavGroup; ids: string[] }[] = [
  { label: 'Listen', ids: ['home', 'discover', 'feed', 'charts'] },
  { label: 'Your music', ids: ['likes', 'library', 'playlists'] },
  { label: 'Create', ids: ['upload'] }
]

export function destinationById(id: string): Destination | undefined {
  return DESTINATIONS.find((destination) => destination.id === id)
}

export function destinationForUrl(rawUrl: string): Destination | undefined {
  if (!rawUrl) return undefined
  let path: string
  try {
    path = new URL(rawUrl).pathname.toLowerCase()
  } catch {
    return undefined
  }

  return [...DESTINATIONS]
    .filter((destination) => !destination.hidden && destination.id !== 'home')
    .sort((a, b) => b.path.length - a.path.length)
    .find((destination) => path === destination.path || path.startsWith(`${destination.path}/`))
}

export function searchUrl(term: string): string {
  return `https://soundcloud.com/search?q=${encodeURIComponent(term)}`
}
