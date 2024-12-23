import { ElectronAPI } from '@comfyorg/comfyui-electron-types'

export type InstallOptions = Parameters<ElectronAPI['installComfyUI']>[0]
export type TorchDeviceType = InstallOptions['device']

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
