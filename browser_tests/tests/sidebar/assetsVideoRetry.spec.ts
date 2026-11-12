import { expect, mergeTests } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

const videoJob = createRouteMockJob({
  id: 'video-job',
  preview_output: {
    filename: 'clip.mp4',
    subfolder: '',
    type: 'output',
    nodeId: '1',
    mediaType: 'video'
  }
})

async function mockInputFiles(page: Page) {
  await page.route('**/internal/files/input**', async (route) => {
    if (route.request().method().toUpperCase() !== 'GET') {
      await route.fallback()
      return
    }

    await route.fulfill({ json: [] })
  })
}

const videoRetryFixture = jobsRouteFixture.extend<{
  mediaRequests: () => number
}>({
  mediaRequests: [
    async ({ jobsRoutes, page }, use) => {
      await jobsRoutes.mockJobsQueue([])
      await jobsRoutes.mockJobsHistory([videoJob])
      await mockInputFiles(page)
      await mockViewFiles(page, {})
      let mediaRequests = 0
      await page.route(/\/api\/view\?.*filename=clip\.mp4/, async (route) => {
        if (route.request().resourceType() !== 'media') {
          await route.fallback()
          return
        }

        mediaRequests += 1
        if (mediaRequests === 1) {
          await route.fulfill({ status: 404 })
          return
        }

        await route.fulfill({
          status: 200,
          contentType: 'video/mp4',
          body: Buffer.alloc(0)
        })
      })
      await use(() => mediaRequests)
    },
    { auto: true }
  ]
})

const test = mergeTests(comfyPageFixture, videoRetryFixture)

test(
  'retries a gallery video after a failed load',
  { tag: '@ui' },
  async ({ comfyPage, mediaRequests }) => {
    const tab = comfyPage.menu.assetsTab
    await comfyPage.menu.assetsTab.open()

    await expect(tab.getAssetCardByName('clip')).toBeVisible()
    await expect
      .poll(mediaRequests, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(2)
  }
)
