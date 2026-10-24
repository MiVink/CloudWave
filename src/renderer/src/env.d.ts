import type { AppInfo, PlayerSnapshot } from '../../shared/types'
import type { CSSProperties, HTMLAttributes, Ref } from 'react'

/**
 * The <webview> tag is provided by Electron at runtime and is intentionally not
 * part of the DOM typings, so we describe the slice of its API we use.
 */
export interface ElectronWebviewElement extends HTMLElement {
  src: string
  loadURL(url: string): Promise<void>
  getURL(): string
  reload(): void
  stop(): void
  goBack(): void
  goForward(): void
  canGoBack(): boolean
  canGoForward(): boolean
  send(channel: string, ...args: unknown[]): void
  openDevTools(): void
  setZoomFactor(factor: number): void
  addEventListener(type: 'dom-ready', listener: () => void, options?: boolean | AddEventListenerOptions): void
  addEventListener(
    type: 'ipc-message',
    listener: (event: WebviewIpcEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: 'did-navigate' | 'did-navigate-in-page',
    listener: (event: WebviewNavigateEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: 'did-fail-load',
    listener: (event: WebviewFailEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: 'page-title-updated',
    listener: (event: WebviewTitleEvent) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: 'did-start-loading' | 'did-stop-loading',
    listener: () => void,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void
}

export interface WebviewIpcEvent extends Event {
  channel: string
  args: unknown[]
}

export interface WebviewNavigateEvent extends Event {
  url: string
  isMainFrame: boolean
  isSameDocument: boolean
}

export interface WebviewFailEvent extends Event {
  errorCode: number
  errorDescription: string
  validatedURL: string
  isMainFrame: boolean
}

export interface WebviewTitleEvent extends Event {
  title: string
  explicitSet: boolean
}

export interface WebviewJSXProps extends HTMLAttributes<ElectronWebviewElement> {
  src?: string
  preload?: string
  partition?: string
  allowpopups?: boolean
  useragent?: string
  webpreferences?: string
  ref?: Ref<ElectronWebviewElement>
  style?: CSSProperties
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      webview: WebviewJSXProps
    }
  }
}

declare global {
  interface Window {
    desktop?: {
      platform: string
      sitePreloadPath: string
      window: {
        minimize(): void
        maximize(): void
        close(): void
        isMaximized(): Promise<boolean>
        onMaximized(callback: (value: boolean) => void): () => void
      }
      app: {
        info(): Promise<AppInfo>
        openExternal(url: string): Promise<boolean>
        clearCache(): Promise<boolean>
        setAlwaysOnTop(value: boolean): Promise<boolean>
        relaunch(): Promise<void>
      }
      onNavigate(callback: (url: string) => void): () => void
      onMediaKey(callback: (action: 'playpause' | 'next' | 'prev') => void): () => void
    }
    /** Only exposed with ?demo=1 — used by the screenshot harness. */
    __cloudwave?: {
      demo(kind: 'home' | 'web' | 'immersive' | 'settings' | 'palette'): void
      setPlayer(patch: Partial<PlayerSnapshot>): void
      addRecent(track: { title: string; artist: string; url?: string; artwork?: string }): void
    }
  }
}

export {}
