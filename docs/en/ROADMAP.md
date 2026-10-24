# Cloudwave roadmap

English · [Українська](../uk/ROADMAP.md)

## v0.1 — first build

- [x] Frameless Electron window with size/position persistence
- [x] React shell: title bar, sidebar, stage, player bar
- [x] Live `<webview>` on the `persist:soundcloud` partition
- [x] Site preload: header/ad/consent hiding, snapshots, commands
- [x] Play/pause, seek, volume, like, shuffle and repeat sync
- [x] Home dashboard with generative covers and recent tracks
- [x] Command palette, settings drawer, focus mode
- [x] Keyboard shortcuts and media keys
- [x] Demo mode for deterministic screenshots
- [x] Live webview/preload/snapshot verification (`verify:live`)
- [x] Documentation: AGENTS, README, DESIGN, ROADMAP

## v0.2 — reliability and polish (current)

- [x] Real OAuth sign-in for Google, Facebook, Apple and email through a
      hardened, allowlisted popup on the same session partition
- [x] Truthful session card read from SoundCloud's own header; guests detected
      via `.header__loginMenu`, never via `/you/library`
- [x] Playback survives Home and sidebar navigation by routing inside the SPA
- [x] Sidebar active state only follows the URL while the webview is visible
- [x] Full-width layout pass: unclamped containers, stacked right rail,
      `auto-fill` tile grids, no dead right column on Charts
- [x] Sharper artwork by upgrading thumbnail URLs at every layer
- [x] Legal links preserved in Settings because the site footer is hidden
- [x] Locale-ready documentation: English primary, Ukrainian alternative
- [ ] Verify play → pause → seek → like on a real track, including track
      changes and a fresh sign-in
- [ ] Handle "site loaded but preload never answered" with an explicit message
      and a Reload action
- [ ] Buffering indicator from the audio element's `readyState`
- [ ] Responsive player bar review below 1100px on a real display
- [ ] Keyboard navigation inside the command palette with
      `aria-activedescendant`
- [ ] Regression test for the site selector contract (minimal DOM contract)
- [ ] Replace the Electron dev CSP warning with an explicit dev CSP

## v0.3 — deeper integration

- [ ] Windows system media transport controls (SMTC) with artwork and progress
- [ ] Tray icon: play/pause, next/prev, show/hide
- [ ] Restore the last track after relaunch (position + volume)
- [ ] "Continue listening" on Home based on history
- [ ] Settings export/import
- [ ] UI localisation (uk/en) without translating section names that match
      SoundCloud's catalogue

## v1.0 — distribution

- [ ] Signed Windows installer plus a portable build
- [ ] Auto-update (electron-updater) on a stable channel
- [ ] Release screenshots and a short video
- [ ] Privacy policy: what stays local
- [ ] macOS/Linux verification or an explicit "Windows first" statement

## Open questions

- Offline artwork cache (never caching audio).
- Custom playlists on top of SoundCloud (needs API or local storage).
- A compact mini-player above other windows.
- Discord Rich Presence.

## Prioritisation rules

1. First, anything that breaks playback or makes the app unpredictable.
2. Then, anything that makes daily use faster (keyboard, tray, history).
3. Only then, cosmetics and new surfaces.

Every item ends with proof: `typecheck`, `build`, a screenshot or a live test.
No proof, not "done".
