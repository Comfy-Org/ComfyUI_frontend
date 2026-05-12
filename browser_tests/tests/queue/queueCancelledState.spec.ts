import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture
} from '@e2e/fixtures/jobsRouteFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

const test = mergeTests(comfyPageFixture, jobsRouteFixture)
const mockJobTimestamp = Date.UTC(2026, 0, 1, 12)

const MOCK_JOBS: RawJobListItem[] = [
  createRouteMockJob({
    id: 'job-completed-1',
    status: 'completed',
    create_time: mockJobTimestamp - 60_000,
    execution_start_time: mockJobTimestamp - 60_000,
    execution_end_time: mockJobTimestamp - 50_000,
    outputs_count: 1
  }),
  createRouteMockJob({
    id: 'job-failed-1',
    status: 'failed',
    create_time: mockJobTimestamp - 30_000,
    execution_start_time: mockJobTimestamp - 30_000,
    execution_end_time: mockJobTimestamp - 28_000,
    outputs_count: 0
  }),
  createRouteMockJob({
    id: 'job-cancelled-1',
    status: 'cancelled',
    create_time: mockJobTimestamp - 20_000,
    execution_start_time: mockJobTimestamp - 20_000,
    execution_end_time: mockJobTimestamp - 19_000,
    outputs_count: 0
  })
]

test.describe('Queue cancelled state', () => {
  test.beforeEach(async ({ comfyPage, jobsRoutes }) => {
    await jobsRoutes.mockJobsScenario({ history: MOCK_JOBS, queue: [] })
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
    jobsRoutes
  }) => {
    const completedOnly: RawJobListItem[] = [
      createRouteMockJob({
        id: 'job-only-completed',
        status: 'completed',
        create_time: mockJobTimestamp,
        execution_start_time: mockJobTimestamp,
        execution_end_time: mockJobTimestamp + 1_000,
        outputs_count: 1
      })
    ]
    await jobsRoutes.mockJobsScenario({ history: completedOnly, queue: [] })
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
