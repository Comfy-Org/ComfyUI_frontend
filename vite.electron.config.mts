import { defineConfig, Plugin } from 'vite'
import { mergeConfig } from 'vite'
import type { UserConfig } from 'vitest/config'
import baseConfig from './vite.config.mts'

const mockElectronAPI: Plugin = {
  name: 'mock-electron-api',
  transformIndexHtml() {
    return [
      {
        tag: 'script',
        children: `window.electronAPI = {
          sendReady: () => {},
          onShowSelectDirectory: () => {},
          onFirstTimeSetupComplete: () => {},
          onProgressUpdate: () => {},
          onLogMessage: () => {},
          isFirstTimeSetup: () => Promise.resolve(true),
          getSystemPaths: () =>
            Promise.resolve({
              appData: 'C:/Users/username/AppData/Roaming',
              appPath: 'C:/Program Files/comfyui-electron/resources/app',
              defaultInstallPath: 'C:/Users/username/comfyui-electron'
            }),
          validateInstallPath: (path) => {
            if (path === 'bad') {
              return { isValid: false, error: 'Bad path!' }
            }
            return { isValid: true }
          },
          migrationItems: () =>
            Promise.resolve([
              {
                id: 'user_files',
                label: 'User Files',
                description: 'Settings and user-created workflows'
              }
            ]),
          validateComfyUISource: (path) => {
            if (path === 'bad') {
              return { isValid: false, error: 'Bad path!' }
            }
            return { isValid: true }
          },
          showDirectoryPicker: () => Promise.resolve('C:/Users/username/comfyui-electron/1')
        };`
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