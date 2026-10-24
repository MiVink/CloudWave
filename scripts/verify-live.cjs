/**
 * Live verification harness.
 *
 * Boots the production renderer WITHOUT demo mode, mounts the real
 * soundcloud.com <webview>, and reports whether:
 *   1. the webview attaches and finishes loading,
 *   2. the site preload injected its style layer,
 *   3. the host player received a snapshot (i.e. sendToHost works).
 *
 * Writes screenshots/live.png for visual review.
 *
 *   npm run build
 *   npm run verify:live
 */
const { app, BrowserWindow, ipcMain, session, webContents } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

const ROOT = join(__dirname, '..')
const RENDERER = join(ROOT, 'out', 'renderer', 'index.html')
const PRELOAD = join(ROOT, 'out', 'preload', 'index.js')
const PARTITION = 'persist:soundcloud-live-check'
const TIMEOUT_MS = 75000

app.setPath('userData', join(tmpdir(), 'cloudwave-live-check'))
app.userAgentFallback = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome} Safari/537.36`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function registerIpc() {
  ipcMain.on('win:minimize', () => {})
  ipcMain.on('win:maximize', () => {})
  ipcMain.on('win:close', () => {})
  ipcMain.handle('win:is-maximized', () => false)
  ipcMain.handle('app:info', () => ({
    version: '0.1.0',
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform
  }))
  ipcMain.handle('app:open-external', () => true)
  ipcMain.handle('app:clear-cache', () => true)
  ipcMain.handle('app:set-always-on-top', () => false)
  ipcMain.handle('app:relaunch', () => true)
}

async function main() {
  const report = {
    attached: false,
    loaded: false,
    preload: false,
    snapshot: false,
    url: '',
    title: '',
    session: null,
    errors: []
  }

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    show: true,
    frame: false,
    backgroundColor: '#0a0a0e',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      backgroundThrottling: false
    }
  })

  win.webContents.on('console-message', (event) => {
    if (event.level === 'error' || event.level === 'warning') {
      report.errors.push(`[host:${event.level}] ${event.message}`)
    }
  })

  win.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
    webPreferences.sandbox = false
    webPreferences.webSecurity = true
    params.partition = PARTITION
    if (!/^https:\/\/([a-z0-9-]+\.)*soundcloud\.com\//.test(params.src)) {
      params.src = 'https://soundcloud.com/discover'
    }
  })

  win.webContents.on('did-attach-webview', (_event, contents) => {
    report.attached = true
    contents.setUserAgent(app.userAgentFallback)
    contents.on('console-message', (event) => {
      if (event.level === 'error') report.errors.push(`[site] ${event.message}`)
    })
    contents.on('did-finish-load', () => {
      report.loaded = true
      report.url = contents.getURL()
      report.title = contents.getTitle()
      console.log(`  webview loaded: ${report.url}`)
      console.log(`  webview title:  ${report.title}`)
    })
    contents.on('did-fail-load', (_e, code, description) => {
      if (code !== -3) report.errors.push(`[load ${code}] ${description}`)
    })
  })

  await win.loadFile(RENDERER)
  console.log('  host renderer loaded')

  // Wait for the webview to exist, then poll its DOM for the injected preload.
  const deadline = Date.now() + TIMEOUT_MS
  let webviewId = null
  while (Date.now() < deadline) {
    try {
      webviewId = await win.webContents.executeJavaScript(
        `(() => {
           const wv = document.querySelector('webview')
           if (!wv) return null
           try { return wv.getWebContentsId() } catch { return null }
         })()`,
        true
      )
    } catch {
      /* webview not ready yet */
    }
    if (webviewId) break
    await sleep(500)
  }

  if (!webviewId) {
    report.errors.push('webview never appeared in the DOM')
  } else {
    console.log(`  webview attached (webContents ${webviewId})`)

    // Listen for the preload's snapshots on the host side before polling.
    await win.webContents.executeJavaScript(
      `(() => {
         window.__cloudwaveSnapshots = []
         window.__cloudwaveSessions = []
         const wv = document.querySelector('webview')
         if (!wv) return false
         wv.addEventListener('ipc-message', (event) => {
           if (event.channel === 'sc:player' && event.args && event.args[0]) {
             window.__cloudwaveSnapshots.push(event.args[0])
           }
           if (event.channel === 'sc:session' && event.args && event.args[0]) {
             window.__cloudwaveSessions.push(event.args[0])
           }
         })
         return true
       })()`,
      true
    )

    const site = webContents.fromId(webviewId)
    while (Date.now() < deadline) {
      try {
        const state = await site.executeJavaScript(
          `({
             style: document.getElementById('cloudwave-shell-style') !== null,
             flag: document.documentElement.dataset.cloudwaveHideAds === 'true',
             title: document.title
           })`,
          true
        )
        if (state.style && state.flag) {
          report.preload = true
          report.title = state.title
          break
        }
      } catch {
        /* site still loading */
      }
      await sleep(700)
    }

    // A snapshot landing on the host proves the site preload -> host IPC path.
    const snapshotDeadline = Date.now() + 15000
    while (Date.now() < snapshotDeadline) {
      try {
        const snap = await win.webContents.executeJavaScript(
          `window.__cloudwaveSnapshots.length
             ? window.__cloudwaveSnapshots[window.__cloudwaveSnapshots.length - 1]
             : null`,
          true
        )
        if (snap) {
          report.snapshot = true
          report.latestSnapshot = snap
          break
        }
      } catch {
        /* host not ready */
      }
      await sleep(500)
    }

    // The site preload reports the account state it can see in the header.
    // `signed-out` is a real answer here; this is not a login test. The preload
    // re-sends every few seconds, so wait for the first event instead of
    // assuming it already arrived.
    const sessionDeadline = Date.now() + 10000
    while (Date.now() < sessionDeadline) {
      try {
        const sessions = await win.webContents.executeJavaScript(
          `window.__cloudwaveSessions.length
             ? window.__cloudwaveSessions[window.__cloudwaveSessions.length - 1]
             : null`,
          true
        )
        if (sessions) {
          report.session = sessions
          break
        }
      } catch {
        /* host not ready */
      }
      await sleep(500)
    }

    // Show the embedded page itself, so the live frame is reviewable too.
    await sleep(900)
    const homeImage = await win.webContents.capturePage()
    mkdirSync(join(ROOT, 'screenshots'), { recursive: true })
    writeFileSync(join(ROOT, 'screenshots', 'live.png'), homeImage.toPNG())
    console.log('  captured screenshots/live.png')

    try {
      // Switch the host to the embedded site the way a user does: click the
      // sidebar destination. The Home hero button only exists for a signed-in
      // session, so it is not a reliable way to reveal the webview.
      const reveal = async (destinationId) => {
        const clicked = await win.webContents.executeJavaScript(
          `(() => {
             const target = document.querySelector('[data-destination="${destinationId}"]')
             if (target) target.click()
             return Boolean(target)
           })()`,
          true
        )
        if (!clicked) throw new Error(`sidebar destination "${destinationId}" not found`)
      }

      // SoundCloud paints a logo splash while the SPA hydrates, so a fixed
      // sleep captures a blank frame. Wait for real copy in the main column.
      const waitForContent = async (deadlineMs = 20000) => {
        const deadline = Date.now() + deadlineMs
        while (Date.now() < deadline) {
          try {
            const length = await site.executeJavaScript(
              `(() => {
                 const main = document.querySelector('.l-main') || document.body
                 return (main.innerText || '').trim().length
               })()`,
              true
            )
            if (length > 160) return length
          } catch {
            /* guest still navigating */
          }
          await sleep(500)
        }
        return 0
      }

      // Compact layout facts: is the page using the full stage, and is the
      // site footer/rail (the old Charts dead column) still in the layout?
      const describePage = async () => {
        const page = await site.executeJavaScript(
          `(() => {
             const rect = (selector) => {
               const el = document.querySelector(selector)
               if (!el) return null
               const r = el.getBoundingClientRect()
               return { w: Math.round(r.width), x: Math.round(r.x), h: Math.round(r.height) }
             }
             const footer = document.querySelector('.l-footer')
             const rail = document.querySelector('.l-sidebar')
             return {
               href: location.href.replace('https://soundcloud.com', ''),
               viewportW: innerWidth,
               scrollW: document.documentElement.scrollWidth,
               main: rect('.l-main'),
               content: rect('#content'),
               footerVisible: footer ? getComputedStyle(footer).display !== 'none' : false,
               rail: rail ? { display: getComputedStyle(rail).display, ...rect('.l-sidebar') } : null
             }
           })()`,
          true
        )
        const activeNav = await win.webContents.executeJavaScript(
          `(() => {
             const item = document.querySelector('.nav-item[aria-current="page"]')
             return item ? (item.querySelector('.nav-text') || {}).textContent || '' : ''
           })()`,
          true
        )
        return { ...page, activeNav }
      }

      const capture = async (name) => {
        const image = await win.webContents.capturePage()
        writeFileSync(join(ROOT, 'screenshots', `${name}.png`), image.toPNG())
        console.log(`  captured screenshots/${name}.png`)
      }

      await reveal('discover')
      console.log(`DISCOVER: ${await waitForContent()} chars ${JSON.stringify(await describePage())}`)
      await capture('live-web')

      await reveal('charts')
      console.log(`CHARTS: ${await waitForContent()} chars ${JSON.stringify(await describePage())}`)
      await capture('live-charts')
    } catch (error) {
      report.errors.push(`[capture-web] ${String(error)}`)
    }
  }

  console.log('\n=== live verification ===')
  console.log(`attached: ${report.attached}`)
  console.log(`loaded:   ${report.loaded}`)
  console.log(`preload:  ${report.preload}`)
  console.log(`snapshot: ${report.snapshot}`)
  if (report.latestSnapshot) {
    const snap = report.latestSnapshot
    console.log(`  hasTrack=${snap.hasTrack} playing=${snap.playing} volume=${Number(snap.volume).toFixed(2)}`)
    if (snap.title) console.log(`  title="${snap.title}" artist="${snap.artist}"`)
  }
  if (report.url) console.log(`url:      ${report.url}`)
  if (report.session) {
    const session = report.session
    console.log(
      `session:  ${session.status}${session.userName ? ` (${session.userName})` : ''}${session.avatar ? ' +avatar' : ''}`
    )
  }
  if (report.errors.length) {
    console.log('errors:')
    for (const line of report.errors.slice(0, 12)) console.log(`  - ${line}`)
  }

  const ok = report.attached && report.loaded && report.preload && report.snapshot
  win.destroy()
  app.exit(ok ? 0 : 1)
}

app.whenReady().then(() => {
  session.fromPartition(PARTITION).setUserAgent(app.userAgentFallback)
  registerIpc()
  main().catch((error) => {
    console.error(error)
    app.exit(1)
  })
})

app.on('window-all-closed', () => app.quit())
