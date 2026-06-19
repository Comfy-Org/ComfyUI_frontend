import { mergeTests } from '@playwright/test'
import type { Locator, Page, Request } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { webSocketFixture } from '@e2e/fixtures/ws'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

const test = mergeTests(comfyPageFixture, webSocketFixture, jobsRouteFixture)

const TOTAL_MOCK_JOBS = 20
const MAX_HISTORY_ITEMS_SETTING = 'Comfy.Queue.MaxHistoryItems'

function createMockJobs(count: number): RawJobListItem[] {
  const now = Date.now()
  return Array.from({ length: count }, (_, i) =>
    createRouteMockJob({
      id: `job-${String(i + 1).padStart(3, '0')}`,
      create_time: now - i * 60_000,
      execution_start_time: now - i * 60_000,
      execution_end_time: now - i * 60_000 + 5000
    })
  )
}

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
      test('limit query parameter on /api/jobs reflects the setting', async ({
        comfyPage,
        getWebSocket,
        jobsRoutes
      }) => {
        const TARGET_LIMIT = 6
        await jobsRoutes.mockJobsHistory(
          createMockJobs(TOTAL_MOCK_JOBS),
          TARGET_LIMIT
        )
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
      getWebSocket,
      jobsRoutes
    }) => {
      const VISIBLE_LIMIT = 6
      const overflowJobs = createMockJobs(TOTAL_MOCK_JOBS)
      await jobsRoutes.mockJobsHistory(overflowJobs, VISIBLE_LIMIT, {
        responseLimit: overflowJobs.length
      })
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
