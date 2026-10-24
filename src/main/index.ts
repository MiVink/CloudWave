import {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  session,
  shell,
  type WebContents
} from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PARTITION = 'persist:soundcloud'
const isDev = !app.isPackaged

let mainWindow: BrowserWindow | null = null
let saveTimer: NodeJS.Timeout | null = null

interface WindowState {
  width: number
  height: number
  x?: number
  y?: number
  maximized?: boolean
}

const windowStatePath = (): string => join(app.getPath('userData'), 'window-state.json')

function readWindowState(): WindowState {
  try {
    if (!existsSync(windowStatePath())) return { width: 1440, height: 920 }
    const parsed = JSON.parse(readFileSync(windowStatePath(), 'utf8')) as Partial<WindowState>
    return {
      width: Math.max(1040, Number(parsed.width) || 1440),
      height: Math.max(680, Number(parsed.height) || 920),
      x: typeof parsed.x === 'number' ? parsed.x : undefined,
      y: typeof parsed.y === 'number' ? parsed.y : undefined,
      maximized: Boolean(parsed.maximized)
    }
  } catch {
    return { width: 1440, height: 920 }
  }
}

function saveWindowState(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const bounds = mainWindow.isMaximized() ? mainWindow.getNormalBounds() : mainWindow.getBounds()
    const state: WindowState = { ...bounds, maximized: mainWindow.isMaximized() }
    try {
      writeFileSync(windowStatePath(), JSON.stringify(state, null, 2), 'utf8')
    } catch {
      /* state is a nicety, never fatal */
    }
  }, 400)
}

function chromeUserAgent(): string {
  return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`
}

// SoundCloud serves a degraded experience to anything that looks like Electron.
app.userAgentFallback = chromeUserAgent()

function isSoundCloudUrl(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url)
    return protocol === 'https:' && (hostname === 'soundcloud.com' || hostname.endsWith('.soundcloud.com'))
  } catch {
    return false
  }
}

/**
 * SoundCloud's sign-in buttons call `window.open` and hand the flow to an
 * identity provider. A deny-only window-open handler is what produced the
 * "Please enable popup windows" wall, so auth popups are allowed in a
 * controlled, partitioned child window instead.
 *
 * Only identity providers SoundCloud actually uses are listed. Everything else
 * still opens in the system browser, and no popup ever gets Node access.
 */
const AUTH_HOSTS = [
  'soundcloud.com',
  'google.com',
  'googleusercontent.com',
  'gstatic.com',
  'facebook.com',
  'fbcdn.net',
  'apple.com',
  'appleid.apple.com'
]

function isAuthHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return AUTH_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

function isAuthUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && isAuthHost(hostname)
  } catch {
    return false
  }
}

function openExternal(url: string): void {
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
}

/**
 * Popups share the SoundCloud partition, so an OAuth round-trip lands back in
 * the same signed-in session the embedded page uses. A child window that tries
 * to leave the auth allowlist is sent to the system browser instead.
 */
function applyPopupPolicy(contents: WebContents): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAuthUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 760,
          minWidth: 420,
          minHeight: 560,
          parent: mainWindow ?? undefined,
          modal: false,
          show: true,
          autoHideMenuBar: true,
          backgroundColor: '#0a0a0e',
          title: 'Sign in to SoundCloud',
          webPreferences: {
            partition: PARTITION,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            webSecurity: true,
            spellcheck: false
          }
        }
      }
    }

    openExternal(url)
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    if (isAuthUrl(url)) return
    event.preventDefault()
    openExternal(url)
  })

  // Server-side redirects do not fire `will-navigate`; without this an OAuth
  // bounce could carry the guest to an origin outside the allowlist.
  contents.on('will-redirect', (event, url) => {
    if (isAuthUrl(url)) return
    event.preventDefault()
    openExternal(url)
  })

  contents.on('did-create-window', (child) => {
    // The event hands back a BrowserWindow, while the policy works on
    // WebContents so it can recurse into popups opened by popups.
    applyPopupPolicy(child.webContents)
    child.setMenu(null)
  })
}

function createWindow(): void {
  const state = readWindowState()

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: '#0a0a0e',
    roundedCorners: true,
    title: 'Cloudwave',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: true
    }
  })

  mainWindow.setMenu(null)
  if (state.maximized) mainWindow.maximize()

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  const sendMaximized = (): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    mainWindow.webContents.send('win:maximized', mainWindow.isMaximized())
  }
  mainWindow.on('maximize', sendMaximized)
  mainWindow.on('unmaximize', sendMaximized)
  mainWindow.on('resize', saveWindowState)
  mainWindow.on('move', saveWindowState)
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Harden and normalise every embedded SoundCloud view.
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = false
    webPreferences.webSecurity = true
    params.partition = PARTITION
    if (!isSoundCloudUrl(params.src)) params.src = 'https://soundcloud.com/discover'
  })

  mainWindow.webContents.on('did-attach-webview', (_event, contents) => {
    contents.setUserAgent(chromeUserAgent())
    // One policy object owns navigation and popups for the guest and every
    // popup it opens. Adding a second `will-navigate` guard here used to block
    // in-page OAuth redirects to Google/Apple before the allowlist saw them.
    applyPopupPolicy(contents)
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Local media shortcuts. SoundCloud itself registers MediaSession handlers
  // in the webview, which Electron does not wire to OS keys on Windows.
  const send = (channel: string): void => {
    mainWindow?.webContents.send(channel)
  }
  globalShortcut.register('MediaPlayPause', () => send('media:playpause'))
  globalShortcut.register('MediaNextTrack', () => send('media:next'))
  globalShortcut.register('MediaPreviousTrack', () => send('media:prev'))
}

app.whenReady().then(() => {
  const scSession = session.fromPartition(PARTITION)
  scSession.setUserAgent(chromeUserAgent())

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

ipcMain.on('win:minimize', () => mainWindow?.minimize())
ipcMain.on('win:maximize', () => {
  if (!mainWindow) return
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize()
})
ipcMain.on('win:close', () => mainWindow?.close())
ipcMain.handle('win:is-maximized', () => mainWindow?.isMaximized() ?? false)
ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  platform: process.platform
}))
ipcMain.handle('app:open-external', (_event, url: string) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) return shell.openExternal(url)
  return false
})
ipcMain.handle('app:clear-cache', async () => {
  const scSession = session.fromPartition(PARTITION)
  await scSession.clearCache()
  return true
})
ipcMain.handle('app:set-always-on-top', (_event, value: boolean) => {
  mainWindow?.setAlwaysOnTop(Boolean(value))
  return Boolean(value)
})
ipcMain.handle('app:relaunch', () => {
  app.relaunch()
  app.exit(0)
})
