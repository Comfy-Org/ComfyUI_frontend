import type { Page } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'

export async function mockDeployMedia(page: Page): Promise<void> {
  await page.route(
    'https://media.comfy.org/website/cloud-deploy/**',
    (route) => {
      const url = route.request().url()
      if (url.endsWith('.webm')) {
        return route.fulfill({
          path: assetPath('video/video-preview-wide.webm')
        })
      }
      if (url.endsWith('.mp4')) {
        return route.fulfill({ path: assetPath('plain_video.mp4') })
      }
      return route.fulfill({ path: assetPath('image64x64.webp') })
    }
  )
}

export const deployToComfyApiTest = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    await mockDeployMedia(page)
    await use(page)
  }
})
