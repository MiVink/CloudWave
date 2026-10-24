import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { ArrowLeft, Info, RotateCw, WifiOff } from 'lucide-react'
import {
  EMPTY_PLAYER,
  EMPTY_SESSION,
  type PlayerCommand,
  type PlayerSnapshot,
  type AppInfo,
  type SiteSession
} from '@shared/types'
import { useRecents, type RecentTrack } from '@/hooks/useRecents'
import { useSettings } from '@/hooks/useSettings'
import { clamp } from '@/lib/format'
import {
  DISCOVER_URL,
  SIGN_IN_URL,
  destinationById,
  destinationForUrl,
  searchUrl
} from '@/lib/destinations'
import { BrandMark } from '@/components/BrandMark'
import { CommandPalette } from '@/components/CommandPalette'
import { HomeView } from '@/components/HomeView'
import { NowPlayingOverlay } from '@/components/NowPlayingOverlay'
import { PlayerBar } from '@/components/PlayerBar'
import { SettingsPanel } from '@/components/SettingsPanel'
import { Sidebar } from '@/components/Sidebar'
import { TitleBar } from '@/components/TitleBar'
import type { ElectronWebviewElement, WebviewIpcEvent, WebviewNavigateEvent } from './env'

type View = 'home' | 'web' | 'demo'

const DEMO_QUEUE: { title: string; artist: string; duration: number }[] = [
  { title: 'Neon Cartography', artist: 'Sable Youth', duration: 214 },
  { title: 'Velvet Static', artist: 'Sable Youth', duration: 197 },
  { title: 'Paper Satellites', artist: 'Milo Fenn', duration: 232 }
]

const DEMO_RECENTS: { title: string; artist: string }[] = [
  { title: 'Paper Satellites', artist: 'Milo Fenn' },
  { title: 'Low Orbit Lullaby', artist: 'Hana Vex' },
  { title: 'Afterglow Protocol', artist: 'Nova Kite' },
  { title: 'Velvet Static', artist: 'Sable Youth' }
]

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

/**
 * Root of the native shell.
 *
 * The SoundCloud page lives in a single, always-mounted <webview>. Everything
 * else — navigation, player state, shortcuts, overlays — is host chrome that
 * talks to the page through the injected preload. Keeping the view mounted is
 * what lets audio survive when Home, focus mode or settings are on screen.
 */
export function App(): JSX.Element {
  const demoMode = useMemo(
    () => new URLSearchParams(window.location.search).get('demo') === '1',
    []
  )

  const { settings, updateSettings } = useSettings()
  const { recents, addRecent, clearRecents } = useRecents()

  const [player, setPlayer] = useState<PlayerSnapshot>(() => ({
    ...EMPTY_PLAYER,
    volume: settings.volume
  }))
  const [view, setView] = useState<View>('home')
  const [activeNav, setActiveNav] = useState('home')
  const [searchTerm, setSearchTerm] = useState('')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [loading, setLoading] = useState(false)
  const [webReady, setWebReady] = useState(false)
  const [webError, setWebError] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [session, setSession] = useState<SiteSession>(EMPTY_SESSION)

  const webviewRef = useRef<ElectronWebviewElement | null>(null)
  const readyRef = useRef(false)
  const visibleRef = useRef(false)
  const pendingUrlRef = useRef<string | null>(null)
  const pendingNavTimer = useRef<number | null>(null)
  const pendingNavTarget = useRef<string | null>(null)
  const playerRef = useRef(player)
  const settingsRef = useRef(settings)
  const searchRef = useRef<HTMLInputElement>(null)
  const lastVolumeRef = useRef(settings.volume > 0 ? settings.volume : 0.8)
  const toastTimer = useRef<number | null>(null)
  const bootVolumeRef = useRef(settings.volume)

  playerRef.current = player
  settingsRef.current = settings

  const sitePreloadUrl = useMemo(() => {
    const path = window.desktop?.sitePreloadPath
    if (!path) return ''
    return encodeURI(`file:///${path.replace(/\\/g, '/').replace(/^\/+/, '')}`)
  }, [])

  const notify = (message: string): void => {
    setToast({ id: Date.now(), message })
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }

  /* ---------- navigation ---------- */

  const syncHistory = (): void => {
    const element = webviewRef.current
    if (!element) return
    try {
      setCanGoBack(element.canGoBack())
      setCanGoForward(element.canGoForward())
    } catch {
      /* the view can be between documents; stale flags are harmless */
    }
  }

  /** True when two URLs point at the same SoundCloud document. */
  const sameLocation = (current: string, target: string): boolean => {
    try {
      const a = new URL(current)
      const b = new URL(target)
      const trim = (path: string): string => path.replace(/\/+$/, '') || '/'
      return a.origin === b.origin && trim(a.pathname) === trim(b.pathname) && a.search === b.search
    } catch {
      return false
    }
  }

  const clearPendingNavigation = (): void => {
    if (pendingNavTimer.current) {
      window.clearTimeout(pendingNavTimer.current)
      pendingNavTimer.current = null
    }
    pendingNavTarget.current = null
  }

  const syncActiveNav = (url: string): void => {
    if (!visibleRef.current) return
    const destination = destinationForUrl(url)
    // Track and profile pages have no sidebar section: clear the highlight
    // instead of leaving whichever tab was last clicked lit up.
    setActiveNav(destination?.id ?? '')
    syncHistory()
  }

  const loadUrl = (url: string): void => {
    visibleRef.current = true
    setView('web')
    const element = webviewRef.current
    if (!element || !readyRef.current) {
      pendingUrlRef.current = url
      setLoading(true)
      return
    }
    clearPendingNavigation()
    setLoading(true)
    setWebError(false)
    void element.loadURL(url).catch(() => {
      setLoading(false)
    })
  }

  const navigateTo = (url: string): void => {
    setPaletteOpen(false)
    setSettingsOpen(false)
    setImmersive(false)
    if (demoMode) {
      visibleRef.current = true
      setView('demo')
      setActiveNav(destinationForUrl(url)?.id ?? '')
      return
    }

    const element = webviewRef.current
    const canRouteInPage =
      Boolean(element) &&
      readyRef.current &&
      /^https:\/\/(www\.)?soundcloud\.com(\/|$)/i.test(url)

    if (!element || !canRouteInPage) {
      loadUrl(url)
      return
    }

    // Ask SoundCloud's own router to move. A document load tears down the
    // <audio> element, which is exactly why sidebar clicks used to stop
    // playback. The site preload clicks a matching anchor; if no anchor exists
    // (or the route rejects it) we fall back to a real load after ~900 ms.
    visibleRef.current = true
    setView('web')
    setWebError(false)
    setLoading(false)
    element.send('sc:command', { type: 'navigate', value: { url } })

    clearPendingNavigation()
    pendingNavTarget.current = url
    pendingNavTimer.current = window.setTimeout(() => {
      pendingNavTimer.current = null
      const target = pendingNavTarget.current
      pendingNavTarget.current = null
      if (!target || !visibleRef.current) return
      let current = ''
      try {
        current = element.getURL()
      } catch {
        current = ''
      }
      if (!sameLocation(current, target)) loadUrl(target)
    }, 900)
  }

  const openSignIn = (): void => {
    navigateTo(SIGN_IN_URL)
  }

  const openProfile = (): void => {
    if (session.profileUrl) navigateTo(session.profileUrl)
    else openSignIn()
  }

  const goHome = (): void => {
    visibleRef.current = false
    clearPendingNavigation()
    setView('home')
    setActiveNav('home')
    setPaletteOpen(false)
    setSettingsOpen(false)
    setImmersive(false)
  }

  const navigate = (id: string): void => {
    const destination = destinationById(id)
    if (!destination) return
    if (id === 'home') {
      goHome()
      return
    }
    setActiveNav(id)
    navigateTo(destination.url)
  }

  const submitSearch = (term: string): void => {
    const trimmed = term.trim()
    if (!trimmed) return
    setSearchTerm(trimmed)
    setActiveNav('')
    navigateTo(searchUrl(trimmed))
  }

  const openTrack = (track: RecentTrack): void => {
    if (track.url) {
      navigateTo(track.url)
      return
    }
    const query = `${track.artist} ${track.title}`.trim()
    navigateTo(searchUrl(query))
  }

  const openSource = (): void => {
    const current = playerRef.current
    if (!current.url) {
      notify('This track has no public permalink yet')
      return
    }
    setImmersive(false)
    navigateTo(current.url)
  }

  const reload = (): void => {
    if (demoMode) {
      notify('Reload is disabled in demo mode')
      return
    }
    const element = webviewRef.current
    if (!element) return
    setWebError(false)
    setLoading(true)
    element.reload()
  }

  const goBack = (): void => {
    const element = webviewRef.current
    if (!element) return
    try {
      element.goBack()
    } catch {
      return
    }
    window.setTimeout(syncHistory, 260)
  }

  const goForward = (): void => {
    const element = webviewRef.current
    if (!element) return
    try {
      element.goForward()
    } catch {
      return
    }
    window.setTimeout(syncHistory, 260)
  }

  /* ---------- player ---------- */

  const sendCommand = (command: PlayerCommand): void => {
    const element = webviewRef.current
    if (!element || !readyRef.current) return
    element.send('sc:command', command)
  }

  const playPause = (): void => {
    setPlayer((previous) => ({ ...previous, playing: !previous.playing }))
    if (!demoMode) sendCommand({ type: 'playpause' })
  }

  const seek = (seconds: number): void => {
    const current = playerRef.current
    const limit = current.duration > 0 ? current.duration : Math.max(seconds, 0)
    const target = clamp(seconds, 0, limit)
    setPlayer((previous) => ({ ...previous, position: target }))
    if (!demoMode) sendCommand({ type: 'seek', value: target })
  }

  const changeVolume = (value: number): void => {
    const next = clamp(value, 0, 1)
    if (next > 0.001) lastVolumeRef.current = next
    setPlayer((previous) => ({ ...previous, volume: next }))
    if (!demoMode) sendCommand({ type: 'volume', value: next })
  }

  const toggleMute = (): void => {
    const current = playerRef.current.volume
    if (current > 0.001) {
      lastVolumeRef.current = current
      changeVolume(0)
      return
    }
    changeVolume(lastVolumeRef.current || 0.8)
  }

  const toggleLike = (): void => {
    if (!playerRef.current.hasTrack) return
    setPlayer((previous) => ({ ...previous, liked: !previous.liked }))
    if (!demoMode) sendCommand({ type: 'like' })
  }

  const toggleShuffle = (): void => {
    setPlayer((previous) => ({ ...previous, shuffle: !previous.shuffle }))
    if (!demoMode) sendCommand({ type: 'shuffle' })
  }

  const toggleRepeat = (): void => {
    setPlayer((previous) => ({ ...previous, repeat: !previous.repeat }))
    if (!demoMode) sendCommand({ type: 'repeat' })
  }

  const stepDemo = (direction: 1 | -1): void => {
    const current = playerRef.current
    const index = DEMO_QUEUE.findIndex((track) => track.title === current.title)
    const nextIndex = (Math.max(index, 0) + direction + DEMO_QUEUE.length) % DEMO_QUEUE.length
    const next = DEMO_QUEUE[nextIndex]
    setPlayer((previous) => ({
      ...previous,
      title: next.title,
      artist: next.artist,
      artwork: '',
      url: '',
      duration: next.duration,
      position: 0,
      playing: true,
      hasTrack: true
    }))
  }

  const nextTrack = (): void => {
    if (demoMode) {
      stepDemo(1)
      return
    }
    sendCommand({ type: 'next' })
  }

  const prevTrack = (): void => {
    if (demoMode) {
      stepDemo(-1)
      return
    }
    sendCommand({ type: 'prev' })
  }

  /* ---------- overlays ---------- */

  const openPalette = (): void => {
    setSettingsOpen(false)
    setPaletteOpen(true)
  }

  const openSettings = (): void => {
    setPaletteOpen(false)
    setSettingsOpen(true)
  }

  const openImmersive = (): void => {
    if (!playerRef.current.hasTrack) {
      notify('Play something first — focus mode follows the track')
      return
    }
    setPaletteOpen(false)
    setSettingsOpen(false)
    setImmersive(true)
  }

  const closeOverlays = (): void => {
    setPaletteOpen(false)
    setSettingsOpen(false)
    setImmersive(false)
  }

  const closeTopOverlay = (): void => {
    if (immersive) {
      setImmersive(false)
      return
    }
    if (settingsOpen) {
      setSettingsOpen(false)
      return
    }
    if (paletteOpen) setPaletteOpen(false)
  }

  const focusSearch = (): void => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }

  const clearCache = (): void => {
    void window.desktop?.app
      .clearCache()
      .then(() => notify('SoundCloud cache cleared'))
      .catch(() => notify('Could not clear the cache'))
  }

  const relaunch = (): void => {
    void window.desktop?.app.relaunch()
  }

  const changeSettings = (patch: Parameters<typeof updateSettings>[0]): void => {
    updateSettings(patch)
    if (patch.alwaysOnTop !== undefined) {
      void window.desktop?.app.setAlwaysOnTop(patch.alwaysOnTop)
    }
    if (patch.hideAds !== undefined && !demoMode) {
      sendCommand({ type: 'prefs', value: { hideAds: patch.hideAds } })
    }
  }

  /* ---------- latest actions for global listeners ---------- */

  const actionsRef = useRef({
    playPause,
    nextTrack,
    prevTrack,
    seek,
    changeVolume,
    toggleMute,
    toggleLike,
    toggleShuffle,
    toggleRepeat,
    reload,
    goBack,
    goForward,
    openPalette,
    openSettings,
    openImmersive,
    closeTopOverlay,
    focusSearch,
    goHome
  })
  actionsRef.current = {
    playPause,
    nextTrack,
    prevTrack,
    seek,
    changeVolume,
    toggleMute,
    toggleLike,
    toggleShuffle,
    toggleRepeat,
    reload,
    goBack,
    goForward,
    openPalette,
    openSettings,
    openImmersive,
    closeTopOverlay,
    focusSearch,
    goHome
  }

  const navigateRef = useRef(navigateTo)
  navigateRef.current = navigateTo

  /* ---------- webview lifecycle ---------- */

  useEffect(() => {
    if (demoMode) return
    const element = webviewRef.current
    if (!element) return

    const handlePlayer = (event: WebviewIpcEvent): void => {
      if (event.channel === 'sc:session') {
        const next = event.args[0] as SiteSession | undefined
        if (next && typeof next === 'object' && typeof next.status === 'string') {
          setSession(next)
        }
        return
      }
      if (event.channel !== 'sc:player') return
      const snapshot = event.args[0] as PlayerSnapshot | undefined
      if (!snapshot || typeof snapshot !== 'object') return
      // The host owns volume: the site reports its own slider, which would
      // fight the shell every 400ms. Everything else follows the page.
      setPlayer((previous) => ({ ...snapshot, volume: previous.volume }))
    }

    const applyUrl = (url: string): void => {
      if (pendingNavTarget.current && sameLocation(url, pendingNavTarget.current)) {
        clearPendingNavigation()
      }
      setLoading(false)
      syncActiveNav(url)
    }

    const handleNavigate = (event: WebviewNavigateEvent): void => {
      if (!event.isMainFrame) return
      applyUrl(event.url)
    }

    const handleFail = (event: Event): void => {
      const failure = event as Event & { errorCode?: number; isMainFrame?: boolean }
      if (failure.errorCode === -3) return
      if (failure.isMainFrame === false) return
      readyRef.current = false
      setLoading(false)
      setWebError(true)
    }

    const handleReady = (): void => {
      readyRef.current = true
      setWebReady(true)
      setWebError(false)
      syncHistory()
      element.send('sc:command', {
        type: 'prefs',
        value: { hideAds: settingsRef.current.hideAds }
      })
      element.send('sc:command', {
        type: 'volume',
        value: playerRef.current.volume
      })
      const pending = pendingUrlRef.current
      pendingUrlRef.current = null
      if (pending && pending !== DISCOVER_URL) {
        void element.loadURL(pending).catch(() => setLoading(false))
      }
    }

    const handleStart = (): void => {
      setLoading(true)
    }

    const handleStop = (): void => {
      setLoading(false)
      syncHistory()
      if (!readyRef.current) {
        readyRef.current = true
        setWebReady(true)
      }
    }

    element.addEventListener('dom-ready', handleReady)
    element.addEventListener('ipc-message', handlePlayer)
    element.addEventListener('did-navigate', handleNavigate)
    element.addEventListener('did-navigate-in-page', handleNavigate)
    element.addEventListener('did-fail-load', handleFail)
    element.addEventListener('did-start-loading', handleStart)
    element.addEventListener('did-stop-loading', handleStop)

    // SPA transitions can complete without a navigation event the host sees
    // (for example a redirect chain inside the site). A slow poll keeps the
    // sidebar highlight truthful without touching the page itself.
    const urlTimer = window.setInterval(() => {
      if (!visibleRef.current) return
      try {
        syncActiveNav(element.getURL())
      } catch {
        /* between documents */
      }
    }, 900)

    // Set src imperatively: React must not race the preload/partition attrs.
    element.setAttribute('src', DISCOVER_URL)

    return () => {
      window.clearInterval(urlTimer)
      element.removeEventListener('dom-ready', handleReady)
      element.removeEventListener('ipc-message', handlePlayer as EventListener)
      element.removeEventListener('did-navigate', handleNavigate as EventListener)
      element.removeEventListener('did-navigate-in-page', handleNavigate as EventListener)
      element.removeEventListener('did-fail-load', handleFail)
      element.removeEventListener('did-start-loading', handleStart)
      element.removeEventListener('did-stop-loading', handleStop)
    }
  }, [demoMode])

  /* ---------- app / window state ---------- */

  useEffect(() => {
    const desktop = window.desktop
    if (!desktop) return
    void desktop.app.info().then(setInfo).catch(() => undefined)
    void desktop.window.isMaximized().then(setMaximized).catch(() => undefined)
    const offMaximized = desktop.window.onMaximized(setMaximized)
    const offNavigate = desktop.onNavigate((url) => navigateRef.current(url))
    const offMedia = desktop.onMediaKey((action) => {
      if (action === 'playpause') actionsRef.current.playPause()
      else if (action === 'next') actionsRef.current.nextTrack()
      else actionsRef.current.prevTrack()
    })
    return () => {
      offMaximized()
      offNavigate()
      offMedia()
    }
  }, [])

  useEffect(() => {
    const onOnline = (): void => setOnline(true)
    const onOffline = (): void => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  useEffect(() => {
    if (!window.desktop) return
    void window.desktop.app.setAlwaysOnTop(settings.alwaysOnTop)
  }, [settings.alwaysOnTop])

  useEffect(() => {
    const element = webviewRef.current
    if (!element || !webReady || demoMode) return
    element.send('sc:command', { type: 'prefs', value: { hideAds: settings.hideAds } })
  }, [settings.hideAds, webReady, demoMode])

  useEffect(() => {
    if (player.volume <= 0) return
    const timer = window.setTimeout(() => updateSettings({ volume: player.volume }), 500)
    return () => window.clearTimeout(timer)
  }, [player.volume, updateSettings])

  const trackKey = player.hasTrack
    ? player.url || `${player.artist}|${player.title}`
    : ''

  useEffect(() => {
    if (!trackKey || demoMode) return
    const timer = window.setTimeout(() => {
      const current = playerRef.current
      if (!current.hasTrack || !current.title) return
      addRecent({
        title: current.title,
        artist: current.artist,
        url: current.url,
        artwork: current.artwork
      })
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [trackKey, demoMode, addRecent])

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current)
    }
  }, [])

  /* ---------- keyboard ---------- */

  useEffect(() => {
    const handler = (event: KeyboardEvent): void => {
      const actions = actionsRef.current
      const mod = event.ctrlKey || event.metaKey
      const key = event.key

      if (key === 'Escape') {
        actions.closeTopOverlay()
        return
      }

      if (mod && key.toLowerCase() === 'k') {
        event.preventDefault()
        actions.openPalette()
        return
      }
      if (mod && key === ',') {
        event.preventDefault()
        actions.openSettings()
        return
      }
      if (mod && key.toLowerCase() === 'r') {
        event.preventDefault()
        actions.reload()
        return
      }
      if (mod && key === 'ArrowLeft') {
        event.preventDefault()
        actions.prevTrack()
        return
      }
      if (mod && key === 'ArrowRight') {
        event.preventDefault()
        actions.nextTrack()
        return
      }
      if (event.altKey && key === 'ArrowLeft') {
        event.preventDefault()
        actions.goBack()
        return
      }
      if (event.altKey && key === 'ArrowRight') {
        event.preventDefault()
        actions.goForward()
        return
      }
      if (mod || event.altKey) return
      if (isEditableTarget(event.target)) return

      switch (key) {
        case ' ':
          event.preventDefault()
          actions.playPause()
          break
        case 'ArrowLeft':
          event.preventDefault()
          actions.seek(playerRef.current.position - 5)
          break
        case 'ArrowRight':
          event.preventDefault()
          actions.seek(playerRef.current.position + 5)
          break
        case 'ArrowUp':
          event.preventDefault()
          actions.changeVolume(playerRef.current.volume + 0.05)
          break
        case 'ArrowDown':
          event.preventDefault()
          actions.changeVolume(playerRef.current.volume - 0.05)
          break
        case '/':
          event.preventDefault()
          actions.focusSearch()
          break
        default:
          switch (key.toLowerCase()) {
            case 'm':
              actions.toggleMute()
              break
            case 'l':
              actions.toggleLike()
              break
            case 's':
              actions.toggleShuffle()
              break
            case 'r':
              actions.toggleRepeat()
              break
            case 'f':
              actions.openImmersive()
              break
            case 'h':
              actions.goHome()
              break
            default:
              break
          }
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  /* ---------- demo harness ---------- */

  useEffect(() => {
    if (!demoMode) return

    clearRecents()
    for (const track of DEMO_RECENTS) addRecent(track)
    // A deterministic signed-in account keeps the account card and the home
    // copy representative without touching the network.
    setSession({
      status: 'signed-in',
      userName: 'Avery Cole',
      avatar: '',
      profileUrl: 'https://soundcloud.com/you'
    })
    setPlayer((previous) => ({
      ...previous,
      title: 'Neon Cartography',
      artist: 'Sable Youth',
      artwork: '',
      url: '',
      duration: 214,
      position: 87,
      playing: true,
      liked: true,
      hasTrack: true,
      volume: bootVolumeRef.current > 0 ? bootVolumeRef.current : 0.8
    }))
    lastVolumeRef.current = bootVolumeRef.current > 0 ? bootVolumeRef.current : 0.8
  }, [demoMode, addRecent, clearRecents])

  useEffect(() => {
    if (!demoMode) return
    window.__cloudwave = {
      demo(kind) {
        if (kind === 'web') {
          visibleRef.current = true
          setView('demo')
          setActiveNav('discover')
          setPaletteOpen(false)
          setSettingsOpen(false)
          setImmersive(false)
          return
        }
        if (kind === 'immersive') {
          setPaletteOpen(false)
          setSettingsOpen(false)
          setImmersive(true)
          return
        }
        visibleRef.current = false
        setView('home')
        setActiveNav('home')
        setImmersive(false)
        setPaletteOpen(kind === 'palette')
        setSettingsOpen(kind === 'settings')
      },
      setPlayer(patch) {
        setPlayer((previous) => ({ ...previous, ...patch }))
      },
      addRecent(track) {
        addRecent(track)
      }
    }
    return () => {
      delete window.__cloudwave
    }
  }, [demoMode, addRecent])

  const version = info?.version ?? '0.1.0'
  const connectedLabel = online ? 'Connected' : 'Offline'

  return (
    <div
      className="app"
      data-collapsed={settings.sidebarCollapsed}
      data-immersive={immersive}
    >
      <TitleBar
        collapsed={settings.sidebarCollapsed}
        onToggleSidebar={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
        searchRef={searchRef}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSearchSubmit={submitSearch}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onBack={goBack}
        onForward={goForward}
        online={online}
        loading={loading}
        maximized={maximized}
        onOpenPalette={openPalette}
        onOpenSettings={openSettings}
        onConnectionClick={() => {
          if (!online) {
            notify('You are offline — reconnect and try again')
            return
          }
          reload()
        }}
      />

      <div className="workspace">
        <Sidebar
          activeNav={activeNav}
          collapsed={settings.sidebarCollapsed}
          recents={recents}
          showRecents={settings.showRecents}
          version={version}
          session={session}
          onNavigate={navigate}
          onOpenTrack={openTrack}
          onSignIn={openSignIn}
          onOpenProfile={openProfile}
          onToggleCollapsed={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
          onOpenSettings={openSettings}
        />

        <main className="main">
          <div className="stage">
            {demoMode ? null : (
              <div className="web-host" data-visible={view === 'web'} data-ready={webReady}>
                <webview
                  ref={webviewRef}
                  className="webview"
                  partition="persist:soundcloud"
                  preload={sitePreloadUrl || undefined}
                  allowpopups
                />
              </div>
            )}

            {view === 'web' && !webReady && !webError ? (
              <div className="web-placeholder">
                <div className="web-boot">
                  <span className="boot-orbit" aria-hidden="true" />
                  <span>Warming up SoundCloud…</span>
                </div>
              </div>
            ) : null}

            {view === 'demo' ? (
              <div className="demo-stage">
                <div className="demo-stage-card">
                  <BrandMark />
                  <strong>SoundCloud is disabled in demo mode</strong>
                  <p>
                    This demo build skips the embedded page so screenshots stay deterministic.
                    The real app loads soundcloud.com inside this frame.
                  </p>
                  <button type="button" className="btn btn-ghost" onClick={goHome}>
                    <ArrowLeft aria-hidden="true" />
                    Back to Home
                  </button>
                </div>
              </div>
            ) : null}

            {view === 'home' ? (
              <HomeView
                player={player}
                recents={recents}
                settings={settings}
                online={online}
                version={version}
                session={session}
                onNavigate={navigate}
                onOpenTrack={openTrack}
                onOpenPalette={openPalette}
                onOpenSettings={openSettings}
                onSignIn={openSignIn}
              />
            ) : null}

            {view === 'web' && webError ? (
              <div className="stage-error">
                <div className="stage-error-card">
                  <div className="error-icon">
                    <WifiOff aria-hidden="true" />
                  </div>
                  <h2>SoundCloud did not load</h2>
                  <p>
                    Check your connection and try again. Your sign-in, library and recently
                    played tracks are untouched.
                  </p>
                  <div className="error-actions">
                    <button type="button" className="btn btn-primary" onClick={reload}>
                      <RotateCw aria-hidden="true" />
                      Try again
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={goHome}>
                      Back to Home
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <PlayerBar
        player={player}
        onPlayPause={playPause}
        onNext={nextTrack}
        onPrev={prevTrack}
        onSeek={seek}
        onVolumeChange={changeVolume}
        onToggleMute={toggleMute}
        onToggleLike={toggleLike}
        onToggleShuffle={toggleShuffle}
        onToggleRepeat={toggleRepeat}
        onOpenImmersive={openImmersive}
        onOpenHome={goHome}
        onOpenSettings={openSettings}
      />

      {paletteOpen || settingsOpen ? (
        <div
          className="scrim"
          onClick={() => {
            setPaletteOpen(false)
            setSettingsOpen(false)
          }}
        />
      ) : null}

      {paletteOpen ? (
        <CommandPalette
          recents={recents}
          onClose={() => setPaletteOpen(false)}
          onNavigate={navigate}
          onOpenTrack={openTrack}
          onSearch={submitSearch}
          onOpenSettings={openSettings}
          onOpenImmersive={openImmersive}
          onReload={reload}
          onBack={goBack}
          onForward={goForward}
        />
      ) : null}

      {settingsOpen ? (
        <SettingsPanel
          settings={settings}
          info={info}
          recentsCount={recents.length}
          onChange={changeSettings}
          onClearRecents={() => {
            clearRecents()
            notify('Recently played cleared')
          }}
          onClearCache={clearCache}
          onRelaunch={relaunch}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}

      {immersive ? (
        <NowPlayingOverlay
          player={player}
          onClose={() => setImmersive(false)}
          onPlayPause={playPause}
          onNext={nextTrack}
          onPrev={prevTrack}
          onSeek={seek}
          onVolumeChange={changeVolume}
          onToggleMute={toggleMute}
          onToggleLike={toggleLike}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={toggleRepeat}
          onOpenSource={openSource}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          <Info aria-hidden="true" />
          {toast.message}
        </div>
      ) : null}
    </div>
  )
}
