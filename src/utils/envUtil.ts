import type { ElectronAPI } from '@comfyorg/comfyui-electron-types'

import { isDesktop } from '@/platform/distribution/types'

export function electronAPI() {
  return (window as any).electronAPI as ElectronAPI
}

export function showNativeSystemMenu() {
  electronAPI()?.showContextMenu()
}

export function isNativeWindow() {
  return isDesktop && !!window.navigator.windowControlsOverlay?.visible
}
