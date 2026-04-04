import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { createMockJob } from '../../fixtures/helpers/AssetsHelper'
import { TestIds } from '../../fixtures/selectors'
import type { RawJobListItem } from '../../../src/platform/remote/comfyui/jobs/jobTypes'

const now = Date.now()

const MOCK_JOBS: RawJobListItem[] = [
  createMockJob({
    id: 'job-completed-1',
    status: 'completed',
    create_time: now - 60_000,
    execution_start_time: now - 60_000,
    execution_end_time: now - 50_000,
    outputs_count: 2
  }),
  createMockJob({
    id: 'job-completed-2',
    status: 'completed',
    create_time: now - 120_000,
    execution_start_time: now - 120_000,
    execution_end_time: now - 115_000,
    outputs_count: 1
  }),
  createMockJob({
    id: 'job-failed-1',
    status: 'failed',
    create_time: now - 30_000,
    execution_start_time: now - 30_000,
    execution_end_time: now - 28_000,
    outputs_count: 0
  })
]

test.describe('Queue overlay', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(MOCK_JOBS)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Toggle button opens expanded queue overlay', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    // Expanded overlay should show job items
    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible({
      timeout: 5000
    })
  })

  test('Overlay shows filter tabs (All, Completed)', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(
      comfyPage.page.getByRole('button', { name: 'All', exact: true })
    ).toBeVisible({ timeout: 5000 })
    await expect(
      comfyPage.page.getByRole('button', { name: 'Completed', exact: true })
    ).toBeVisible()
  })

  test('Overlay shows Failed tab when failed jobs exist', async ({
    comfyPage
  }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible({
      timeout: 5000
    })

    await expect(
      comfyPage.page.getByRole('button', { name: 'Failed', exact: true })
    ).toBeVisible()
  })

  test('Completed filter shows only completed jobs', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible({
      timeout: 5000
    })

    await comfyPage.page
      .getByRole('button', { name: 'Completed', exact: true })
      .click()

    await expect(
      comfyPage.page.locator('[data-job-id="job-completed-1"]')
    ).toBeVisible({ timeout: 5000 })
    await expect(
      comfyPage.page.locator('[data-job-id="job-failed-1"]')
    ).not.toBeVisible()
  })

  test('Toggling overlay again closes it', async ({ comfyPage }) => {
    const toggle = comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
    await toggle.click()

    await expect(comfyPage.page.locator('[data-job-id]').first()).toBeVisible({
      timeout: 5000
    })

    await toggle.click()

    await expect(
      comfyPage.page.locator('[data-job-id]').first()
    ).not.toBeVisible({ timeout: 5000 })
  })
})
