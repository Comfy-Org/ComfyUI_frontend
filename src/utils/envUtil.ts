import { ElectronAPI } from '@comfyorg/comfyui-electron-types'

export function isElectron() {
  return 'electronAPI' in window && window['electronAPI'] !== undefined
}

export function electronAPI() {
  return (window as any)['electronAPI'] as ElectronAPI
}

type NativeContextOptions = Parameters<ElectronAPI['showContextMenu']>[0]
export function showNativeMenu(options?: NativeContextOptions) {
  electronAPI()?.showContextMenu(options)
}
