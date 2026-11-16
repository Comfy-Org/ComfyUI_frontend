import type { ElectronAPI } from '@comfyorg/comfyui-electron-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'

export const desktopFixture = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const electronAPI = {
        getElectronVersion: async () => '1.0.0',
        getComfyUIVersion: () => '0.0.0',
        getPlatform: () => 'win32',
        changeTheme: () => {}
      } satisfies Partial<ElectronAPI>
      Object.assign(window, { electronAPI })
    })
    await use(page)
  }
})
