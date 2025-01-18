import {
  ElectronAPI,
  ElectronContextMenuOptions
} from '@comfyorg/comfyui-electron-types'

export function isElectron() {
  return 'electronAPI' in window && window.electronAPI !== undefined
}

export function electronAPI() {
  return (window as any).electronAPI as ElectronAPI
}

export function showNativeMenu(options?: ElectronContextMenuOptions) {
  electronAPI()?.showContextMenu(options)
}

const normalizeVersion = (version: string) => {
  return version
    .split('.')
    .map(Number)
    .filter((v) => !Number.isNaN(v))
}

export function isVersionLessThan(versionA: string, versionB: string) {
  versionA ??= '0.0.0'
  versionB ??= '0.0.0'

  const normalizedA = normalizeVersion(versionA)
  const normalizedB = normalizeVersion(versionB)

  for (let i = 0; i < Math.max(normalizedA.length, normalizedB.length); i++) {
    const a = normalizedA[i] ?? 0
    const b = normalizedB[i] ?? 0
    if (a < b) return true
    if (a > b) return false
  }

  return false
}
