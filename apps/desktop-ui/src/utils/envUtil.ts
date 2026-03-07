import type { ElectronAPI } from '@comfyorg/comfyui-electron-types'

type ElectronWindow = typeof window & {
  electronAPI?: ElectronAPI
}

export function isElectron() {
  return 'electronAPI' in window && window.electronAPI !== undefined
}

export function electronAPI(): ElectronAPI {
  return (window as ElectronWindow).electronAPI as ElectronAPI
}

export function isNativeWindow() {
  return isElectron() && !!window.navigator.windowControlsOverlay?.visible
}
