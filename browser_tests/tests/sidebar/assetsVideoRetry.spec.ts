import { expect, mergeTests } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

const test = mergeTests(comfyPageFixture, jobsRouteFixture)

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

test.beforeEach(async ({ jobsRoutes, page }) => {
  await jobsRoutes.mockJobsQueue([])
  await jobsRoutes.mockJobsHistory([videoJob])
  await mockInputFiles(page)
  await mockViewFiles(page, {})
})

test(
  'retries a gallery video after a failed load',
  { tag: '@ui' },
  async ({ comfyPage }) => {
    let mediaRequests = 0
    await comfyPage.page.route(
      /\/api\/view\?.*filename=clip\.mp4/,
      async (route) => {
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
      }
    )

    const tab = comfyPage.menu.assetsTab
    // oxlint-disable-next-line comfy/no-comfy-page-setup-call -- pre-existing call, tracked by evfail-23; not fixed in this pass
    await comfyPage.setup()
    await comfyPage.menu.assetsTab.open()

    await expect(tab.getAssetCardByName('clip')).toBeVisible()
    await expect
      .poll(() => mediaRequests, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(2)
  }
)
