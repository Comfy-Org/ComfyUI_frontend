import type { ElectronAPI } from '@comfyorg/comfyui-electron-types'

function isElectron() {
  return 'electronAPI' in window && window.electronAPI !== undefined
}

export function electronAPI() {
  return (window as any).electronAPI as ElectronAPI
}

export function isNativeWindow() {
  return isDesktop && !!window.navigator.windowControlsOverlay?.visible
}

/** Distribution type check - desktop-ui always runs in desktop context */
export const isDesktop = isElectron()
