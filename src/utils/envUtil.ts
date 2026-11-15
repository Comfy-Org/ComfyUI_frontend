import type { ElectronAPI } from '@comfyorg/comfyui-electron-types'

import { isDesktop } from '@/platform/distribution/types'

/**
 * Extend Window interface to include electronAPI
 * @public
 */
export type ElectronWindow = typeof window & {
  electronAPI?: ElectronAPI
}

export function electronAPI() {
  return (window as ElectronWindow).electronAPI as ElectronAPI
}

export function showNativeSystemMenu() {
  electronAPI().showContextMenu()
}

export function isNativeWindow() {
  return isDesktop && !!window.navigator.windowControlsOverlay?.visible
}

export function isLocalDesktopHost() {
  const bridge = window.__comfyDesktop2
  const isRemote = bridge?.isRemote?.() ?? window.__comfyDesktop2Remote ?? false
  return !isRemote && (isDesktop || bridge !== undefined)
}
