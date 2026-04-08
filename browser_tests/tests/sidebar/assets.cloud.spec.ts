import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { ComfyPage } from '../../fixtures/ComfyPage'
import { createMockJob } from '../../fixtures/helpers/AssetsHelper'
import type { RawJobListItem } from '../../../src/platform/remote/comfyui/jobs/jobTypes'

const TEST_API_KEY = 'playwright-cloud-api-key'
const TEST_USERNAME = 'playwright-cloud-assets'
const PLAYWRIGHT_TEST_URL =
  process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

type SeedCloudSessionArgs = {
  apiKey: string
  userId: string
  username: string
}

const SAMPLE_JOBS: RawJobListItem[] = [
  createMockJob({
    id: 'job-alpha',
    create_time: 1000,
    execution_start_time: 1000,
    execution_end_time: 1010,
    preview_output: {
      filename: 'landscape.png',
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    },
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-gamma',
    create_time: 3000,
    execution_start_time: 3000,
    execution_end_time: 3020,
    preview_output: {
      filename: 'abstract_art.png',
      subfolder: '',
      type: 'output',
      nodeId: '3',
      mediaType: 'images'
    },
    outputs_count: 2
  })
]

async function seedCloudSession(userId: string, page: Page) {
  await page.addInitScript(
    ({ apiKey, userId: seededUserId, username }: SeedCloudSessionArgs) => {
      localStorage.clear()
      sessionStorage.clear()
      localStorage.setItem('comfy_api_key', apiKey)
      localStorage.setItem('Comfy.userId', seededUserId)
      localStorage.setItem('Comfy.userName', username)
    },
    {
      apiKey: TEST_API_KEY,
      userId,
      username: TEST_USERNAME
    } satisfies SeedCloudSessionArgs
  )
}

test.describe(
  'Assets sidebar - cloud multi-output download',
  {
    tag: '@cloud'
  },
  () => {
    test('context menu Download creates a ZIP export for a multi-output job', async ({
      page,
      request
    }) => {
      const comfyPage = new ComfyPage(page, request)
      const userId = await comfyPage.setupUser(TEST_USERNAME)

      await seedCloudSession(userId, page)

      await comfyPage.setupSettings({
        'Comfy.UseNewMenu': 'Top',
        'Comfy.Graph.CanvasInfo': false,
        'Comfy.Graph.CanvasMenu': false,
        'Comfy.Canvas.SelectionToolbox': false,
        'Comfy.EnableTooltips': false,
        'Comfy.userId': userId,
        'Comfy.TutorialCompleted': true,
        'Comfy.VersionCompatibility.DisableWarnings': true,
        'Comfy.RightSidePanel.ShowErrorsTab': false
      })

      await page.route('**/api/features', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            comfy_api_base_url: `${PLAYWRIGHT_TEST_URL}/api`
          })
        })
      })

      await page.route('**/customers', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'customer-1'
          })
        })
      })

      await page.route('**/api/assets/exports', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            task_id: 'asset-export-task-1',
            status: 'queued'
          })
        })
      })

      await comfyPage.assets.mockOutputHistory(SAMPLE_JOBS)
      await comfyPage.assets.mockInputFiles([])
      await comfyPage.setup({ clearStorage: false })

      const tab = comfyPage.menu.assetsTab
      await tab.open()
      await tab.waitForAssets()

      const exportRequestPromise = page.waitForRequest((request) => {
        const url = new URL(request.url())
        return (
          request.method() === 'POST' &&
          url.pathname.endsWith('/api/assets/exports')
        )
      })

      await tab
        .getAssetCardByName('abstract_art.png')
        .dispatchEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          button: 2
        })

      await expect(page.locator('.p-contextmenu')).toBeVisible()
      await tab.contextMenuItem('Download').click()

      const exportRequest = await exportRequestPromise
      const payload = exportRequest.postDataJSON() as {
        job_ids?: string[]
        naming_strategy?: string
        job_asset_name_filters?: Record<string, string[]>
      }

      expect(payload.job_ids).toEqual(['job-gamma'])
      expect(payload.naming_strategy).toBe('preserve')
      expect(payload.job_asset_name_filters).toBeUndefined()
    })
  }
)
