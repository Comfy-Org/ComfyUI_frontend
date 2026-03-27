import { expect } from '@playwright/test'

import type { RawJobListItem } from '../../../src/platform/remote/comfyui/jobs/jobTypes'
import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

const VIRTUALIZED_ROW_LIMIT = 48

function buildCompletedJobs(count: number): RawJobListItem[] {
  const now = Date.now()

  return Array.from({ length: count }, (_, index) => ({
    id: `job-${index}`,
    status: 'completed',
    create_time: now - index * 60_000,
    execution_start_time: now - index * 60_000 - 10_000,
    execution_end_time: now - index * 60_000,
    workflow_id: 'workflow-1'
  }))
}

test.describe('Job history sidebar', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(buildCompletedJobs(64))
    await comfyPage.setup()
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', true)
    await comfyPage.nextFrame()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('virtualizes large job history lists', async ({ comfyPage }) => {
    const jobHistoryButton = comfyPage.page.locator('.job-history-tab-button')
    const jobHistoryList = comfyPage.page.getByTestId('job-assets-list')
    const jobRows = comfyPage.page.locator(
      '.sidebar-content-container [data-job-id]'
    )
    const jobRow = (jobId: string) =>
      comfyPage.page.locator(
        `.sidebar-content-container [data-job-id="${jobId}"]`
      )

    await jobHistoryButton.click()
    await jobHistoryList.waitFor({ state: 'visible' })

    await expect(jobRow('job-0')).toBeVisible()
    await expect(jobRow('job-63')).toHaveCount(0)

    const initialRenderedRows = await jobRows.count()
    expect(initialRenderedRows).toBeLessThan(VIRTUALIZED_ROW_LIMIT)

    await jobHistoryList.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await comfyPage.nextFrame()

    await expect(jobRow('job-63')).toBeVisible()
    await expect(jobRow('job-0')).toHaveCount(0)

    const renderedRowsAfterScroll = await jobRows.count()
    expect(renderedRowsAfterScroll).toBeLessThan(VIRTUALIZED_ROW_LIMIT)
  })
})
