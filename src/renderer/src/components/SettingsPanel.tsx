import {
  Database,
  ExternalLink,
  History,
  Info,
  Palette,
  Pin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Zap
} from 'lucide-react'
import type { CSSProperties, JSX } from 'react'
import type { AccentId, AppInfo, Settings } from '@shared/types'

const SWATCHES: { id: AccentId; label: string; hex: string }[] = [
  { id: 'ember', label: 'Ember', hex: '#ff5a1f' },
  { id: 'coral', label: 'Coral', hex: '#ff6b8a' },
  { id: 'lime', label: 'Lime', hex: '#c8f36b' },
  { id: 'cyan', label: 'Cyan', hex: '#5fe3d0' },
  { id: 'violet', label: 'Violet', hex: '#a78bfa' }
]

/**
 * The site's own footer is hidden inside the embedded page (it used to sit in a
 * 360px right rail and squeezed the Charts grid). These links keep the legal
 * destinations reachable from the shell instead.
 */
const LEGAL_LINKS: { label: string; url: string }[] = [
  { label: 'Legal', url: 'https://soundcloud.com/legal' },
  { label: 'Privacy', url: 'https://soundcloud.com/pages/privacy' },
  { label: 'Cookies', url: 'https://soundcloud.com/pages/cookies' },
  { label: 'Imprint', url: 'https://soundcloud.com/imprint' }
]

export interface SettingsPanelProps {
  settings: Settings
  info: AppInfo | null
  recentsCount: number
  onChange: (patch: Partial<Settings>) => void
  onClearRecents: () => void
  onClearCache: () => void
  onRelaunch: () => void
  onClose: () => void
}

interface SwitchRowProps {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
}

function SwitchRow({ label, description, checked, onChange }: SwitchRowProps): JSX.Element {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

/**
 * Settings are intentionally few. Every switch here changes something the
 * user can notice immediately; anything that would need a paragraph of
 * explanation belongs in a different product.
 */
export function SettingsPanel({
  settings,
  info,
  recentsCount,
  onChange,
  onClearRecents,
  onClearCache,
  onRelaunch,
  onClose
}: SettingsPanelProps): JSX.Element {
  return (
    <aside className="settings-sheet" role="dialog" aria-modal="true" aria-label="Settings">
      <header className="settings-head">
        <Sparkles aria-hidden="true" />
        <h2>Settings</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close settings" title="Close (Esc)">
          <X />
        </button>
      </header>

      <div className="settings-body">
        <section className="settings-section">
          <h3>
            <Palette aria-hidden="true" /> Appearance
          </h3>

          <div className="setting-row">
            <div className="setting-copy">
              <strong>Accent</strong>
              <p>The one colour the shell is allowed to shout in.</p>
            </div>
            <div className="swatches" role="group" aria-label="Accent colour">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch.id}
                  type="button"
                  className="swatch"
                  style={{ '--swatch': swatch.hex } as CSSProperties}
                  aria-label={swatch.label}
                  aria-pressed={settings.accent === swatch.id}
                  title={swatch.label}
                  onClick={() => onChange({ accent: swatch.id })}
                />
              ))}
            </div>
          </div>

          <SwitchRow
            label="Reduce motion"
            description="Skip transitions and ambient movement. The OS preference is always respected."
            checked={settings.reduceMotion}
            onChange={(value) => onChange({ reduceMotion: value })}
          />
        </section>

        <section className="settings-section">
          <h3>
            <Zap aria-hidden="true" /> SoundCloud
          </h3>

          <SwitchRow
            label="Hide ads and upsells"
            description="Strips promoted modules from the embedded page. Playback is never affected."
            checked={settings.hideAds}
            onChange={(value) => onChange({ hideAds: value })}
          />

          <SwitchRow
            label="Show recently played"
            description="Keep the last few tracks in the sidebar for a one-click return."
            checked={settings.showRecents}
            onChange={(value) => onChange({ showRecents: value })}
          />
        </section>

        <section className="settings-section">
          <h3>
            <Pin aria-hidden="true" /> Window
          </h3>

          <SwitchRow
            label="Always on top"
            description="Keep Cloudwave above other windows while you work."
            checked={settings.alwaysOnTop}
            onChange={(value) => onChange({ alwaysOnTop: value })}
          />
        </section>

        <section className="settings-section">
          <h3>
            <History aria-hidden="true" /> Library &amp; data
          </h3>

          <div className="setting-row">
            <div className="setting-copy">
              <strong>Recently played</strong>
              <p>
                {recentsCount === 0
                  ? 'Nothing stored yet. Tracks appear after they play for a moment.'
                  : `${recentsCount} ${recentsCount === 1 ? 'track' : 'tracks'} stored on this device.`}
              </p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onClearRecents} disabled={recentsCount === 0}>
              <Trash2 aria-hidden="true" />
              Clear
            </button>
          </div>

          <div className="setting-row">
            <div className="setting-copy">
              <strong>SoundCloud cache</strong>
              <p>Clears artwork and page assets. Your sign-in and library stay untouched.</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={onClearCache}>
              <Database aria-hidden="true" />
              Clear cache
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>
            <Info aria-hidden="true" /> About
          </h3>

          <div className="settings-foot">
            <strong>Cloudwave {info?.version ?? '0.1.0'}</strong>
            <br />
            A native-feeling shell around SoundCloud. Not affiliated with SoundCloud.
            <br />
            Electron {info?.electron ?? '—'} · Chromium {info?.chrome ?? '—'} · {info?.platform ?? 'desktop'}
          </div>

          <div className="settings-actions">
            <button type="button" className="btn btn-ghost" onClick={onRelaunch}>
              <RefreshCw aria-hidden="true" />
              Relaunch
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                void window.desktop?.app.openExternal('https://soundcloud.com')
              }}
            >
              <ExternalLink aria-hidden="true" />
              soundcloud.com
            </button>
            <span className="settings-secure" title="The SoundCloud session is stored in its own partition.">
              <ShieldCheck aria-hidden="true" /> Session isolated
            </span>
          </div>

          <div className="settings-links" aria-label="SoundCloud policies">
            {LEGAL_LINKS.map((link) => (
              <button
                key={link.url}
                type="button"
                className="settings-link"
                onClick={() => {
                  void window.desktop?.app.openExternal(link.url)
                }}
              >
                {link.label}
                <ExternalLink aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </aside>
  )
}
