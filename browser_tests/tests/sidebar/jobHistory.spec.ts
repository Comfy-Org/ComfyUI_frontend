import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { createMockJob } from '../../fixtures/helpers/AssetsHelper'
import type { RawJobListItem } from '../../../src/platform/remote/comfyui/jobs/jobTypes'

const now = Date.now()

const COMPLETED_JOBS: RawJobListItem[] = [
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
  })
]

const FAILED_JOBS: RawJobListItem[] = [
  createMockJob({
    id: 'job-failed-1',
    status: 'failed',
    create_time: now - 30_000,
    execution_start_time: now - 30_000,
    execution_end_time: now - 28_000,
    outputs_count: 0
  })
]

const ALL_JOBS = [...COMPLETED_JOBS, ...FAILED_JOBS]

// The job history sidebar tab uses the same /api/jobs endpoint as
// the assets tab. Mocks are set up via comfyPage.assets which
// intercepts /api/jobs and handles status/offset/limit query params.

// ==========================================================================
// 1. Tab open and job display
// ==========================================================================

test.describe('Job history sidebar - display', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(ALL_JOBS)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Opens job history tab and shows job items', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await expect(tab.jobItems.first()).toBeVisible({ timeout: 5000 })
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

    // Wait for job items to render (store needs to process the data)
    await expect(tab.jobItems.first()).toBeVisible({ timeout: 5000 })
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
    await expect(tab.jobItems.first()).toBeVisible({ timeout: 5000 })

    await tab.completedTab.click()

    // Should show completed jobs
    await expect(tab.getJobById('job-completed-1')).toBeVisible({
      timeout: 5000
    })
    // Failed job should not be visible
    await expect(tab.getJobById('job-failed-1')).not.toBeVisible()
  })

  test('Failed tab filters to failed jobs only', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()
    await expect(tab.jobItems.first()).toBeVisible({ timeout: 5000 })

    await tab.failedTab.click()

    await expect(tab.getJobById('job-failed-1')).toBeVisible({ timeout: 5000 })
    await expect(tab.getJobById('job-completed-1')).not.toBeVisible()
  })

  test('All tab shows all jobs again', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()
    await expect(tab.jobItems.first()).toBeVisible({ timeout: 5000 })

    // Switch to Completed then back to All
    await tab.completedTab.click()
    await expect(tab.getJobById('job-failed-1')).not.toBeVisible()

    await tab.allTab.click()

    await expect(tab.getJobById('job-completed-1')).toBeVisible({
      timeout: 5000
    })
    await expect(tab.getJobById('job-failed-1')).toBeVisible()
  })
})

// ==========================================================================
// 3. Search
// ==========================================================================

test.describe('Job history sidebar - search', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(ALL_JOBS)
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Search filters jobs by text', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()
    await expect(tab.jobItems.first()).toBeVisible({ timeout: 5000 })

    const initialCount = await tab.jobItems.count()

    // Search for a specific job ID substring
    await tab.searchInput.fill('failed')

    // Wait for filter to reduce count (150ms debounce)
    await expect(async () => {
      const count = await tab.jobItems.count()
      expect(count).toBeLessThan(initialCount)
    }).toPass({ timeout: 5000 })
  })
})

// ==========================================================================
// 4. Empty state
// ==========================================================================

test.describe('Job history sidebar - empty state', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory([])
    await comfyPage.setup()
  })

  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.assets.clearMocks()
  })

  test('Shows no active jobs when history is empty', async ({ comfyPage }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await expect(tab.noActiveJobsText).toBeVisible()
    expect(await tab.jobItems.count()).toBe(0)
  })

  test('Failed tab is hidden when no failed jobs exist', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.jobHistoryTab
    await tab.open()

    await expect(tab.failedTab).not.toBeVisible()
  })
})

// ==========================================================================
// 5. Only completed jobs (no failed tab)
// ==========================================================================

test.describe('Job history sidebar - completed only', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory(COMPLETED_JOBS)
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
    await expect(tab.jobItems.first()).toBeVisible({ timeout: 5000 })

    await expect(tab.failedTab).not.toBeVisible()
    await expect(tab.allTab).toBeVisible()
    await expect(tab.completedTab).toBeVisible()
  })
})
