# AGENTS.md — Cloudwave

Notes for humans and coding agents working on this repository. Read this before
touching the webview, the player bridge, or the design tokens.

## What this is

Cloudwave is a desktop shell for **soundcloud.com**. It is not a re-implementation
of SoundCloud and it does not scrape or download audio. The app loads the real
site in an Electron `<webview>`, hides the site's own header/ads/consent UI, and
draws a native React frame around it: title bar, sidebar, home dashboard,
player bar, focus mode, command palette, and settings.

Design language: **midnight studio** — near-black charcoal surfaces, a single
SoundCloud-ember accent, restrained vinyl/grid/waveform motifs, tight Inter
typography, and short purposeful motion.

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Electron 45 |
| UI | React 19 + TypeScript |
| Build | electron-vite 6 / Vite 8 |
| Icons | lucide-react |
| Type | Inter Variable (`@fontsource-variable/inter`) |
| Packaging | electron-builder (Windows x64) |

No state library, no CSS framework, no router. State is local React state plus
`localStorage`; navigation is a single webview plus a `view` flag.

## Commands

Use `npm.cmd` in PowerShell (the `npm.ps1` shim is blocked by execution policy).
npm prints notices on stderr, so PowerShell may report exit code 1 even when the
command succeeded — check the build output, not only `$LASTEXITCODE`.

```powershell
npm.cmd install
npm.cmd run dev          # electron-vite dev server + Electron
npm.cmd run typecheck    # tsc for node (main/preload) and web (renderer)
npm.cmd run build        # production bundles into out/
npm.cmd start            # preview the built app
npm.cmd run screenshots  # deterministic demo screenshots -> screenshots/
npm.cmd run verify:live  # real soundcloud.com webview smoke test + live shots
npm.cmd run dist         # Windows installer via electron-builder
```

`verify:live` requires network access and a working SoundCloud session partition
(`persist:soundcloud-live-check`). It exits non-zero if the webview fails to
attach, the site preload does not inject, or no player snapshot reaches the host.

## Layout

```
src/
  main/index.ts          Electron main: window, state, webview hardening, IPC, media keys
  preload/index.ts       contextBridge API exposed to the renderer as window.desktop
  preload/site.ts        runs INSIDE the SoundCloud webview: CSS, snapshots, commands
  shared/types.ts        PlayerSnapshot, PlayerCommand, Settings, AppInfo, SiteSession
  shared/artwork.ts      thumbnail -> larger SoundCloud artwork URL upgrade
  renderer/
    index.html           CSP + root element
    src/App.tsx          shell orchestration: webview lifecycle, player, shortcuts, demo API
    src/components/      TitleBar, Sidebar, HomeView, PlayerBar, overlays, primitives
    src/hooks/           useSettings (persisted), useRecents (persisted, max 8)
    src/lib/             destinations, cover generation, time/clamp helpers
    src/styles/          tokens, base, chrome, home, player, overlays, app
scripts/
  capture.cjs            demo-mode screenshot harness (no network)
  verify-live.cjs        live webview/preload/snapshot verification
screenshots/             committed review artifacts
docs/en/                 design + roadmap (English, primary locale)
docs/uk/                 design + roadmap (Ukrainian)
```

## Data flow

```
SoundCloud page
   │  (site preload, every 400 ms)
   ▼
PlayerSnapshot ──sendToHost('sc:player')──► App.tsx ──► PlayerBar / Home / Focus
   ▲                                            │
   └──────── send('sc:command', command) ◄──────┘
```

* `site.ts` reads the site's DOM with layered fallbacks (site controls → `<audio>`
  element → ARIA values). A missing selector must never break playback.
* Snapshots are deduplicated by JSON serialization before crossing the IPC bridge.
* Host player commands: `playpause`, `next`, `prev`, `seek`, `volume`, `like`,
  `shuffle`, `repeat`.
* The host applies commands optimistically, then trusts the next snapshot.

## Navigation model

* `view: 'home' | 'web' | 'demo'` decides what is visible.
* `activeNav` is the sidebar highlight. It only follows the webview URL while the
  webview is visible, so the background `/discover` warm-up does not steal Home.
* The webview is created once with `partition="persist:soundcloud"` and a `preload`
  URL. `src` is assigned imperatively after listeners are attached — never via JSX.
* Home is an absolutely positioned layer over the stage; the webview stays mounted
  with `visibility: hidden` (not `display: none`) so audio keeps playing.
* `readyRef` + `pendingUrlRef` queue navigation requested before `dom-ready`.

## Demo mode

Open the renderer with `?demo=1` (the screenshot harness does this). In demo mode:

* no webview is created and no network is used;
* a seeded queue and recents make screenshots deterministic;
* `window.__cloudwave.demo(kind)` switches scenes: `home`, `web`, `immersive`,
  `palette`, `settings`;
* player commands mutate local state only.

Keep demo mode working: it is the fastest way to review visual changes and the
only way to capture reproducible screenshots.

## Styling rules

* All color, spacing, radius, motion, and z-index decisions live in
  `styles/tokens.css`. Components consume CSS variables; do not hard-code hexes.
* Accent is selected by `document.documentElement.dataset.accent`
  (`ember | coral | lime | cyan | violet`).
* `data-reduce-motion="true"` must disable non-essential animation.
* Motion uses transform/opacity only and stays in the 120–260 ms range.
* UI copy is English. Documentation may be Ukrainian or English.

## Webview / site gotchas

These are hard-won and easy to regress:

1. **Header selector is `header.header`.** `.sc-classicHeader` is stale. The header
   is moved offscreen rather than removed so SoundCloud can still measure geometry.
2. **Consent wall**: `#onetrust-consent-sdk`. The preload clicks
   `#onetrust-reject-all-handler`, removes OneTrust nodes, and clears
   `ot-overflow-hidden` / `ot-position-relative`. CSS hides the SDK as a fallback.
3. **Upsells**: `.l-product-banners` (get-heard banner) and `article.mobileApps`
   (Go mobile rail). Both are hidden when `hideAds` is on.
4. **Top spacing**: `.l-container.l-content` reserves `padding-top: 46px` for the
   site header. The injected CSS reclaims it. Without this, the page starts with a
   dead band.
5. **Player controls** (`.playControls`) are also moved offscreen, not hidden, so
   the timeline slider keeps real geometry for synthetic seeks.
6. **Preload URL** must be a `file:///` URL. Build it with
   `encodeURI('file:///' + path.replace(/\\/g, '/').replace(/^\/+/, ''))`.
7. **Listeners before `src`.** Attaching `ipc-message` / navigation listeners after
   assigning `src` can miss the first events.
8. `did-fail-load` with code `-3` (`ERR_ABORTED`) is normal during SPA navigation.
9. The site is a React SPA with unstable class names. Treat every selector as
   best-effort and keep the `<audio>` fallback working.
10. **Guests see `/you/library`.** A `/you` link alone is never proof of a
    session. The reliable signed-out signal is
    `.header__loginMenu .loginButton` / `.signupButton` (or `a[href="/signin"]`).
    Read the session only from the rendered header — never from cookies or tokens.
11. **OAuth uses `window.open`.** A `setWindowOpenHandler` that denies popups
    breaks Google, Facebook, Apple and email sign-in. Auth popups are allowed on
    the same partition and restricted to an HTTPS provider allowlist; everything
    else goes to the system browser.

## Security

* Renderer CSP allows `frame-src` only for `soundcloud.com`; `object-src 'none'`.
* `will-attach-webview` forces `nodeIntegration = false`, `contextIsolation = true`,
  `webSecurity = true`, and the `persist:soundcloud` partition.
* External links open in the system browser through `app:open-external`; the app
  never navigates its own window to arbitrary origins.
* No secrets, tokens, or credentials are stored in this repository.

## Conventions

* Components are function components returning `JSX.Element`; import
  `type { JSX } from 'react'`.
* Prefer `type` imports and explicit return types on exported functions.
* Keep the renderer free of Node APIs. Anything privileged goes through
  `preload/index.ts` → IPC → `main/index.ts`.
* No React StrictMode: it double-mounts and would create duplicate webviews.
* Do not add a router or global store for navigation that a `useState` already
  handles.
* When adding a sidebar destination, update `DESTINATIONS` and `NAV_GROUPS` in
  `lib/destinations.ts`; active-state matching is path-based and longest-first.
* Cover art is generated deterministically from a seed (FNV-style hash → HSL
  gradient). Only real SoundCloud artwork is loaded remotely.

## Documentation

English is the primary locale. Ukrainian mirrors it file for file, so adding a
language is a copy of the tree, not a rewrite:

```
README.md            README.uk.md            README.<locale>.md
docs/en/DESIGN.md    docs/uk/DESIGN.md       docs/<locale>/DESIGN.md
docs/en/ROADMAP.md   docs/uk/ROADMAP.md      docs/<locale>/ROADMAP.md
```

* UI copy stays English in every locale; do not translate navigation labels that
  match SoundCloud's own catalogue.
* Keep the language switcher line at the top of every localized document.
* `AGENTS.md` stays English: it is an engineering contract, not user-facing copy.
* When a decision changes behaviour, update the design doc in the same change.

## Verification checklist

Before claiming a change is done:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run screenshots     # review home / palette / settings / focus / demo
npm.cmd run verify:live     # when touching site preload, CSS, or webview plumbing
```

Then open the relevant files in `screenshots/` and actually look at them. Type
checks and a green build do not prove the frame is not overlapping, the webview
is not blank, or the player is not clipped.

## Known limitations

* SoundCloud can change its DOM at any time; selectors are best-effort.
* Playback requires the user to sign in inside the embedded page for personalized
  library, likes, and uploads.
* The host cannot observe keyboard events while focus is inside the webview;
  SoundCloud's own shortcuts apply there.
* The demo stage is a placeholder by design; it is not a second implementation.
