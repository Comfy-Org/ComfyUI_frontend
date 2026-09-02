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
    outputs_count: 2
  }),
  createRouteMockJob({
    id: 'job-completed-2',
    status: 'completed',
    create_time: mockJobTimestamp - 120_000,
    execution_start_time: mockJobTimestamp - 120_000,
    execution_end_time: mockJobTimestamp - 115_000,
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
    id: 'job-failed-bottom',
    status: 'failed',
    create_time: mockJobTimestamp - 180_000,
    execution_start_time: mockJobTimestamp - 180_000,
    execution_end_time: mockJobTimestamp - 178_000,
    outputs_count: 0
  })
]

test.describe('Queue overlay', () => {
  test.beforeEach(async ({ comfyPage, jobsRoutes }) => {
    await jobsRoutes.mockJobsScenario({ history: MOCK_JOBS, queue: [] })
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', false)
    await comfyPage.setup()
  })

  test('Toggle button opens expanded queue overlay', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    // Expanded overlay should show job items
    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()
  })

  test('Overlay shows filter tabs (All, Completed)', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(
      comfyPage.page.getByRole('button', { name: 'All', exact: true })
    ).toBeVisible()
    await expect(
      comfyPage.page.getByRole('button', { name: 'Completed', exact: true })
    ).toBeVisible()
  })

  test('Overlay shows Failed tab when failed jobs exist', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()

    await expect(
      comfyPage.page.getByRole('button', { name: 'Failed', exact: true })
    ).toBeVisible()
  })

  test('Completed filter shows only completed jobs', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()

    await comfyPage.page
      .getByRole('button', { name: 'Completed', exact: true })
      .click()

    await expect(
      comfyPage.page.locator('[data-job-id="job-completed-1"]')
    ).toBeVisible()
    await expect(
      comfyPage.page.locator('[data-job-id="job-failed-1"]')
    ).toBeHidden()
  })

  test('Toggling overlay again closes it', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible()

    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeHidden()
  })

  test('Job details popover stays inside the viewport for bottom rows', async ({
    comfyPage
  }) => {
    await comfyPage.page.setViewportSize({ width: 1280, height: 420 })

    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    const bottomJob = comfyPage.page.locator(
      '[data-job-id="job-failed-bottom"]'
    )
    await expect(bottomJob).toBeVisible()
    await bottomJob.scrollIntoViewIfNeeded()
    await expect(bottomJob).toBeVisible()

    const viewportSize = comfyPage.page.viewportSize()
    if (!viewportSize) throw new Error('Viewport must be available')

    const rowBox = await bottomJob.boundingBox()
    if (!rowBox) throw new Error('Bottom job row should be measurable')
    expect(
      rowBox.y + rowBox.height,
      'Test row should be low enough to exercise bottom-edge collision handling'
    ).toBeGreaterThan(viewportSize.height * 0.55)
    await expect
      .poll(async () =>
        bottomJob.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          const hitTarget = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2
          )
          return hitTarget ? element.contains(hitTarget) : false
        })
      )
      .toBe(true)

    await comfyPage.page.mouse.move(0, 0)
    await comfyPage.page.mouse.move(
      rowBox.x + rowBox.width / 2,
      rowBox.y + rowBox.height / 2,
      { steps: 5 }
    )

    const popover = comfyPage.page.getByTestId(TestIds.queue.jobDetailsPopover)
    await expect(popover).toBeVisible()

    await expect
      .poll(async () => {
        const popoverBox = await popover.boundingBox()
        if (!popoverBox) return false

        return (
          popoverBox.y >= 0 &&
          popoverBox.y + popoverBox.height <= viewportSize.height
        )
      })
      .toBe(true)
  })
})
