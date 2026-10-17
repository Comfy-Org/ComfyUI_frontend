import type { ElectronAPI } from '@comfyorg/comfyui-electron-types'

import { isLegacyDesktopBuild } from '@/platform/distribution/types'

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
  return (
    isLegacyDesktopBuild && !!window.navigator.windowControlsOverlay?.visible
  )
}
