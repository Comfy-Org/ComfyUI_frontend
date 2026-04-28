import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

const now = Date.now()

const COMPLETED_JOBS: RawJobListItem[] = [
  createMockJob({
    id: 'job-completed-1',
    status: 'completed',
    create_time: now - 60,
    execution_start_time: now - 60,
    execution_end_time: now - 50,
    outputs_count: 2
  }),
  createMockJob({
    id: 'job-completed-2',
    status: 'completed',
    create_time: now - 120,
    execution_start_time: now - 120,
    execution_end_time: now - 115,
    outputs_count: 1
  })
]

const FAILED_JOBS: RawJobListItem[] = [
  createMockJob({
    id: 'job-failed-1',
    status: 'failed',
    create_time: now - 30,
    execution_start_time: now - 30,
    execution_end_time: now - 28,
    outputs_count: 0
  })
]

const ALL_JOBS = [...COMPLETED_JOBS, ...FAILED_JOBS]

// ==========================================================================
// 1. Tab open and job display
// ==========================================================================

test.describe('Job history sidebar - display', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(ALL_JOBS)
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', true)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Opens job history tab and shows job items', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await tab.waitForJobsLoad()
    await expect
      .poll(() => tab.jobItems.count(), { timeout: 5000 })
      .toBeGreaterThanOrEqual(1)
  })

  test('Shows All, Completed filter tabs', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await expect(tab.allTab).toBeVisible()
    await expect(tab.completedTab).toBeVisible()
  })

  test('Shows Failed tab when failed jobs exist', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await tab.waitForJobsLoad()
    await expect(tab.failedTab).toBeVisible()
  })

  test('Shows search input and filter/sort buttons', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await expect(tab.searchInput).toBeVisible()
    await expect(tab.filterButton).toBeVisible()
    await expect(tab.sortButton).toBeVisible()
  })
})

// ==========================================================================
// 2. Filter tabs
// ==========================================================================

test.describe('Job history sidebar - filter tabs', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(ALL_JOBS)
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', true)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Completed tab filters to completed jobs only', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()
    await tab.waitForJobsLoad()

    await tab.completedTab.click()

    await expect(tab.getJobById('job-completed-1')).toBeVisible({
      timeout: 5000
    })
    await expect(tab.getJobById('job-failed-1')).toBeHidden()
  })

  test('Failed tab filters to failed jobs only', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()
    await tab.waitForJobsLoad()

    await tab.failedTab.click()

    await expect(tab.getJobById('job-failed-1')).toBeVisible({ timeout: 5000 })
    await expect(tab.getJobById('job-completed-1')).toBeHidden()
  })

  test('All tab shows all jobs again', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()
    await tab.waitForJobsLoad()

    // Switch to Completed then back to All
    await tab.completedTab.click()
    await expect(tab.getJobById('job-failed-1')).toBeHidden()

    await tab.allTab.click()

    await expect(tab.getJobById('job-completed-1')).toBeVisible({
      timeout: 5000
    })
    await expect(tab.getJobById('job-failed-1')).toBeVisible({ timeout: 5000 })
  })
})

// ==========================================================================
// 3. Search
// ==========================================================================

test.describe('Job history sidebar - search', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(ALL_JOBS)
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', true)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Search filters jobs by text', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()
    await tab.waitForJobsLoad()
    await expect(tab.jobItems).toHaveCount(ALL_JOBS.length, { timeout: 5000 })

    const initialCount = await tab.jobItems.count()

    // Search for a specific job ID substring
    await tab.searchInput.fill('failed')

    // Wait for filter to reduce count (150ms debounce)
    await expect
      .poll(() => tab.jobItems.count(), { timeout: 5000 })
      .toBeLessThan(initialCount)
  })
})

// ==========================================================================
// 4. Empty state
// ==========================================================================

test.describe('Job history sidebar - empty state', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory([])
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', true)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Shows no active jobs when history is empty', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await expect(tab.noActiveJobsText).toBeVisible()
    await expect(tab.jobItems).toHaveCount(0)
  })

  test('Failed tab is hidden when no failed jobs exist', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await expect(tab.failedTab).toBeHidden()
  })
})

// ==========================================================================
// 5. Only completed jobs (no failed tab)
// ==========================================================================

test.describe('Job history sidebar - completed only', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(COMPLETED_JOBS)
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', true)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Failed tab hidden when only completed jobs exist', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()
    await tab.waitForJobsLoad()

    await expect(tab.failedTab).toBeHidden()
    await expect(tab.allTab).toBeVisible()
    await expect(tab.completedTab).toBeVisible()
  })
})
