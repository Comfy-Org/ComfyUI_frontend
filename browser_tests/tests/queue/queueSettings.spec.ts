import { mergeTests } from '@playwright/test'
import type { Locator, Page, Request } from '@playwright/test'
import type { JobsListResponse } from '@comfyorg/ingest-types'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { createMockJobs } from '@e2e/fixtures/helpers/AssetsHelper'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const TOTAL_MOCK_JOBS = 20
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

/**
 * Walks the virtualized job list and returns the set of distinct `data-job-id`
 * values rendered across the full scroll range. Robust to viewports smaller
 * than the configured cap, where overscan alone wouldn't keep every row in the
 * DOM.
 */
async function collectAllRenderedJobIds(page: Page): Promise<Set<string>> {
  const jobs = getJobListResults(page)
  const seen = new Set<string>()

  async function captureRendered(): Promise<void> {
    const rows = await jobs.all()
    const ids = await Promise.all(
      rows.map((row: Locator) => row.getAttribute('data-job-id'))
    )
    for (const id of ids) if (id !== null) seen.add(id)
  }

  await jobs.first().scrollIntoViewIfNeeded()
  await captureRendered()
  await jobs.last().scrollIntoViewIfNeeded()
  await captureRendered()

  return seen
}

test.describe('Queue settings', { tag: '@canvas' }, () => {
  test.describe('Comfy.Queue.MaxHistoryItems', () => {
    test.describe('limit query parameter', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.assets.mockOutputHistory(
          createMockJobs(TOTAL_MOCK_JOBS)
        )
      })

      test.afterEach(async ({ comfyPage }) => {
        await comfyPage.assets.clearMocks()
      })

      test('limit query parameter on /api/jobs reflects the setting', async ({
        comfyPage,
        getWebSocket
      }) => {
        const TARGET_LIMIT = 6
        await comfyPage.settings.setSetting(
          'Comfy.Queue.MaxHistoryItems',
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
        'Comfy.Queue.MaxHistoryItems',
        VISIBLE_LIMIT
      )
      const exec = new ExecutionHelper(comfyPage, await getWebSocket())
      await captureNextHistoryRequest(comfyPage, exec)

      await comfyPage.page.getByTestId(TestIds.queue.overlayToggle).click()
      const latest = getJobListResults(comfyPage.page).first()
      await expect(latest).toBeVisible()

      await expect
        .poll(async () => (await collectAllRenderedJobIds(comfyPage.page)).size)
        .toBe(VISIBLE_LIMIT)
    })
  })
})
