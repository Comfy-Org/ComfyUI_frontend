import type { Locator } from '@playwright/test'
import { mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { exportDownloadResponse } from '@e2e/fixtures/data/staleTasks'
import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

const staleTasksFixture = base.extend<{
  comfyPage: ComfyPage
  staleTasks: {
    taskRequests: string[]
    downloadRequests: string[]
    downloadToast: Locator
    exportToast: Locator
  }
}>({
  staleTasks: [
    async ({ comfyPage }, use) => {
      const { page } = comfyPage
      const taskRequests: string[] = []
      const downloadRequests: string[] = []

      await page.clock.install()
      await page.route('**/api/tasks/**', async (route) => {
        taskRequests.push(route.request().url())
        await route.fulfill({ status: 404 })
      })
      await page.route('**/api/assets/exports/**', async (route) => {
        downloadRequests.push(route.request().url())
        await route.fulfill({ json: exportDownloadResponse })
      })

      await use({
        taskRequests,
        downloadRequests,
        downloadToast: page.getByRole('status').filter({
          has: page.getByRole('heading', { name: 'Importing Models' })
        }),
        exportToast: page.getByRole('status').filter({
          has: page.getByRole('heading', { name: 'Exporting Assets' })
        })
      })
    },
    { auto: true }
  ]
})

export const test = mergeTests(comfyPageFixture, staleTasksFixture)
