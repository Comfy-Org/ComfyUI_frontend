import type { JobEntry } from '@comfyorg/ingest-types'
import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { jobsApiMockFixture } from '@e2e/fixtures/jobsApiMockFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  createMockJob,
  createMockJobRecords
} from '@e2e/fixtures/utils/jobFixtures'

const test = mergeTests(comfyPageFixture, jobsApiMockFixture)

const now = Date.now()

const MOCK_JOBS: JobEntry[] = [
  createMockJob({
    id: 'job-completed-1',
    status: 'completed',
    create_time: now - 60_000,
    execution_start_time: now - 60_000,
    execution_end_time: now - 50_000,
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-failed-1',
    status: 'failed',
    create_time: now - 30_000,
    execution_start_time: now - 30_000,
    execution_end_time: now - 28_000,
    outputs_count: 0
  }),
  createMockJob({
    id: 'job-cancelled-1',
    status: 'cancelled',
    create_time: now - 20_000,
    execution_start_time: now - 20_000,
    execution_end_time: now - 19_000,
    outputs_count: 0
  })
]

test.describe('Queue cancelled state', () => {
  test.beforeEach(async ({ comfyPage, jobsApi }) => {
    await jobsApi.mockJobs(createMockJobRecords(MOCK_JOBS))
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', false)
    await comfyPage.setup()
  })

  test('Cancelled tab is shown when cancelled jobs exist', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()

    await expect(
      comfyPage.page.getByRole('button', { name: 'Cancelled', exact: true })
    ).toBeVisible()
  })

  test('Cancelled tab is distinct from Failed tab', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()

    const failedTab = comfyPage.page.getByRole('button', {
      name: 'Failed',
      exact: true
    })
    const cancelledTab = comfyPage.page.getByRole('button', {
      name: 'Cancelled',
      exact: true
    })

    await expect(failedTab).toBeVisible()
    await expect(cancelledTab).toBeVisible()
  })

  test('Failed filter shows only failed jobs (excludes cancelled)', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()

    await comfyPage.page
      .getByRole('button', { name: 'Failed', exact: true })
      .click()

    await expect(
      comfyPage.page.locator('[data-job-id="job-failed-1"]')
    ).toBeVisible()
    await expect(
      comfyPage.page.locator('[data-job-id="job-cancelled-1"]')
    ).toBeHidden()
    await expect(
      comfyPage.page.locator('[data-job-id="job-completed-1"]')
    ).toBeHidden()
  })

  test('Cancelled filter shows only cancelled jobs (excludes failed)', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()

    await comfyPage.page
      .getByRole('button', { name: 'Cancelled', exact: true })
      .click()

    await expect(
      comfyPage.page.locator('[data-job-id="job-cancelled-1"]')
    ).toBeVisible()
    await expect(
      comfyPage.page.locator('[data-job-id="job-failed-1"]')
    ).toBeHidden()
    await expect(
      comfyPage.page.locator('[data-job-id="job-completed-1"]')
    ).toBeHidden()
  })

  test('Cancelled job details popover does not show an empty error container', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    const cancelledRow = comfyPage.page.locator(
      '[data-job-id="job-cancelled-1"]'
    )
    await expect(cancelledRow).toBeVisible()
    await cancelledRow.scrollIntoViewIfNeeded()

    const rowBox = await cancelledRow.boundingBox()
    if (!rowBox) throw new Error('Cancelled job row should be measurable')

    await comfyPage.page.mouse.move(0, 0)
    await comfyPage.page.mouse.move(
      rowBox.x + rowBox.width / 2,
      rowBox.y + rowBox.height / 2,
      { steps: 5 }
    )

    const popover = comfyPage.page.getByTestId(TestIds.queue.jobDetailsPopover)
    await expect(popover).toBeVisible()

    await expect(popover.getByText('Cancelled after')).toBeVisible()
    await expect(popover.getByText('Failed after')).toBeHidden()
    await expect(popover.getByText('Error message')).toBeHidden()
  })

  test('Hides Cancelled tab when no cancelled jobs are present', async ({
    comfyPage,
    jobsApi
  }) => {
    const completedOnly: JobEntry[] = [
      createMockJob({
        id: 'job-only-completed',
        status: 'completed',
        create_time: now,
        execution_start_time: now,
        execution_end_time: now + 1_000,
        outputs_count: 1
      })
    ]
    await jobsApi.mockJobs(createMockJobRecords(completedOnly))
    await comfyPage.page.reload()
    await comfyPage.setup()

    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(
      comfyPage.page.locator('[data-job-id="job-only-completed"]')
    ).toBeVisible()

    await expect(
      comfyPage.page.getByRole('button', { name: 'Cancelled', exact: true })
    ).toBeHidden()
  })
})
