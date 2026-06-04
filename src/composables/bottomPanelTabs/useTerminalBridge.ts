import { electronAPI } from '@/utils/envUtil'

/** Scrollback + size + liveness snapshot used to repaint a terminal. */
export interface TerminalRestore {
  buffer: string[]
  size: { cols: number; rows: number }
  exited?: boolean
}

/**
 * Host-agnostic interactive terminal transport.
 *
 * Two hosts can provide one: the legacy ComfyUI Desktop (`electronAPI().Terminal`)
 * and ComfyUI Desktop 2.0 (`window.__comfyDesktop2.Terminal`). The launcher host
 * additionally reports when the user kills the shell and can restart it; the
 * legacy host can't, so those members are nullable.
 */
export interface TerminalBridge {
  subscribe(): Promise<TerminalRestore>
  write(data: string): Promise<void>
  resize(cols: number, rows: number): Promise<void>
  /** Kill and respawn the shell. `null` when the host can't restart. */
  restart: (() => Promise<TerminalRestore>) | null
  onOutput(callback: (data: string) => void): () => void
  /** Notified when the shell exits. `null` when the host doesn't report it. */
  onExited: ((callback: () => void) => () => void) | null
}

interface Desktop2Terminal {
  subscribe(): Promise<TerminalRestore>
  unsubscribe(): Promise<void>
  write(data: string): Promise<void>
  resize(cols: number, rows: number): Promise<void>
  restart(): Promise<TerminalRestore>
  onOutput(callback: (data: string) => void): () => void
  onExited(callback: () => void): () => void
}

declare global {
  interface Window {
    __comfyDesktop2?: { Terminal?: Desktop2Terminal }
  }
}

/** Resolve whichever terminal host is present, or `null` (e.g. a browser tab). */
export function getTerminalBridge(): TerminalBridge | null {
  const launcher = window.__comfyDesktop2?.Terminal
  if (launcher) {
    return {
      subscribe: () => launcher.subscribe(),
      write: (data) => launcher.write(data),
      resize: (cols, rows) => launcher.resize(cols, rows),
      restart: () => launcher.restart(),
      onOutput: (callback) => launcher.onOutput(callback),
      onExited: (callback) => launcher.onExited(callback)
    }
  }

  const legacy = electronAPI()?.Terminal
  if (legacy) {
    return {
      subscribe: () => legacy.restore(),
      write: (data) => legacy.write(data),
      resize: (cols, rows) => legacy.resize(cols, rows),
      restart: null,
      onOutput: (callback) => legacy.onOutput(callback),
      onExited: null
    }
  }

  return null
}

/** Whether any interactive terminal host is reachable from this surface. */
export function isTerminalHostAvailable(): boolean {
  return getTerminalBridge() !== null
}
