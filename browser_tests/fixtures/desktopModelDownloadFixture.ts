import type { ComfyDownloadProgress } from '@comfyorg/comfyui-desktop-bridge-types'
import type { Page } from '@playwright/test'

import { desktopFixture } from '@e2e/fixtures/desktopFixture'

export interface RequestedModelDownload {
  url: string
  filename: string
  directory: string
}

declare global {
  interface Window {
    __modelDownloadMock?: {
      downloads: RequestedModelDownload[]
      listeners: ((progress: ComfyDownloadProgress) => void)[]
    }
  }
}

export class ModelDownloadHost {
  constructor(private readonly page: Page) {}

  /** Model downloads the renderer handed to the host, in order. */
  async downloads(): Promise<RequestedModelDownload[]> {
    return this.page.evaluate(() => window.__modelDownloadMock?.downloads ?? [])
  }

  /** Delivers one progress event to every listener the renderer registered. */
  async emitProgress(progress: ComfyDownloadProgress): Promise<void> {
    await this.page.evaluate((event) => {
      for (const listener of window.__modelDownloadMock?.listeners ?? []) {
        listener(event)
      }
    }, progress)
  }
}

export const desktopModelDownloadFixture = desktopFixture.extend<{
  modelDownloadHost: ModelDownloadHost
}>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const state = {
        downloads: [] as RequestedModelDownload[],
        listeners: [] as ((progress: ComfyDownloadProgress) => void)[]
      }
      window.__modelDownloadMock = state

      const bridge = {
        isRemote: () => false,
        downloadModel: async (
          url: string,
          filename: string,
          directory: string
        ) => {
          state.downloads.push({ url, filename, directory })
          const pending: ComfyDownloadProgress = {
            id: `host-job-${state.downloads.length}`,
            url,
            filename,
            directory,
            progress: 0,
            status: 'pending'
          }
          for (const listener of state.listeners) listener(pending)
          return true
        },
        onDownloadProgress: (
          listener: (progress: ComfyDownloadProgress) => void
        ) => {
          state.listeners.push(listener)
          return () => {
            state.listeners = state.listeners.filter(
              (registered) => registered !== listener
            )
          }
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
