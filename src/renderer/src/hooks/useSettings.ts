import { useCallback, useEffect, useState } from 'react'
import {
  DEFAULT_SETTINGS,
  type AccentId,
  type Settings
} from '@shared/types'

const STORAGE_KEY = 'cloudwave.settings.v1'

const ACCENTS: AccentId[] = ['ember', 'coral', 'lime', 'cyan', 'violet']

function clamp01(value: unknown, fallback: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(1, Math.max(0, numeric))
}

/** Reads persisted settings and drops anything malformed instead of trusting disk. */
export function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      accent: ACCENTS.includes(parsed.accent as AccentId)
        ? (parsed.accent as AccentId)
        : DEFAULT_SETTINGS.accent,
      reduceMotion: Boolean(parsed.reduceMotion ?? DEFAULT_SETTINGS.reduceMotion),
      hideAds: Boolean(parsed.hideAds ?? DEFAULT_SETTINGS.hideAds),
      alwaysOnTop: Boolean(parsed.alwaysOnTop ?? DEFAULT_SETTINGS.alwaysOnTop),
      sidebarCollapsed: Boolean(parsed.sidebarCollapsed ?? DEFAULT_SETTINGS.sidebarCollapsed),
      showRecents: Boolean(parsed.showRecents ?? DEFAULT_SETTINGS.showRecents),
      volume: clamp01(parsed.volume, DEFAULT_SETTINGS.volume)
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export interface UseSettingsResult {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}

export function useSettings(): UseSettingsResult {
  const [settings, setSettings] = useState<Settings>(readSettings)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.accent = settings.accent
    root.dataset.reduceMotion = String(settings.reduceMotion)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      /* storage can be unavailable; the shell still works for this session */
    }
  }, [settings])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((previous) => ({ ...previous, ...patch }))
  }, [])

  return { settings, updateSettings }
}
