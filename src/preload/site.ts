/**
 * Runs INSIDE the SoundCloud <webview>.
 *
 * Responsibilities:
 *  1. Inject a small CSS layer that hides SoundCloud's own chrome and ads so the
 *     native shell can own the frame.
 *  2. Snapshot what the site player is doing (track, progress, volume, likes)
 *     and ship it to the host renderer over `sendToHost`.
 *  3. Accept commands from the host player bar and drive the real site player.
 *
 * SoundCloud is a React SPA and its class names are not a public API. Every
 * selector here is best-effort with fallbacks (audio element + ARIA values),
 * and failing to find one must never break playback.
 */
import { ipcRenderer } from 'electron'
import type { PlayerCommand, PlayerSnapshot, SiteSession } from '../shared/types'
import { upgradeArtworkUrl } from '../shared/artwork'

const STYLE_ID = 'cloudwave-shell-style'
const POLL_MS = 400

let lastSerialized = ''
let lastSessionSerialized = ''
let commandInFlight = false

const $ = <T extends Element = Element>(selector: string): T | null =>
  document.querySelector<T>(selector)

const $$ = <T extends Element = Element>(selector: string): T[] =>
  Array.from(document.querySelectorAll<T>(selector))

function textOf(element: Element | null): string {
  if (!element) return ''
  const clone = element.cloneNode(true) as Element
  clone.querySelectorAll('.sc-visuallyhidden, .visuallyhidden, [aria-hidden="true"]').forEach((node) => node.remove())
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function parseClock(raw: string): number {
  const value = raw.trim()
  if (!value) return 0
  const parts = value.split(':').map((part) => Number.parseInt(part, 10))
  if (parts.some((part) => Number.isNaN(part))) return 0
  return parts.reduce((total, part) => total * 60 + part, 0)
}

function audioElement(): HTMLAudioElement | null {
  return document.querySelector<HTMLAudioElement>('audio')
}

function imageUrlOf(element: Element | null): string {
  if (!element) return ''
  if (element instanceof HTMLImageElement) return element.currentSrc || element.src
  const background = getComputedStyle(element).backgroundImage
  const match = /url\(["']?(.*?)["']?\)/.exec(background)
  return match?.[1] ?? ''
}

function readArtwork(): string {
  const selectors = [
    '.playbackSoundBadge__avatar .image__lightOutline span',
    '.playbackSoundBadge__avatar span',
    '.playbackSoundBadge__avatar img'
  ]
  for (const selector of selectors) {
    const element = $(selector)
    if (!element) continue
    const url = imageUrlOf(element)
    if (url) return upgradeArtworkUrl(url)
  }
  const media = navigator.mediaSession?.metadata
  const fallback = media?.artwork?.[media.artwork.length - 1]?.src ?? ''
  return upgradeArtworkUrl(fallback)
}

function readTitle(): string {
  const domTitle = textOf($('.playbackSoundBadge__titleLink'))
  if (domTitle) return domTitle
  return navigator.mediaSession?.metadata?.title ?? ''
}

function readArtist(): string {
  const domArtist = textOf($('.playbackSoundBadge__lightLink'))
  if (domArtist) return domArtist
  return navigator.mediaSession?.metadata?.artist ?? ''
}

function readUrl(): string {
  const link = $<HTMLAnchorElement>('.playbackSoundBadge__titleLink')
  if (link?.href) return link.href
  return ''
}

function isSelected(element: Element | null): boolean {
  if (!element) return false
  return (
    element.classList.contains('sc-button-selected') ||
    element.classList.contains('selected') ||
    element.classList.contains('playing') ||
    element.getAttribute('aria-pressed') === 'true'
  )
}

function readSnapshot(): PlayerSnapshot {
  const audio = audioElement()
  const progress = $<HTMLElement>('.playbackTimeline__progressWrapper, [role="slider"].playbackTimeline__progressWrapper')
  const ariaNow = Number(progress?.getAttribute('aria-valuenow'))
  const timePassed = parseClock(textOf($('.playbackTimeline__timePassed')))
  const duration = audio && Number.isFinite(audio.duration) && audio.duration > 0
    ? audio.duration
    : parseClock(textOf($('.playbackTimeline__duration')))

  const position = Number.isFinite(ariaNow) && ariaNow >= 0 && ariaNow > 0
    ? ariaNow
    : timePassed || audio?.currentTime || 0

  const playButton = $('.playControls__play')
  const playing = audio
    ? !audio.paused
    : isSelected(playButton) || (playButton?.getAttribute('aria-label') ?? '').toLowerCase().includes('pause')

  const volumeSlider = $<HTMLElement>('.volume__sliderWrapper, [role="slider"].volume__sliderWrapper')
  const ariaVolume = Number(volumeSlider?.getAttribute('aria-valuenow'))
  const volume = audio
    ? audio.volume
    : Number.isFinite(ariaVolume) && ariaVolume >= 0
      ? ariaVolume / 100
      : 0.8

  const title = readTitle()
  const artist = readArtist()

  return {
    title,
    artist,
    artwork: readArtwork(),
    url: readUrl(),
    playing,
    position: position || 0,
    duration: duration || 0,
    volume: Math.min(1, Math.max(0, volume)),
    liked: isSelected($('.playbackSoundBadge__like')),
    shuffle: isSelected($('.playControls__shuffle')),
    repeat: isSelected($('.playControls__repeat')),
    hasTrack: Boolean(title || (audio && audio.currentSrc))
  }
}

function pushSnapshot(force = false): void {
  const snapshot = readSnapshot()
  const serialized = JSON.stringify(snapshot)
  if (!force && serialized === lastSerialized) return
  lastSerialized = serialized
  ipcRenderer.sendToHost('sc:player', snapshot)
}

/**
 * Read the account state from the rendered header. The header is moved
 * offscreen by the shell CSS, but it is still in the DOM and still updated by
 * SoundCloud's own session code, so this stays honest without touching cookies
 * or tokens. Everything here is best-effort: `unknown` is a valid answer.
 *
 * Two traps, both confirmed against the live site:
 *   1. Guests still see the "Library" nav item (`a[href="/you/library"]`), so a
 *      `/you` link alone must never be treated as proof of a session.
 *   2. Signed-out sessions render "Sign in" / "Create account" in
 *      `.header__loginMenu`, in the same slot a signed-in avatar occupies.
 */
function readSession(): SiteSession {
  const header = document.querySelector<HTMLElement>('header.header') ?? document.querySelector<HTMLElement>('header')
  if (!header) {
    return { status: 'unknown', userName: '', avatar: '', profileUrl: '' }
  }

  const signIn = header.querySelector(
    '.header__loginMenu .loginButton, .header__loginMenu .signupButton, a[href="/signin"], a[href^="/signin?"], a[href^="/signin/"]'
  )
  if (signIn) {
    return { status: 'signed-out', userName: '', avatar: '', profileUrl: '' }
  }

  // The avatar can live on an <img>, a background-image span, or the anchor
  // itself depending on which header variant SoundCloud ships today.
  let avatar = ''
  for (const selector of [
    '.header__userNavAvatar img',
    '.header__userNav img',
    '.header__userNavAvatar',
    '.userNav__avatar',
    'a[href^="/you"] img',
    'a[href^="/you"] span[style*="background-image"]',
    'img[class*="avatar" i]'
  ]) {
    avatar = upgradeArtworkUrl(imageUrlOf(header.querySelector(selector)))
    if (avatar) break
  }

  let userName = ''
  for (const selector of ['.header__userNavName', '.userNav__name', '[class*="userNav" i] [aria-label]']) {
    const element = header.querySelector(selector)
    userName = textOf(element) || element?.getAttribute('aria-label')?.trim() || ''
    if (userName) break
  }
  // Accessible labels such as "Your profile" describe the control, not the user.
  if (/^(your profile|profile|account|settings and more|menu)$/i.test(userName)) userName = ''

  const profileLink = header.querySelector<HTMLAnchorElement>('a[href^="/you"]:not([href="/you/library"])')
  const hasAccountMarker = Boolean(avatar || profileLink || header.querySelector('.header__userNav, .userNav'))

  if (hasAccountMarker) {
    return {
      status: 'signed-in',
      userName,
      avatar,
      profileUrl: profileLink?.href || 'https://soundcloud.com/you'
    }
  }

  return { status: 'unknown', userName: '', avatar: '', profileUrl: '' }
}

function pushSession(force = false): void {
  const session = readSession()
  const serialized = JSON.stringify(session)
  if (!force && serialized === lastSessionSerialized) return
  lastSessionSerialized = serialized
  ipcRenderer.sendToHost('sc:session', session)
}

function click(selector: string): boolean {
  const element = $<HTMLElement>(selector)
  if (!element) return false
  element.click()
  return true
}

function seekTo(seconds: number): void {
  const audio = audioElement()
  if (audio && Number.isFinite(audio.duration)) {
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration))
    return
  }

  const slider = $<HTMLElement>('.playbackTimeline__progressWrapper')
  if (!slider) return
  const duration = readSnapshot().duration
  if (!duration) return
  const rect = slider.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, seconds / duration))
  const x = rect.left + rect.width * ratio
  const y = rect.top + rect.height / 2
  for (const type of ['mousedown', 'mousemove', 'mouseup']) {
    slider.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, buttons: 1 }))
  }
  slider.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }))
}

function setVolume(value: number): void {
  const audio = audioElement()
  const clamped = Math.max(0, Math.min(1, value))
  if (audio) audio.volume = clamped

  const slider = $<HTMLElement>('.volume__sliderWrapper')
  if (!slider) return
  const rect = slider.getBoundingClientRect()
  if (!rect.width) return
  const x = rect.left + rect.width * clamped
  const y = rect.top + rect.height / 2
  for (const type of ['mousedown', 'mousemove', 'mouseup']) {
    slider.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, buttons: 1 }))
  }
}

function normalizePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed || '/'
}

/**
 * Ask SoundCloud's own router to move instead of reloading the document.
 *
 * A document load destroys the audio element, which is why the shell used to
 * lose playback whenever a sidebar link was clicked. Clicking an existing
 * anchor lets the site's SPA handle the transition and keeps the player alive.
 * The host still falls back to `loadURL` when no anchor can be found.
 */
function navigateInPage(rawUrl: string): boolean {
  let target: URL
  try {
    target = new URL(rawUrl, location.href)
  } catch {
    return false
  }
  if (target.origin !== location.origin) return false

  const wanted = normalizePath(target.pathname)
  const matches: { link: HTMLAnchorElement; score: number }[] = []

  for (const link of $$<HTMLAnchorElement>('a[href]')) {
    let candidate: URL
    try {
      candidate = new URL(link.href)
    } catch {
      continue
    }
    if (candidate.origin !== target.origin) continue
    if (normalizePath(candidate.pathname) !== wanted) continue
    matches.push({ link, score: candidate.search === target.search ? 2 : 1 })
  }

  matches.sort((a, b) => b.score - a.score)
  const match = matches[0]?.link
  if (!match) return false
  match.click()
  return true
}

function settleConsent(): void {
  // SoundCloud shows a OneTrust consent wall on a fresh profile. Rejecting
  // non-essential cookies is the privacy-preserving default and keeps the
  // embedded surface interactive without a modal covering the page.
  const reject = document.getElementById('onetrust-reject-all-handler')
  if (reject instanceof HTMLButtonElement) {
    reject.click()
    document.documentElement.dataset.cloudwaveConsent = 'rejected'
  }
  document.getElementById('onetrust-consent-sdk')?.remove()
  document.querySelector('.onetrust-pc-dark-filter')?.remove()
  document.body.classList.remove('ot-overflow-hidden', 'ot-position-relative')
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    /* Cloudwave shell: hide the site's own chrome, keep its content */
    header.header,
    header.sc-classicHeader,
    .sc-classicHeader,
    .header.sc-classicHeader,
    .playControls {
      /* Moved offscreen (not display:none) so SoundCloud can still measure the
         timeline slider and our synthetic seek clicks land on real geometry. */
      position: fixed !important;
      left: 0 !important;
      right: 0 !important;
      bottom: -200px !important;
      height: 0 !important;
      min-height: 0 !important;
      overflow: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
      z-index: -1 !important;
    }

    /* Cookie banner fallback. The preload clicks "Reject all" on first run;
       this keeps the surface usable even if OneTrust changes its markup. */
    #onetrust-consent-sdk,
    .onetrust-pc-dark-filter {
      display: none !important;
    }

    /* Give the embedded product a calm canvas */
    html, body {
      background: #0a0a0e !important;
      overflow-x: hidden !important;
    }

    /* Ads and upsells — controlled from Cloudwave settings */
    html[data-cloudwave-hide-ads="true"] .promotion,
    html[data-cloudwave-hide-ads="true"] .sc-ad,
    html[data-cloudwave-hide-ads="true"] [data-testid="ads"],
    html[data-cloudwave-hide-ads="true"] .header__upsell,
    html[data-cloudwave-hide-ads="true"] .sidebarBanner,
    html[data-cloudwave-hide-ads="true"] .signinBanner,
    html[data-cloudwave-hide-ads="true"] .interstitial,
    html[data-cloudwave-hide-ads="true"] .l-product-banners,
    html[data-cloudwave-hide-ads="true"] .mobileApps {
      display: none !important;
    }

    /* The site's header is offscreen, so reclaim its reserved top padding. */
    .l-content {
      padding-top: 0 !important;
    }

    /* SoundCloud locks the product into a 1240px column and parks its legal
       links in a 360px right rail. Cloudwave owns the frame, so the embedded
       page is allowed to use the full stage: no dead right column, no page
       footer competing with the native player. */
    .l-container,
    .l-container.l-content,
    .l-container.l-fullwidth,
    #content {
      width: 100% !important;
      max-width: none !important;
    }

    .l-content {
      padding-left: 24px !important;
      padding-right: 24px !important;
    }

    .l-main {
      width: 100% !important;
      max-width: none !important;
      float: none !important;
      padding-right: 0 !important;
    }

    /* Any page-level rail (related tracks, suggestions) stacks under the main
       column instead of reserving a fixed strip on the right. */
    .l-sidebar {
      float: none !important;
      width: 100% !important;
      max-width: none !important;
    }

    /* SoundCloud's desktop tile grids are hard-coded to five columns, which
       leaves a wide empty band at 1440px+ once the container is unclamped.
       auto-fill keeps the tiles a sensible size and fills the row at every
       window width. */
    .badgeList,
    .soundBadgeList {
      display: grid !important;
      grid-template-columns: repeat(auto-fill, minmax(164px, 1fr)) !important;
      gap: 18px 16px !important;
    }

    .badgeList__item,
    .soundBadgeList__item {
      width: auto !important;
      margin: 0 !important;
    }

    .l-footer {
      display: none !important;
    }

    /* Slimmer, darker scrollbars */
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,.14);
      border-radius: 999px;
      border: 2px solid transparent;
      background-clip: padding-box;
    }
    ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.24); background-clip: padding-box; }
  `
  document.documentElement.appendChild(style)
}

ipcRenderer.on('sc:command', (_event, command: PlayerCommand) => {
  // Dragging a slider produces a burst of commands; those are safe to queue
  // immediately instead of being dropped by the single-flight guard.
  if (commandInFlight && command.type !== 'volume' && command.type !== 'seek') return
  commandInFlight = true
  try {
    switch (command.type) {
      case 'playpause':
        if (!click('.playControls__play')) {
          const audio = audioElement()
          if (audio) void (audio.paused ? audio.play() : audio.pause())
        }
        break
      case 'next':
        click('.playControls__next')
        break
      case 'prev':
        click('.playControls__prev')
        break
      case 'seek':
        seekTo(Number(command.value) || 0)
        break
      case 'volume':
        setVolume(Number(command.value) || 0)
        break
      case 'like':
        click('.playbackSoundBadge__like')
        break
      case 'shuffle':
        click('.playControls__shuffle')
        break
      case 'repeat':
        click('.playControls__repeat')
        break
      case 'prefs':
        document.documentElement.dataset.cloudwaveHideAds = String(Boolean(command.value?.hideAds))
        break
      case 'navigate':
        navigateInPage(String(command.value?.url ?? ''))
        break
      case 'reload':
        location.reload()
        break
    }
  } finally {
    setTimeout(() => {
      commandInFlight = false
      pushSnapshot(true)
    }, 120)
  }
})

function boot(): void {
  if (!document.documentElement.dataset.cloudwaveHideAds) {
    document.documentElement.dataset.cloudwaveHideAds = 'true'
  }
  injectStyles()
  settleConsent()
  // SPA route changes can replace the header/player; re-assert periodically.
  setInterval(injectStyles, 2000)
  // OneTrust can mount a few seconds after the first paint.
  let consentTicks = 0
  const consentTimer = setInterval(() => {
    settleConsent()
    consentTicks += 1
    if (consentTicks > 8) clearInterval(consentTimer)
  }, 1000)

  for (const event of ['play', 'pause', 'timeupdate', 'loadedmetadata', 'volumechange', 'ended']) {
    document.addEventListener(event, () => pushSnapshot(), true)
  }
  document.addEventListener('DOMContentLoaded', () => {
    injectStyles()
    pushSnapshot(true)
    pushSession(true)
  })
  setInterval(() => pushSnapshot(), POLL_MS)
  // Account state changes rarely (sign-in, sign-out, avatar load), so a slower
  // poll is enough and keeps the shell's account card honest. Every other tick
  // is forced: a host that attached its listener after the first push (a late
  // mount, a reload, the live harness) still learns the state instead of
  // waiting for the account to change.
  let sessionTicks = 0
  setInterval(() => {
    sessionTicks += 1
    pushSession(sessionTicks % 2 === 0)
  }, 1500)
  pushSnapshot(true)
  pushSession(true)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true })
} else {
  boot()
}
