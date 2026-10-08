import type {
  ComfyTemplateInputAsset,
  ComfyTemplateInputDownloadProgress
} from '@comfyorg/comfyui-desktop-bridge-types'
import type { Page } from '@playwright/test'

import { desktopFixture } from '@e2e/fixtures/desktopFixture'

/**
 * Seeds the host's answer for one template. Anything not seeded answers with an
 * empty asset list, the way a template that declares no inputs does.
 */
export interface TemplateInputSeed {
  templateId: string
  assets: ComfyTemplateInputAsset[]
}

declare global {
  interface Window {
    __templateInputMock?: {
      assetsByTemplate: Record<string, ComfyTemplateInputAsset[]>
      lookups: string[]
      downloads: { templateId: string; assetId: string }[]
      listeners: ((data: ComfyTemplateInputDownloadProgress) => void)[]
    }
  }
}

export class TemplateInputHost {
  constructor(private readonly page: Page) {}

  /** Template ids the renderer asked about, in order. */
  async lookups(): Promise<string[]> {
    return this.page.evaluate(() => window.__templateInputMock?.lookups ?? [])
  }

  /** Downloads the renderer requested, in order. */
  async downloads(): Promise<{ templateId: string; assetId: string }[]> {
    return this.page.evaluate(() => window.__templateInputMock?.downloads ?? [])
  }

  /**
   * Delivers one progress event to every listener the renderer registered.
   * The host decides when a download advances, so the test does too - nothing
   * here waits on a real transfer.
   */
  async emitProgress(
    progress: ComfyTemplateInputDownloadProgress
  ): Promise<void> {
    await this.page.evaluate((event) => {
      for (const listener of window.__templateInputMock?.listeners ?? []) {
        listener(event)
      }
    }, progress)
  }
}

export const desktopTemplateInputsFixture = desktopFixture.extend<{
  templateInputHost: TemplateInputHost
  seedTemplateInputs: (seeds: TemplateInputSeed[]) => Promise<void>
}>({
  /**
   * The bridge has to exist before the app boots, so it is installed here
   * rather than from the test body - `addInitScript` only reaches navigations
   * that have not happened yet. Seeding stays separate because the app reads
   * the host lazily, when a template is opened.
   */
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const state = {
        assetsByTemplate: {} as Record<string, ComfyTemplateInputAsset[]>,
        lookups: [] as string[],
        downloads: [] as { templateId: string; assetId: string }[],
        listeners: [] as ((data: ComfyTemplateInputDownloadProgress) => void)[]
      }
      window.__templateInputMock = state

      const bridge = {
        getTemplateInputAssets: async (templateId: string) => {
          state.lookups.push(templateId)
          return state.assetsByTemplate[templateId] ?? []
        },
        downloadTemplateInputAsset: async (
          templateId: string,
          assetId: string
        ) => {
          state.downloads.push({ templateId, assetId })
          const asset = (state.assetsByTemplate[templateId] ?? []).find(
            (candidate) => candidate.assetId === assetId
          )
          const download = {
            downloadId: `job-${assetId}`,
            filename: asset?.filename ?? `${assetId}.png`,
            progress: 0,
            status: 'pending' as const
          }
          // The host reports an admitted job straight away; the renderer
          // relies on that to know a file is spoken for before anything else
          // judges it missing.
          for (const listener of state.listeners) {
            listener({
              ...download,
              templateInputs: [{ templateId, assetId }]
            })
          }
          return { status: 'accepted' as const, download }
        },
        onTemplateInputDownloadProgress: (
          callback: (data: ComfyTemplateInputDownloadProgress) => void
        ) => {
          state.listeners.push(callback)
          return () => {
            state.listeners = state.listeners.filter(
              (listener) => listener !== callback
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

  templateInputHost: async ({ page }, use) => {
    await use(new TemplateInputHost(page))
  },

  seedTemplateInputs: async ({ page }, use) => {
    await use(async (seeds: TemplateInputSeed[]) => {
      await page.evaluate((seeded: TemplateInputSeed[]) => {
        const mock = window.__templateInputMock
        if (!mock) throw new Error('template input bridge was never installed')
        for (const { templateId, assets } of seeded) {
          mock.assetsByTemplate[templateId] = assets
        }
      }, seeds)
    })
  }
})
