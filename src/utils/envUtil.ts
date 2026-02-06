import type { ElectronAPI } from '@comfyorg/comfyui-electron-types'

/**
 * Extend Window interface to include electronAPI
 * Used by desktop-ui app storybook stories
 * @public
 */
export type ElectronWindow = typeof window & {
  electronAPI?: ElectronAPI
}

export function isElectron() {
  return 'electronAPI' in window && window.electronAPI !== undefined
}

export function electronAPI() {
  return (window as ElectronWindow).electronAPI as ElectronAPI
}

export function showNativeSystemMenu() {
  electronAPI()?.showContextMenu()
}

export function isNativeWindow() {
  return isElectron() && !!window.navigator.windowControlsOverlay?.visible
}
