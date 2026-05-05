import { mergeTests } from '@playwright/test'
import type { Locator, Page, Request } from '@playwright/test'
import type { JobsListResponse } from '@comfyorg/ingest-types'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { assetScenarioFixture } from '@e2e/fixtures/assetScenarioFixture'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { createMockJobs } from '@e2e/fixtures/utils/jobFixtures'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(
  comfyPageFixture,
  webSocketFixture,
  assetScenarioFixture
)

const TOTAL_MOCK_JOBS = 20
const MAX_HISTORY_ITEMS_SETTING = 'Comfy.Queue.MaxHistoryItems'
const overflowJobsListRoutePattern = '**/api/jobs?*'

function isHistoryJobsRequest(url: string): boolean {
  if (!url.includes('/api/jobs')) return false
  const params = new URL(url).searchParams
  const statuses = (params.get('status') ?? '').split(',')
  return statuses.includes('completed')
}

async function captureNextHistoryRequest(
  comfyPage: ComfyPage,
  exec: ExecutionHelper
): Promise<Request> {
  const requestPromise = comfyPage.page.waitForRequest(
    (req) => isHistoryJobsRequest(req.url()),
    { timeout: 5000 }
  )
  exec.status(0)
  return requestPromise
}

function getJobListResults(page: Page): Locator {
  return page.getByTestId(TestIds.queue.jobAssetsList).locator('[data-job-id]')
}

test.describe('Queue settings', { tag: '@canvas' }, () => {
  test.describe('Comfy.Queue.MaxHistoryItems', () => {
    test.describe('limit query parameter', () => {
      test.beforeEach(async ({ assetScenario }) => {
        await assetScenario.mockGeneratedHistory(
          createMockJobs(TOTAL_MOCK_JOBS)
        )
      })

      test('limit query parameter on /api/jobs reflects the setting', async ({
        comfyPage,
        getWebSocket
      }) => {
        const TARGET_LIMIT = 6
        await comfyPage.settings.setSetting(
          MAX_HISTORY_ITEMS_SETTING,
          TARGET_LIMIT
        )

        const exec = new ExecutionHelper(comfyPage, await getWebSocket())
        const request = await captureNextHistoryRequest(comfyPage, exec)
        const url = new URL(request.url())
        expect(url.searchParams.get('limit')).toBe(String(TARGET_LIMIT))
      })
    })

    test('queue panel caps history items to the configured number', async ({
      comfyPage,
      getWebSocket
    }) => {
      // Add a mock route that returns all jobs regardless of the request's `limit` param
      const overflowJobs = createMockJobs(TOTAL_MOCK_JOBS)
      await comfyPage.page.route(
        overflowJobsListRoutePattern,
        async (route) => {
          const url = new URL(route.request().url())
          if (!url.searchParams.get('status')?.includes('completed')) {
            await route.continue()
            return
          }
          const response = {
            jobs: overflowJobs,
            pagination: {
              offset: 0,
              limit: overflowJobs.length,
              total: overflowJobs.length,
              has_more: false
            }
          } satisfies {
            jobs: unknown[]
            pagination: JobsListResponse['pagination']
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response)
          })
        }
      )

      const VISIBLE_LIMIT = 6
      await comfyPage.settings.setSetting(
        MAX_HISTORY_ITEMS_SETTING,
        VISIBLE_LIMIT
      )
      const exec = new ExecutionHelper(comfyPage, await getWebSocket())
      await captureNextHistoryRequest(comfyPage, exec)

      await comfyPage.page.getByTestId(TestIds.queue.overlayToggle).click()
      const jobs = getJobListResults(comfyPage.page)
      await expect(jobs.first()).toBeVisible()
      await expect(jobs).toHaveCount(VISIBLE_LIMIT)
    })
  })
})
