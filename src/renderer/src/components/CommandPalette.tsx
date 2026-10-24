import { useEffect, useMemo, useRef, useState, type JSX, type KeyboardEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Command,
  CornerDownLeft,
  History,
  Home,
  Maximize2,
  RefreshCw,
  Search,
  Settings2,
  type LucideIcon
} from 'lucide-react'
import type { RecentTrack } from '@/hooks/useRecents'
import { DESTINATIONS } from '@/lib/destinations'
import { CoverArt } from './CoverArt'

interface PaletteItem {
  id: string
  group: string
  label: string
  hint?: string
  kbd?: string
  icon: LucideIcon
  /** Recent entries keep their generated artwork instead of an icon tile. */
  cover?: { seed: string; artwork?: string }
  run: () => void
}

export interface CommandPaletteProps {
  recents: RecentTrack[]
  onClose: () => void
  onNavigate: (id: string) => void
  onOpenTrack: (track: RecentTrack) => void
  onSearch: (term: string) => void
  onOpenSettings: () => void
  onOpenImmersive: () => void
  onReload: () => void
  onBack: () => void
  onForward: () => void
}

/**
 * One keyboard surface for everything the shell can do.
 *
 * Results are built from three sources — destinations, shell actions and this
 * device's recents — plus a free-text SoundCloud search that only appears once
 * the query has content. Group headings are rendered inline so the list never
 * needs a second column.
 */
export function CommandPalette({
  recents,
  onClose,
  onNavigate,
  onOpenTrack,
  onSearch,
  onOpenSettings,
  onOpenImmersive,
  onReload,
  onBack,
  onForward
}: CommandPaletteProps): JSX.Element {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const items = useMemo<PaletteItem[]>(() => {
    const base: PaletteItem[] = []

    for (const destination of DESTINATIONS) {
      if (destination.id === 'search') continue
      base.push({
        id: `nav-${destination.id}`,
        group: 'Go to',
        label: destination.label,
        hint: destination.hint,
        icon: destination.icon,
        run: () => onNavigate(destination.id)
      })
    }

    base.push(
      {
        id: 'action-focus',
        group: 'Actions',
        label: 'Focus mode',
        hint: 'Large artwork and transport',
        kbd: 'F',
        icon: Maximize2,
        run: onOpenImmersive
      },
      {
        id: 'action-settings',
        group: 'Actions',
        label: 'Settings',
        hint: 'Theme, behaviour and data',
        kbd: 'Ctrl ,',
        icon: Settings2,
        run: onOpenSettings
      },
      {
        id: 'action-reload',
        group: 'Actions',
        label: 'Reload SoundCloud',
        hint: 'Refresh the embedded page',
        kbd: 'Ctrl R',
        icon: RefreshCw,
        run: onReload
      },
      {
        id: 'action-back',
        group: 'Actions',
        label: 'Go back',
        hint: 'Previous page in SoundCloud',
        kbd: 'Alt ←',
        icon: ArrowLeft,
        run: onBack
      },
      {
        id: 'action-forward',
        group: 'Actions',
        label: 'Go forward',
        hint: 'Next page in SoundCloud',
        kbd: 'Alt →',
        icon: ArrowRight,
        run: onForward
      }
    )

    for (const track of recents) {
      base.push({
        id: `track-${track.url || `${track.artist}|${track.title}`}`,
        group: 'Recently played',
        label: track.title,
        hint: track.artist || 'SoundCloud',
        icon: History,
        cover: { seed: track.title, artwork: track.artwork },
        run: () => onOpenTrack(track)
      })
    }

    const term = query.trim().toLowerCase()
    const filtered = term
      ? base.filter((item) =>
          `${item.label} ${item.hint ?? ''} ${item.group}`.toLowerCase().includes(term)
        )
      : base

    if (term) {
      filtered.push({
        id: 'search-term',
        group: 'Search',
        label: `Search SoundCloud for “${query.trim()}”`,
        hint: 'Open the full search results',
        kbd: 'Enter',
        icon: Search,
        run: () => onSearch(query.trim())
      })
    }

    return filtered
  }, [
    onBack,
    onForward,
    onNavigate,
    onOpenImmersive,
    onOpenSettings,
    onOpenTrack,
    onReload,
    onSearch,
    query,
    recents
  ])

  useEffect(() => {
    setActive(0)
  }, [query])

  useEffect(() => {
    if (active > items.length - 1) setActive(0)
  }, [active, items.length])

  useEffect(() => {
    const list = listRef.current
    const current = list?.querySelector<HTMLElement>('.palette-item.is-active')
    current?.scrollIntoView({ block: 'nearest' })
  }, [active, items])

  const commit = (item: PaletteItem | undefined): void => {
    if (!item) return
    onClose()
    item.run()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        if (items.length > 0) setActive((index) => (index + 1) % items.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        if (items.length > 0) setActive((index) => (index - 1 + items.length) % items.length)
        break
      case 'Home':
        if (query.length === 0) {
          event.preventDefault()
          setActive(0)
        }
        break
      case 'End':
        if (query.length === 0) {
          event.preventDefault()
          setActive(Math.max(0, items.length - 1))
        }
        break
      case 'Enter':
        event.preventDefault()
        commit(items[active])
        break
      case 'Escape':
        event.preventDefault()
        onClose()
        break
      default:
        break
    }
  }

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="palette-input-row">
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Jump to a page, track or action…"
          aria-label="Search commands"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd className="kbd" aria-hidden="true">
          Esc
        </kbd>
      </div>

      <div className="palette-list" ref={listRef} role="listbox" aria-label="Results">
        {items.length === 0 ? (
          <div className="palette-empty">Nothing matched “{query.trim()}”.</div>
        ) : (
          items.map((item, index) => {
            const Icon = item.icon
            const showGroup = index === 0 || items[index - 1].group !== item.group

            return (
              <div key={item.id}>
                {showGroup ? <div className="palette-group-label">{item.group}</div> : null}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={`palette-item ${index === active ? 'is-active' : ''}`.trim()}
                  onMouseMove={() => setActive(index)}
                  onClick={() => commit(item)}
                >
                  {item.cover ? (
                    <CoverArt
                      seed={item.cover.seed}
                      artwork={item.cover.artwork}
                      label={item.label}
                      className="palette-cover"
                      glyphSize={10}
                    />
                  ) : (
                    <span className="palette-icon" aria-hidden="true">
                      <Icon />
                    </span>
                  )}
                  <span className="palette-copy">
                    <strong>{item.label}</strong>
                    {item.hint ? <small>{item.hint}</small> : null}
                  </span>
                  {item.kbd ? (
                    <kbd className="kbd" aria-hidden="true">
                      {item.kbd}
                    </kbd>
                  ) : null}
                </button>
              </div>
            )
          })
        )}
      </div>

      <div className="palette-foot">
        <span>
          <kbd className="kbd" aria-hidden="true">
            ↑↓
          </kbd>
          Navigate
        </span>
        <span>
          <kbd className="kbd" aria-hidden="true">
            <CornerDownLeft aria-hidden="true" />
          </kbd>
          Open
        </span>
        <span>
          <kbd className="kbd" aria-hidden="true">
            {window.desktop?.platform === 'darwin' ? <Command aria-hidden="true" /> : 'Ctrl'}
          </kbd>
          <kbd className="kbd" aria-hidden="true">
            K
          </kbd>
          Toggle
        </span>
      </div>
    </div>
  )
}
