import type { Page } from '@playwright/test'

import { desktopFixture } from '@e2e/fixtures/desktopFixture'

export interface RequestedModelDownload {
  url: string
  filename: string
  directory: string
}

declare global {
  interface Window {
    __modelDownloadMock?: { downloads: RequestedModelDownload[] }
  }
}

export class ModelDownloadHost {
  constructor(private readonly page: Page) {}

  /** Model downloads the renderer handed to the host, in order. */
  async downloads(): Promise<RequestedModelDownload[]> {
    return this.page.evaluate(() => window.__modelDownloadMock?.downloads ?? [])
  }
}

export const desktopModelDownloadFixture = desktopFixture.extend<{
  modelDownloadHost: ModelDownloadHost
}>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const state = { downloads: [] as RequestedModelDownload[] }
      window.__modelDownloadMock = state

      const bridge = {
        isRemote: () => false,
        downloadModel: async (
          url: string,
          filename: string,
          directory: string
        ) => {
          state.downloads.push({ url, filename, directory })
          return true
        }
      }

      Object.assign(window, {
        __comfyDesktop2: { ...window.__comfyDesktop2, ...bridge }
      })
    })
    await use(page)
  },

  modelDownloadHost: async ({ page }, use) => {
    await use(new ModelDownloadHost(page))
  }
})
