# Cloudwave design

English · [Українська](../uk/DESIGN.md)

## Idea

SoundCloud is loud and colourful. Cloudwave tries to be **a quiet studio around
it**: a dark room, one warm accent, tight typography, and no visual noise
competing with the music.

Three principles:

1. **Music first.** The interface never covers the artwork, waveform or track
   title. Secondary actions live in the palette, settings or focus mode.
2. **Native without imitation.** The app behaves like a desktop client: its own
   title bar, media keys, restored state, instant navigation.
3. **Calm over density.** Air, generous spacing, restrained lines. The grid and
   vinyl are barely-there motifs, not decoration.

## Visual language: midnight studio

| Element | Decision |
| --- | --- |
| Background | near-black graphite `#0a0a0e` with a cool undertone |
| Surfaces | 3–4 elevation levels, from `#111116` to `#1a1a21` |
| Accent | SoundCloud ember `#ff5a1f`, plus four alternatives |
| Text | warm white, never pure `#fff`; muted grey for metadata |
| Lines | 1px, low contrast, no heavy borders |
| Radii | 10–18px; large panels softer than buttons |
| Shadows | deep but nearly invisible; surface contrast does the work |

Accents: `ember #ff5a1f`, `coral #ff6b8a`, `lime #c8f36b`, `cyan #5fe3d0`,
`violet #a78bfa`. The accent is switched through `html[data-accent]`; every
derived colour (hover, focus ring, glow) is a `color-mix()` of the base token.

## Typography

- **Inter Variable** for the entire interface, Cyrillic included.
- Headings: 600–700, tight tracking (`-0.03em`); large sizes only on Home and in
  focus mode.
- Body: 13–14px, line-height 1.5.
- Metadata: 11–12px, uppercase for section labels, tracking `0.08em`.
- Player numbers are tabular (`font-variant-numeric: tabular-nums`) so the clock
  does not jump during playback.

## Composition

```
┌──────────────────────────────────────────────────────────────┐
│ title bar: brand · history · search · status · window         │
├────────────┬─────────────────────────────────────────────────┤
│ sidebar    │ stage                                           │
│  Listen    │  Home  or  SoundCloud <webview>                 │
│  Your music│                                                 │
│  Create    │                                                 │
│            │                                                 │
│  listener  │                                                 │
├────────────┴─────────────────────────────────────────────────┤
│ player bar: art · title/artist · transport · waveform · vol   │
└──────────────────────────────────────────────────────────────┘
```

- Sidebar — 248px, collapses to icons.
- Stage — everything else; Home and the webview share one space and switch as
  layers, not by remounting.
- Player bar — 84px, always visible, never covers content.
- Home — up to 1420px of content, centred with equal gutters. The old 1180px cap
  left a wide empty band on 1440p and ultrawide monitors; the dashboard now
  grows with the window while line length stays readable.

### Responsive rules

- Home grid: two columns above 1180px, one column below. Recent and browse grids
  fall from four to three to two columns as width drops.
- Sidebar collapses automatically under 1060px and can be toggled manually.
- Player bar switches to a compact three-row layout under 1100px; the volume
  block is the first thing to go.
- The embedded site gets the same treatment: containers are unclamped, the right
  rail stacks under the main column, and tile grids use `auto-fill` so a row
  fills the width instead of stopping at five tiles.

## Key screens

### Home

Top row: date, greeting, connection status. Then a hero panel with a vinyl that
spins while music plays. Below it, two columns: "Start somewhere" (destination
cards) and "Keyboard first" (shortcut hints). At the bottom, recent tracks and
"Explore SoundCloud".

The hero changes with the session state: signed out offers **Sign in to
SoundCloud**, signed in offers **Open Discover**, and an unresolved session is
labelled honestly rather than pretending the user is a guest.

### Webview

The site fills the stage. Its header, consent wall, ad banners and mobile promo
block are hidden or moved offscreen. SoundCloud's player bar is also moved
offscreen — but not removed — so position sync and synthetic seeks keep working.

When Home is open the webview stays mounted with `opacity: 0` and
`pointer-events: none`, never `display: none`. The document is never destroyed,
so audio keeps playing and the site does not reload when you come back.

### Session card

The sidebar footer shows the account that SoundCloud renders in its own header:
avatar or initials, display name, and a truthful action (open profile, sign in,
or "Checking session…"). Two rules matter:

- A guest still sees the **Library** nav item (`/you/library`), so that link is
  never treated as proof of a session.
- The signed-out header renders **Sign in / Create account** in
  `.header__loginMenu`; that is the reliable negative signal.

No cookies, tokens or passwords are read. If neither marker is present the state
is `unknown`, and the UI says so.

### Focus mode

A full-screen overlay: large artwork (up to 380px), title, artist, waveform,
transport, volume and an "Open on SoundCloud" link. The background is a blurred
gradient derived from the artwork. Exit with `Esc` or `F`.

### Command palette

Search on top, grouped actions (Navigate, Playback, View, App), key hints on the
right. Opens with `Ctrl+K`, arrow navigation, `Enter` to run.

### Settings

A right-hand sheet: accents, motion, ad hiding, recent tracks, always-on-top,
cache clearing, relaunch, Electron/Chrome versions. Each action has a clear
consequence and needs no restart unless explicitly marked.

Because the embedded site's `.l-footer` is hidden (it used to sit in a 360px
right rail and squeezed the Charts grid), the legal destinations — Legal,
Privacy, Cookies, Imprint — are offered as links in the About section.

## Authentication

SoundCloud's OAuth flows use `window.open`. A `setWindowOpenHandler` that simply
denies popups therefore broke Google, Facebook, Apple and email sign-in.

The main process now owns a popup policy:

- every child window is created with `contextIsolation`, no Node integration,
  `webSecurity`, and the `persist:soundcloud` partition;
- only HTTPS hosts on an identity-provider allowlist may navigate inside the
  app; everything else is handed to the system browser;
- `will-navigate` and `will-redirect` are both guarded, because server-side
  OAuth bounces do not fire `will-navigate`;
- the policy recurses into popups opened by popups.

Nothing about the flow is logged, and no credential ever crosses the
`window.desktop` bridge.

## Artwork

For tracks without artwork Cloudwave generates a gradient from a seed (title +
artist): FNV-style hash → two HSL angles → `--cover-bg`. This yields a stable,
recognisable cover per track with no network requests and no randomness between
launches. Real SoundCloud artwork is loaded remotely and upgraded from thumbnail
sizes (`-t50x50`, `-large`) to larger variants before it reaches the UI.

## Motion

- Duration: 120–260ms; large transitions up to 320ms.
- Curve: `cubic-bezier(0.22, 1, 0.36, 1)` for entry, `ease-out` for exit.
- Only `transform` and `opacity` are animated.
- The vinyl turns slowly (24s per revolution) and stops on pause.
- `prefers-reduced-motion` and the "Reduce motion" setting disable rotation,
  pulses and entry delays.

## Accessibility

- Text contrast is at least WCAG AA on every surface.
- Every icon button has an `aria-label`; active states use `aria-pressed`.
- Focus is visible: a 2px accent ring with offset.
- Overlays close on `Esc` and return focus to the previous element.
- Volume and progress sliders respond to arrow keys.
- Shortcuts do not fire while focus is in an input or on a control.

## Deliberate trade-offs

- We do not restyle every SoundCloud element: the page stays recognisable.
- We hide ads and promo blocks, but not paid content or navigation.
- We add no equaliser or audio processing — it would change what the listener
  hears and require access to the audio stream.
- Demo mode exists for review and screenshots; it is not a second version of the
  UI.
