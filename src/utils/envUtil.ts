import {
  ElectronAPI,
  ElectronContextMenuOptions
} from '@comfyorg/comfyui-electron-types'

export function isElectron() {
  return globalThis.electronAPI !== undefined
}

export function electronAPI() {
  return globalThis.electronAPI as ElectronAPI
}

export function showNativeMenu(options?: ElectronContextMenuOptions) {
  electronAPI()?.showContextMenu(options)
}
