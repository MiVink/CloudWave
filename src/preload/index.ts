import { contextBridge, ipcRenderer } from 'electron'
import { join } from 'node:path'
import type { AppInfo } from '../shared/types'

const api = {
  platform: process.platform,
  /** Absolute path to the preload script injected into the SoundCloud <webview>. */
  sitePreloadPath: join(__dirname, 'site.js'),

  window: {
    minimize: (): void => ipcRenderer.send('win:minimize'),
    maximize: (): void => ipcRenderer.send('win:maximize'),
    close: (): void => ipcRenderer.send('win:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('win:is-maximized'),
    onMaximized: (callback: (value: boolean) => void): (() => void) => {
      const listener = (_event: unknown, value: boolean): void => callback(value)
      ipcRenderer.on('win:maximized', listener)
      return () => ipcRenderer.removeListener('win:maximized', listener)
    }
  },

  app: {
    info: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke('app:open-external', url),
    clearCache: (): Promise<boolean> => ipcRenderer.invoke('app:clear-cache'),
    setAlwaysOnTop: (value: boolean): Promise<boolean> => ipcRenderer.invoke('app:set-always-on-top', value),
    relaunch: (): Promise<void> => ipcRenderer.invoke('app:relaunch')
  },

  onNavigate: (callback: (url: string) => void): (() => void) => {
    const listener = (_event: unknown, url: string): void => callback(url)
    ipcRenderer.on('sc:navigate', listener)
    return () => ipcRenderer.removeListener('sc:navigate', listener)
  },

  onMediaKey: (callback: (action: 'playpause' | 'next' | 'prev') => void): (() => void) => {
    const channels = ['media:playpause', 'media:next', 'media:prev'] as const
    const listeners = channels.map((channel) => {
      const listener = (): void => callback(channel.replace('media:', '') as 'playpause' | 'next' | 'prev')
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    })
    return () => listeners.forEach((off) => off())
  }
}

contextBridge.exposeInMainWorld('desktop', api)

export type DesktopApi = typeof api
