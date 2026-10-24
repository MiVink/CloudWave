/**
 * Screenshot harness for Cloudwave.
 *
 * Boots the production renderer in a plain Electron window, switches the demo
 * harness to each surface and writes deterministic PNGs to ./screenshots.
 *
 *   npm run build
 *   npm run screenshots
 *
 * Demo mode (`?demo=1`) never mounts the SoundCloud <webview>, so captures are
 * reproducible and do not depend on the network or a signed-in session.
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

const ROOT = join(__dirname, '..')
const OUT_DIR = join(ROOT, 'screenshots')
const RENDERER = join(ROOT, 'out', 'renderer', 'index.html')
const PRELOAD = join(ROOT, 'out', 'preload', 'index.js')
const APP_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version

app.setPath('userData', join(tmpdir(), 'cloudwave-capture'))

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function registerIpc() {
  ipcMain.handle('app:info', () => ({
    version: APP_VERSION,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform
  }))
  ipcMain.handle('win:is-maximized', () => false)
  ipcMain.handle('app:set-always-on-top', () => false)
  ipcMain.handle('app:open-external', () => true)
  ipcMain.handle('app:clear-cache', () => true)
  ipcMain.handle('app:relaunch', () => true)
}

async function waitForHarness(win) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const ready = await win.webContents.executeJavaScript(
      'Boolean(window.__cloudwave)',
      true
    )
    if (ready) return
    await sleep(100)
  }
  throw new Error('window.__cloudwave never appeared — is the build up to date?')
}

async function capture(win, name) {
  // Let entrance animations and font swaps settle before grabbing the frame.
  await sleep(850)
  const image = await win.webContents.capturePage()
  writeFileSync(join(OUT_DIR, `${name}.png`), image.toPNG())
  console.log(`  captured screenshots/${name}.png`)
}

async function run() {
  mkdirSync(OUT_DIR, { recursive: true })

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    show: true,
    frame: false,
    backgroundColor: '#0b0c10',
    webPreferences: {
      preload: PRELOAD,
      contextIsolation: true,
      sandbox: false,
      webviewTag: true,
      backgroundThrottling: false
    }
  })

  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) console.log(`  [renderer] ${message}`)
  })

  await win.loadFile(RENDERER, { query: { demo: '1' } })
  await waitForHarness(win)
  await sleep(600)

  const scenes = [
    ['home', "window.__cloudwave.demo('home')"],
    ['palette', "window.__cloudwave.demo('palette')"],
    ['settings', "window.__cloudwave.demo('settings')"],
    ['focus', "window.__cloudwave.demo('immersive')"],
    ['demo-stage', "window.__cloudwave.demo('web')"]
  ]

  for (const [name, script] of scenes) {
    await win.webContents.executeJavaScript(script, true)
    await capture(win, name)
  }

  // A second player state makes the queue / progress chrome legible in docs.
  await win.webContents.executeJavaScript(
    `window.__cloudwave.demo('home');
     window.__cloudwave.setPlayer({
       title: 'Velvet Static',
       artist: 'Sable Youth',
       position: 42,
       duration: 197,
       playing: true,
       liked: false
     })`,
    true
  )
  await capture(win, 'home-playing')

  win.destroy()
  app.quit()
}

app.whenReady().then(() => {
  registerIpc()
  run().catch((error) => {
    console.error(error)
    app.exit(1)
  })
})

app.on('window-all-closed', () => app.quit())
