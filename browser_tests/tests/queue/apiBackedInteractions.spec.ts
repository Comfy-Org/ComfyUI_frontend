import { expect, mergeTests } from '@playwright/test'
import type { Locator, Page, Request } from '@playwright/test'
import type { JobDetailResponse, JobEntry } from '@comfyorg/ingest-types'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import type { MockJobRecord } from '@e2e/fixtures/helpers/JobsApiMock'
import { jobsApiMockFixture } from '@e2e/fixtures/jobsApiMockFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { createMockJob } from '@e2e/fixtures/utils/jobFixtures'

const test = mergeTests(comfyPageFixture, jobsApiMockFixture)

const now = Date.now()
const completedJob = createMockJob({
  id: 'api-completed',
  status: 'completed',
  create_time: now - 120_000,
  execution_start_time: now - 120_000,
  execution_end_time: now - 112_000,
  outputs_count: 2,
  workflow_id: 'workflow-api-completed'
})
const failedJob = createMockJob({
  id: 'api-failed',
  status: 'failed',
  create_time: now - 60_000,
  execution_start_time: now - 60_000,
  execution_end_time: now - 58_000,
  outputs_count: 0,
  execution_error: {
    exception_message: 'Mock API failure',
    exception_type: 'ValueError',
    traceback: [],
    current_inputs: {},
    current_outputs: {},
    node_id: '3',
    node_type: 'SaveImage'
  }
})
const pendingJob: JobEntry = {
  id: 'api-pending',
  status: 'pending',
  create_time: now - 10_000,
  workflow_id: 'workflow-api-pending'
}

function createCompletedJobRecord(job: JobEntry): MockJobRecord {
  const secondOutput = {
    filename: 'output_api-completed_extra.png',
    subfolder: '',
    type: 'output',
    nodeId: '1',
    mediaType: 'images'
  }
  const detail: JobDetailResponse = {
    ...job,
    update_time: job.execution_end_time ?? job.create_time,
    outputs: {
      '1': {
        images: [job.preview_output, secondOutput].filter(Boolean)
      }
    }
  }

  return { listItem: job, detail }
}

function createJobRecord(job: JobEntry): MockJobRecord {
  const updateTime =
    job.execution_end_time ?? job.execution_start_time ?? job.create_time
  const detail: JobDetailResponse = {
    ...job,
    update_time: updateTime,
    ...(job.status === 'completed' ||
    job.status === 'failed' ||
    job.status === 'cancelled'
      ? { outputs: {} }
      : {})
  }

  return { listItem: job, detail }
}

function hasStatuses(request: Request, expectedStatuses: string[]): boolean {
  if (request.method() !== 'GET') return false

  const url = new URL(request.url())
  if (!url.pathname.endsWith('/api/jobs')) return false

  const statuses = new Set(
    (url.searchParams.get('status') ?? '')
      .split(',')
      .map((status) => status.trim())
      .filter(Boolean)
  )

  return expectedStatuses.every((status) => statuses.has(status))
}

function isJobDetailRequest(request: Request, jobId: string): boolean {
  return (
    request.method() === 'GET' &&
    new URL(request.url()).pathname.endsWith(`/api/jobs/${jobId}`)
  )
}

function isClearHistoryRequest(request: Request): boolean {
  return (
    request.method() === 'POST' &&
    new URL(request.url()).pathname.endsWith('/api/history')
  )
}

function getJobRow(page: Page, id: string): Locator {
  return page.locator(`[data-job-id="${id}"]`)
}

test.describe('API-backed queue interactions', { tag: '@canvas' }, () => {
  test('loads jobs, opens full job output detail, and clears history through the API', async ({
    comfyPage,
    jobsApi
  }) => {
    await jobsApi.mockJobs([
      createCompletedJobRecord(completedJob),
      createJobRecord(failedJob),
      createJobRecord(pendingJob)
    ])
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', false)
    await comfyPage.settings.setSetting('Comfy.Queue.QPOV2', false)

    const queueRequest = comfyPage.page.waitForRequest((request) =>
      hasStatuses(request, ['in_progress', 'pending'])
    )
    const historyRequest = comfyPage.page.waitForRequest((request) =>
      hasStatuses(request, ['completed', 'failed', 'cancelled'])
    )

    await comfyPage.setup()

    await Promise.all([queueRequest, historyRequest])

    await comfyPage.page.getByTestId(TestIds.queue.overlayToggle).click()

    const completedRow = getJobRow(comfyPage.page, completedJob.id)
    const failedRow = getJobRow(comfyPage.page, failedJob.id)
    const pendingRow = getJobRow(comfyPage.page, pendingJob.id)

    await expect(completedRow).toBeVisible()
    await expect(failedRow).toBeVisible()
    await expect(pendingRow).toBeVisible()

    await comfyPage.page
      .getByRole('button', { name: 'Completed', exact: true })
      .click()
    await expect(completedRow).toBeVisible()
    await expect(failedRow).toBeHidden()
    await expect(pendingRow).toBeHidden()

    const detailRequest = comfyPage.page.waitForRequest((request) =>
      isJobDetailRequest(request, completedJob.id)
    )

    await completedRow.hover()
    await completedRow.getByRole('button', { name: 'View' }).click()
    await detailRequest

    await expect(comfyPage.mediaLightbox.root).toBeVisible()
    await comfyPage.mediaLightbox.closeButton.click()

    await comfyPage.page
      .getByRole('button', { name: 'All', exact: true })
      .click()
    await comfyPage.queuePanel.openClearHistoryDialog()

    const clearRequest = comfyPage.page.waitForRequest(isClearHistoryRequest)
    const historyRefresh = comfyPage.page.waitForRequest((request) =>
      hasStatuses(request, ['completed', 'failed', 'cancelled'])
    )

    const dialog = comfyPage.confirmDialog.root
    await dialog.getByRole('button', { name: 'Clear' }).click()

    const request = await clearRequest
    expect(request.postDataJSON()).toEqual({ clear: true })
    await historyRefresh

    await expect(dialog).toBeHidden()
    await expect(completedRow).toBeHidden()
    await expect(failedRow).toBeHidden()
    await expect(pendingRow).toBeVisible()
  })
})
