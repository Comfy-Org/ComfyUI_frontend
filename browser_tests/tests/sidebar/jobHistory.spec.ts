import { expect } from '@playwright/test'
import type { Locator } from '@playwright/test'

import type { RawJobListItem } from '../../../src/platform/remote/comfyui/jobs/jobTypes'
import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

const VIRTUALIZED_ROW_LIMIT = 48
const HEADER_ROW_HEIGHT = 20
const JOB_ROW_HEIGHT = 48
const GROUP_ROW_GAP = 16
const GROUP_JOB_COUNTS = [6, 58]
const GROUP_BASE_TIMES = [
  Date.parse('2026-03-26T20:00:00-07:00'),
  Date.parse('2026-03-25T20:00:00-07:00')
]
const GROUP_BOUNDARY_JOB_ID = `job-${GROUP_JOB_COUNTS[0] - 1}`
const LAST_JOB_ID = `job-${GROUP_JOB_COUNTS[0] + GROUP_JOB_COUNTS[1] - 1}`

function buildCompletedJobs(): RawJobListItem[] {
  return GROUP_BASE_TIMES.flatMap((baseTime, groupIndex) =>
    Array.from({ length: GROUP_JOB_COUNTS[groupIndex] }, (_, jobIndex) => {
      const endTime = baseTime - jobIndex * 5 * 60_000
      const id =
        GROUP_JOB_COUNTS.slice(0, groupIndex).reduce(
          (total, count) => total + count,
          0
        ) + jobIndex

      return {
        id: `job-${id}`,
        status: 'completed',
        create_time: endTime,
        execution_start_time: endTime - 10_000,
        execution_end_time: endTime,
        workflow_id: 'workflow-1'
      }
    })
  )
}

async function getRowMetrics(jobHistoryList: Locator, boundaryJobId: string) {
  return await jobHistoryList.evaluate((element, jobId) => {
    const wrapper = element.firstElementChild
    const firstHeader = wrapper?.firstElementChild
    const firstJob = element.querySelector('[data-job-id="job-0"]')
    const boundaryJob = element.querySelector(`[data-job-id="${jobId}"]`)

    if (
      !(wrapper instanceof HTMLElement) ||
      !(firstHeader instanceof HTMLElement) ||
      !(firstJob instanceof HTMLElement) ||
      !(boundaryJob instanceof HTMLElement) ||
      !(firstJob.parentElement instanceof HTMLElement) ||
      !(boundaryJob.parentElement instanceof HTMLElement)
    ) {
      throw new Error('Expected virtualized job rows to be present')
    }

    return {
      firstHeaderHeight: firstHeader.getBoundingClientRect().height,
      firstHeaderScrollHeight: firstHeader.scrollHeight,
      firstJobContentHeight: firstJob.getBoundingClientRect().height,
      firstJobRowHeight: firstJob.parentElement.getBoundingClientRect().height,
      boundaryJobContentHeight: boundaryJob.getBoundingClientRect().height,
      boundaryJobRowHeight:
        boundaryJob.parentElement.getBoundingClientRect().height
    }
  }, boundaryJobId)
}

test.describe('Job history sidebar', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(buildCompletedJobs())
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
    await expect(jobRow(LAST_JOB_ID)).toHaveCount(0)

    const initialRenderedRows = await jobRows.count()
    expect(initialRenderedRows).toBeLessThan(VIRTUALIZED_ROW_LIMIT)

    const rowMetrics = await getRowMetrics(
      jobHistoryList,
      GROUP_BOUNDARY_JOB_ID
    )
    expect(rowMetrics.firstHeaderHeight).toBe(HEADER_ROW_HEIGHT)
    expect(rowMetrics.firstHeaderScrollHeight).toBeLessThanOrEqual(
      HEADER_ROW_HEIGHT
    )
    expect(rowMetrics.firstJobContentHeight).toBe(JOB_ROW_HEIGHT)
    expect(rowMetrics.firstJobRowHeight).toBe(JOB_ROW_HEIGHT)
    expect(rowMetrics.boundaryJobContentHeight).toBe(JOB_ROW_HEIGHT)
    expect(rowMetrics.boundaryJobRowHeight).toBe(JOB_ROW_HEIGHT + GROUP_ROW_GAP)

    await jobHistoryList.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await comfyPage.nextFrame()

    await expect(jobRow(LAST_JOB_ID)).toBeVisible()
    await expect(jobRow('job-0')).toHaveCount(0)

    const renderedRowsAfterScroll = await jobRows.count()
    expect(renderedRowsAfterScroll).toBeLessThan(VIRTUALIZED_ROW_LIMIT)
  })
})
