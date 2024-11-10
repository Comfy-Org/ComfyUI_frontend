import { defineConfig, Plugin } from 'vite'
import { mergeConfig } from 'vite'
import type { UserConfig } from 'vitest/config'
import baseConfig from './vite.config.mts'
import type { ElectronAPI } from '@comfyorg/comfyui-electron-types'

const electronAPIMock: Partial<ElectronAPI> = {
  sendReady: () => {},
  onShowSelectDirectory: () => {},
  onFirstTimeSetupComplete: () => {},
  onProgressUpdate: () => {},
  onLogMessage: () => {},
  isFirstTimeSetup: () => Promise.resolve(true)
}

const mockElectronAPI: Plugin = {
  name: 'mock-electron-api',
  transformIndexHtml() {
    return [
      {
        tag: 'script',
        children: `window.electronAPI = ${JSON.stringify(electronAPIMock)};`
      }
    ]
  }
}

export default mergeConfig(
  baseConfig as unknown as UserConfig,
  defineConfig({
    plugins: [mockElectronAPI]
  })
)