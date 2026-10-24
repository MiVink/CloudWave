# Cloudwave

**A quiet, native desktop shell for SoundCloud.**

English · [Українська](README.uk.md)

Cloudwave does not clone SoundCloud and does not download music. It loads the
real soundcloud.com inside a hardened `<webview>`, removes the site's header,
ads, consent wall and promo rails, and draws its own interface around it: a
window title bar, a sidebar, a home dashboard, a player bar, focus mode, a
command palette and settings.

![Cloudwave home](screenshots/home.png)

## What works

- **Native window frame** — custom title bar, window controls, size and
  position restored between launches.
- **Home dashboard** instead of a sign-in screen: quick destinations, recent
  tracks, shortcut hints. SoundCloud is only opened when you need it.
- **Live player** — title, artist, artwork, progress, volume, like, shuffle and
  repeat stay in sync with the real SoundCloud player.
- **Playback survives navigation** — sidebar destinations route inside the SPA
  so the `<audio>` element is never torn down. A real load is used only as a
  fallback when the route cannot be resolved.
- **Real sign-in** — Google, Facebook, Apple and email all work. OAuth runs in a
  controlled child window on the same persistent partition, restricted to an
  HTTPS identity-provider allowlist. Non-auth popups go to the system browser.
- **Truthful session card** — the sidebar reads the name and avatar that
  SoundCloud renders in its own header. It never reads cookies, tokens or
  passwords; `unknown` is a valid state and is shown as "Checking session…".
- **Sidebar that knows where you are** — the active item follows the webview
  URL only while the webview is visible, so the background warm-up does not
  steal the highlight.
- **Full-width content** — injected CSS unclamps SoundCloud's containers, stacks
  the right rail under the main column and turns the fixed five-column tile
  grids into `auto-fill` grids. Charts no longer leave a dead right column.
- **Sharp artwork** — thumbnail URLs are upgraded to larger SoundCloud variants
  in the site preload, in recents and defensively at render time.
- **Command palette** (`Ctrl+K`) — navigation, search, view and app actions.
- **Focus mode** (`F`) — large artwork, waveform, transport and volume without
  distraction.
- **Settings** (`Ctrl+,`) — five accents, reduced motion, ad hiding,
  always-on-top, cache clearing, relaunch, version info, and the SoundCloud
  legal links that the hidden site footer would otherwise take away.
- **Media keys** and global shortcuts for play/pause, next and previous.
- **Deterministic covers** for tracks without artwork — a stable gradient from a
  seed, no randomness between launches.

| Discover in the live webview | Command palette |
| --- | --- |
| ![Discover](screenshots/live-web.png) | ![Command palette](screenshots/palette.png) |

| Focus mode | Settings |
| --- | --- |
| ![Focus mode](screenshots/focus.png) | ![Settings](screenshots/settings.png) |

## Quick start

Node.js 20+ and npm are required. In PowerShell use `npm.cmd` — the `npm.ps1`
shim may be blocked by the execution policy.

```powershell
npm.cmd install
npm.cmd run dev
```

Other commands:

```powershell
npm.cmd run typecheck    # types for main/preload and renderer
npm.cmd run build        # production bundles into out/
npm.cmd start            # run the built app
npm.cmd run screenshots  # deterministic demo screenshots
npm.cmd run verify:live  # live webview + preload + player snapshot check
npm.cmd run dist         # Windows installer (electron-builder)
```

## Controls

| Keys | Action |
| --- | --- |
| `Space` | Play / pause |
| `←` / `→` | Seek 5 seconds |
| `↑` / `↓` | Volume |
| `Ctrl+←` / `Ctrl+→` | Previous / next track |
| `Ctrl+K` | Command palette |
| `Ctrl+,` | Settings |
| `F` | Focus mode |
| `M` | Mute |
| `L` | Like |
| `S` | Shuffle |
| `R` | Repeat |
| `H` | Home |
| `/` | Focus search |
| `Alt+←` / `Alt+→` | Back / forward in webview history |
| `Ctrl+R` | Reload the page |
| `Esc` | Close overlay |

When focus is inside the webview, SoundCloud's own shortcuts apply.

## How it fits together

```
src/main/        Electron: window, IPC, media keys, webview hardening, popup policy
src/preload/     window.desktop bridge + the script that runs inside soundcloud.com
src/renderer/    React shell, components, styles, hooks
src/shared/      player, settings and artwork types shared by all layers
scripts/         screenshot harness and live verification
docs/en/         design and roadmap (English)
docs/uk/         design and roadmap (Ukrainian)
```

`src/preload/site.ts` samples the site player every 400 ms (title, artist,
artwork, position, duration, volume, like) and sends it to the renderer with
`sendToHost('sc:player')`. Commands from our player bar go back through
`send('sc:command', …)`. Every selector is best-effort: if the site changes its
markup, the player should degrade, not break.

Navigation uses the site's own router. The sidebar sends a `navigate` command,
the preload clicks a matching anchor, and only if the URL has not changed after
~900 ms does the host fall back to `loadURL`. That fallback is what keeps
playback alive across Home and section switches.

Auth is handled in the main process. `applyPopupPolicy()` hardens every child
window (`contextIsolation`, no Node integration, the `persist:soundcloud`
partition) and only lets an allowlisted HTTPS identity provider navigate inside
the app; everything else opens in the system browser.

More detail: [AGENTS.md](AGENTS.md), [docs/en/DESIGN.md](docs/en/DESIGN.md),
[docs/en/ROADMAP.md](docs/en/ROADMAP.md).

## Demo mode

To review the design without a network, open the renderer with `?demo=1` (the
screenshot harness does this). Demo mode creates no webview, seeds a queue and
recents, and switches scenes through
`window.__cloudwave.demo('home' | 'web' | 'immersive' | 'palette' | 'settings')`.

## Documentation languages

English is the primary locale. Ukrainian lives beside it and follows the same
structure, so a new language is a copy of the tree, not a rewrite:

```
README.md            README.uk.md            README.<locale>.md
docs/en/DESIGN.md    docs/uk/DESIGN.md       docs/<locale>/DESIGN.md
docs/en/ROADMAP.md   docs/uk/ROADMAP.md      docs/<locale>/ROADMAP.md
```

UI copy stays English in every locale: the shell is one product, and mixing
translated navigation with SoundCloud's English catalogue reads worse than a
consistent English frame.

## Limitations

- SoundCloud is a React SPA with unstable class names; some selectors may break
  after their updates.
- Personal library, likes and uploads require signing in inside the embedded
  page.
- Cloudwave is not affiliated with SoundCloud and is not an official client.
- The app does not download or store audio files.
- The host cannot see keyboard events while focus is inside the webview.

## Credits

Ideas and approaches were informed by the open-source projects
[zxcloli666/SoundCloud-Desktop](https://github.com/zxcloli666/SoundCloud-Desktop),
[ytmdesktop/ytmdesktop](https://github.com/ytmdesktop/ytmdesktop) and
[pear-devs/pear-desktop](https://github.com/pear-devs/pear-desktop). Cloudwave's
code is written from scratch.

## License

MIT. See `package.json`.
