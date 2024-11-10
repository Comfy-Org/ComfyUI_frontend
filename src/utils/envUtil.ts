import { ElectronAPI } from '@comfyorg/comfyui-electron-types'

export function isElectron() {
  return 'electronAPI' in window && window['electronAPI'] !== undefined
}

export function electronAPI() {
  return (window as any)['electronAPI'] as ElectronAPI
}
