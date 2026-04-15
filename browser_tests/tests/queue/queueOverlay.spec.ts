import { expect, mergeTests } from '@playwright/test'
import type { JobEntry } from '@comfyorg/ingest-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { jobsBackendFixture } from '@e2e/fixtures/jobsBackendFixture'
import {
  createMockJob,
  createSeededJobs
} from '@e2e/fixtures/helpers/jobFixtures'
import { TestIds } from '@e2e/fixtures/selectors'

const test = mergeTests(comfyPageFixture, jobsBackendFixture)

const now = Date.now()

const MOCK_JOBS: JobEntry[] = [
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
  test.beforeEach(async ({ comfyPage, jobsBackend }) => {
    await jobsBackend.seed(createSeededJobs(MOCK_JOBS))
    await comfyPage.setupSettings({
      'Comfy.Queue.QPOV2': false
    })
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
})
