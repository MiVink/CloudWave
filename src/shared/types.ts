/**
 * Types shared between the main process, preload and renderer.
 * Keep this file dependency-free.
 */

export type PlayerCommand =
  | { type: 'playpause' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'seek'; value: number }
  | { type: 'volume'; value: number }
  | { type: 'like' }
  | { type: 'shuffle' }
  | { type: 'repeat' }
  | { type: 'reload' }
  /** Shell preferences the embedded page can honour (ads, banners). */
  | { type: 'prefs'; value: { hideAds: boolean } }
  /**
   * Ask the page to route in-place instead of the host calling `loadURL`.
   * A real document load tears down the audio element and stops playback;
   * clicking a matching SoundCloud anchor keeps the player alive.
   */
  | { type: 'navigate'; value: { url: string } }

export interface PlayerSnapshot {
  /** Track title as shown in the SoundCloud player */
  title: string
  /** Artist / uploader name */
  artist: string
  /** Artwork URL (may be empty) */
  artwork: string
  /** Track permalink, when we can resolve it */
  url: string
  playing: boolean
  /** Seconds */
  position: number
  /** Seconds, 0 when unknown */
  duration: number
  /** 0..1 */
  volume: number
  liked: boolean
  shuffle: boolean
  repeat: boolean
  /** True when the page actually reports a loaded track */
  hasTrack: boolean
}

export interface AppInfo {
  version: string
  electron: string
  chrome: string
  platform: NodeJS.Platform
}

/**
 * What the embedded page can tell the shell about the SoundCloud account.
 *
 * Cloudwave never sees credentials or tokens: this is read from the rendered
 * header only, so it is a UI hint (avatar, name, sign-in entry point) rather
 * than an auth source. `unknown` means the header has not resolved yet.
 */
export type SiteSessionStatus = 'signed-in' | 'signed-out' | 'unknown'

export interface SiteSession {
  status: SiteSessionStatus
  userName: string
  avatar: string
  profileUrl: string
}

export const EMPTY_SESSION: SiteSession = {
  status: 'unknown',
  userName: '',
  avatar: '',
  profileUrl: ''
}

export type AccentId = 'ember' | 'coral' | 'lime' | 'cyan' | 'violet'

export interface Settings {
  accent: AccentId
  reduceMotion: boolean
  hideAds: boolean
  alwaysOnTop: boolean
  sidebarCollapsed: boolean
  showRecents: boolean
  volume: number
}

export const DEFAULT_SETTINGS: Settings = {
  accent: 'ember',
  reduceMotion: false,
  hideAds: true,
  alwaysOnTop: false,
  sidebarCollapsed: false,
  showRecents: true,
  volume: 0.8
}

export const EMPTY_PLAYER: PlayerSnapshot = {
  title: '',
  artist: '',
  artwork: '',
  url: '',
  playing: false,
  position: 0,
  duration: 0,
  volume: 0.8,
  liked: false,
  shuffle: false,
  repeat: false,
  hasTrack: false
}
