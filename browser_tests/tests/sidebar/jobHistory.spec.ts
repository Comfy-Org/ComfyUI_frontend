import { expect, mergeTests } from '@playwright/test'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  jobsRouteFixture,
  routeMockJobTimestamp
} from '@e2e/fixtures/jobsRouteFixture'
import type { JobsScenario } from '@e2e/fixtures/jobsRouteFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

const historyJobs: RawJobListItem[] = [
  createRouteMockJob({
    id: 'history-completed',
    status: 'completed',
    create_time: routeMockJobTimestamp - 60_000,
    execution_start_time: routeMockJobTimestamp - 60_000,
    execution_end_time: routeMockJobTimestamp - 55_000,
    preview_output: {
      filename: 'completed-output.png',
      subfolder: '',
      type: 'output',
      nodeId: '1',
      mediaType: 'images'
    }
  }),
  createRouteMockJob({
    id: 'history-failed',
    status: 'failed',
    create_time: routeMockJobTimestamp - 120_000,
    execution_start_time: routeMockJobTimestamp - 120_000,
    execution_end_time: routeMockJobTimestamp - 118_000,
    outputs_count: 0,
    execution_error: {
      node_id: '1',
      node_type: 'SaveImage',
      exception_message: 'Intentional fixture failure',
      exception_type: 'Error',
      traceback: [],
      current_inputs: {},
      current_outputs: {}
    }
  }),
  createRouteMockJob({
    id: 'history-cancelled',
    status: 'cancelled',
    create_time: routeMockJobTimestamp - 180_000,
    execution_start_time: routeMockJobTimestamp - 180_000,
    execution_end_time: routeMockJobTimestamp - 179_000,
    outputs_count: 0
  })
]

const activeJobs: RawJobListItem[] = [
  createRouteMockJob({
    id: 'queue-running',
    status: 'in_progress',
    create_time: routeMockJobTimestamp - 10_000,
    execution_start_time: routeMockJobTimestamp - 9_000,
    execution_end_time: null,
    outputs_count: 0
  }),
  createRouteMockJob({
    id: 'queue-pending',
    status: 'pending',
    create_time: routeMockJobTimestamp - 5_000,
    execution_start_time: null,
    execution_end_time: null,
    outputs_count: 0
  })
]
const runningOnlyJobs = activeJobs.filter((job) => job.status !== 'pending')

const test = mergeTests(comfyPageFixture, jobsRouteFixture).extend<{
  initialJobsScenario: JobsScenario
  mockInitialJobsScenario: void
}>({
  initialJobsScenario: [
    { history: historyJobs, queue: activeJobs },
    { option: true }
  ],
  mockInitialJobsScenario: [
    async ({ jobsRoutes, initialJobsScenario }, use) => {
      await jobsRoutes.mockJobsScenario(initialJobsScenario)
      await use()
    },
    { auto: true }
  ]
})

async function openJobHistorySidebar(comfyPage: ComfyPage) {
  await comfyPage.page
    .getByTestId(TestIds.sidebar.toolbar)
    .getByRole('button', { name: 'Job History', exact: true })
    .click()
  await expect(jobHistorySidebar(comfyPage)).toBeVisible()
}

function jobRow(comfyPage: ComfyPage) {
  const list = comfyPage.page.getByTestId(TestIds.queue.jobAssetsList)

  return (jobId: string) => list.locator(`[data-job-id="${jobId}"]`)
}

function jobHistorySidebar(comfyPage: ComfyPage) {
  return comfyPage.page.getByTestId(TestIds.queue.jobHistorySidebar)
}

function clearQueueButton(comfyPage: ComfyPage) {
  return jobHistorySidebar(comfyPage).getByRole('button', {
    name: 'Clear queue',
    exact: true
  })
}

async function openSidebarClearHistoryDialog(comfyPage: ComfyPage) {
  await jobHistorySidebar(comfyPage)
    .getByLabel(/More options/i)
    .click()
  await comfyPage.page.getByTestId(TestIds.queue.clearHistoryAction).click()
}

test.describe('Job history sidebar', { tag: '@ui' }, () => {
  test.describe('docked overlay action', () => {
    test.use({ initialSettings: { 'Comfy.Queue.QPOV2': false } })

    test('opens from the queue overlay docked history action', async ({
      comfyPage
    }) => {
      await comfyPage.page.getByTestId(TestIds.queue.overlayToggle).click()
      await comfyPage.queuePanel.moreOptionsButton.click()
      await comfyPage.page
        .getByTestId(TestIds.queue.dockedJobHistoryAction)
        .click()

      await expect(jobHistorySidebar(comfyPage)).toBeVisible()
      await expect(jobRow(comfyPage)('history-completed')).toBeVisible()
      await expect(jobRow(comfyPage)('queue-pending')).toBeVisible()
    })
  })

  test.describe('expanded history tab', () => {
    test.use({ initialSettings: { 'Comfy.Queue.QPOV2': true } })

    test('shows terminal and active job states', async ({ comfyPage }) => {
      await openJobHistorySidebar(comfyPage)

      const row = jobRow(comfyPage)
      await expect(row('queue-pending')).toBeVisible()
      await expect(row('queue-running')).toBeVisible()
      await expect(row('history-completed')).toBeVisible()
      await expect(row('history-failed')).toBeVisible()
      await expect(row('history-cancelled')).toBeVisible()

      await expect(clearQueueButton(comfyPage)).toBeEnabled()
    })

    test('filters completed and failed history jobs', async ({ comfyPage }) => {
      await openJobHistorySidebar(comfyPage)

      await comfyPage.page
        .getByRole('button', { name: 'Completed', exact: true })
        .click()

      const row = jobRow(comfyPage)
      await expect(row('history-completed')).toBeVisible()
      await expect(row('history-failed')).toBeHidden()
      await expect(row('queue-running')).toBeHidden()

      await comfyPage.page
        .getByRole('button', { name: 'Failed', exact: true })
        .click()

      await expect(row('history-failed')).toBeVisible()
      await expect(row('history-cancelled')).toBeVisible()
      await expect(row('history-completed')).toBeHidden()
    })

    test('searches by job id and output filename', async ({ comfyPage }) => {
      await openJobHistorySidebar(comfyPage)

      const row = jobRow(comfyPage)
      const searchInput = comfyPage.page.getByPlaceholder('Search...')

      await searchInput.fill('history-failed')
      await expect(row('history-failed')).toBeVisible()
      await expect(row('history-completed')).toBeHidden()
      await expect(row('queue-running')).toBeHidden()

      await searchInput.fill('completed-output')
      await expect(row('history-completed')).toBeVisible()
      await expect(row('history-failed')).toBeHidden()

      await searchInput.clear()
      await expect(row('history-completed')).toBeVisible()
      await expect(row('queue-running')).toBeVisible()
    })

    test('clears pending queue jobs and leaves running/history jobs', async ({
      comfyPage,
      jobsRoutes
    }) => {
      await openJobHistorySidebar(comfyPage)

      const row = jobRow(comfyPage)
      await expect(row('queue-pending')).toBeVisible()

      const clearQueueRequests = await jobsRoutes.mockClearQueue()
      const clearHistoryRequests = await jobsRoutes.mockClearHistory()
      await jobsRoutes.mockJobsScenario({
        history: historyJobs,
        queue: runningOnlyJobs
      })

      await clearQueueButton(comfyPage).click()

      await expect.poll(() => clearQueueRequests.length).toBe(1)
      expect(clearQueueRequests).toContainEqual({ clear: true })
      await expect(row('queue-pending')).toBeHidden()
      await expect(row('queue-running')).toBeVisible()
      await expect(row('history-completed')).toBeVisible()
      await expect(clearQueueButton(comfyPage)).toBeDisabled()
      expect(clearHistoryRequests).toHaveLength(0)
    })

    test('clears history from the sidebar menu and keeps active jobs', async ({
      comfyPage,
      jobsRoutes
    }) => {
      await openJobHistorySidebar(comfyPage)

      const row = jobRow(comfyPage)
      await expect(row('history-completed')).toBeVisible()

      const clearHistoryRequests = await jobsRoutes.mockClearHistory()
      const clearQueueRequests = await jobsRoutes.mockClearQueue()
      await jobsRoutes.mockJobsScenario({
        history: [],
        queue: activeJobs
      })

      await openSidebarClearHistoryDialog(comfyPage)
      await expect(
        comfyPage.page.getByText('Clear your job queue history?')
      ).toBeVisible()
      await comfyPage.page
        .getByRole('button', { name: 'Clear', exact: true })
        .click()

      await expect.poll(() => clearHistoryRequests.length).toBe(1)
      expect(clearHistoryRequests).toContainEqual({ clear: true })
      await expect(row('history-completed')).toBeHidden()
      await expect(row('history-failed')).toBeHidden()
      await expect(row('queue-running')).toBeVisible()
      await expect(row('queue-pending')).toBeVisible()
      expect(clearQueueRequests).toHaveLength(0)
    })
  })

  test.describe('without pending queue jobs', () => {
    test.use({
      initialJobsScenario: { history: historyJobs, queue: runningOnlyJobs },
      initialSettings: { 'Comfy.Queue.QPOV2': true }
    })

    test('disables clear queue', async ({ comfyPage }) => {
      await openJobHistorySidebar(comfyPage)

      await expect(clearQueueButton(comfyPage)).toBeDisabled()
    })
  })
})
