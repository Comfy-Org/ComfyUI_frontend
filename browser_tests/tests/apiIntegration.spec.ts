import { createServer } from 'node:http'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  createRouteMockJob,
  routeMockJobTimestamp
} from '@e2e/fixtures/jobsRouteFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import type { RawJobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'

interface JobsRequest {
  status: string
  limit: string
  offset: string
}

interface LocalApiServer {
  readonly baseUrl: string
  readonly jobsRequests: JobsRequest[]
  close(): Promise<void>
}

const historyJobs: RawJobListItem[] = [
  createRouteMockJob({
    id: 'local-history-completed',
    status: 'completed',
    create_time: routeMockJobTimestamp - 60_000,
    execution_start_time: routeMockJobTimestamp - 60_000,
    execution_end_time: routeMockJobTimestamp - 55_000,
    preview_output: {
      filename: 'local-history-completed.png',
      subfolder: '',
      type: 'output',
      nodeId: '9',
      mediaType: 'images'
    }
  }),
  createRouteMockJob({
    id: 'local-history-failed',
    status: 'failed',
    create_time: routeMockJobTimestamp - 120_000,
    execution_start_time: routeMockJobTimestamp - 120_000,
    execution_end_time: routeMockJobTimestamp - 118_000,
    outputs_count: 0,
    execution_error: {
      node_id: '9',
      node_type: 'SaveImage',
      exception_message: 'Intentional local API failure',
      exception_type: 'Error',
      traceback: [],
      current_inputs: {},
      current_outputs: {}
    }
  })
]

const activeJobs: RawJobListItem[] = [
  createRouteMockJob({
    id: 'local-queue-running',
    status: 'in_progress',
    create_time: routeMockJobTimestamp - 10_000,
    execution_start_time: routeMockJobTimestamp - 9_000,
    execution_end_time: null,
    outputs_count: 0
  }),
  createRouteMockJob({
    id: 'local-queue-pending',
    status: 'pending',
    create_time: routeMockJobTimestamp - 5_000,
    execution_start_time: null,
    execution_end_time: null,
    outputs_count: 0
  })
]

const transparentPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
)

test.use({
  initialSettings: {
    'Comfy.Queue.MaxHistoryItems': 1,
    'Comfy.Queue.QPOV2': true
  }
})

test.describe('API integration', { tag: '@ui' }, () => {
  test('updates job history UI from a local jobs API', async ({
    comfyPage
  }) => {
    const localApi = await startLocalApiServer()

    try {
      await pointComfyApiAt(comfyPage, localApi.baseUrl)
      await refreshQueueFromApi(comfyPage, localApi.baseUrl)
      await openJobHistorySidebar(comfyPage)

      const row = jobRow(comfyPage)
      await expect(row('local-queue-running')).toBeVisible()
      await expect(row('local-queue-pending')).toBeVisible()
      await expect(row('local-history-completed')).toBeVisible()
      await expect(row('local-history-failed')).toBeHidden()

      await comfyPage.settings.setSetting('Comfy.Queue.MaxHistoryItems', 2)
      await refreshQueueFromApi(comfyPage, localApi.baseUrl)

      await expect(row('local-history-failed')).toBeVisible()

      await comfyPage.page
        .getByRole('button', { name: 'Failed', exact: true })
        .click()

      await expect(row('local-history-failed')).toBeVisible()
      await expect(row('local-history-completed')).toBeHidden()
      await expect(row('local-queue-running')).toBeHidden()

      expect(localApi.jobsRequests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'in_progress,pending',
            limit: '200',
            offset: '0'
          }),
          expect.objectContaining({
            status: 'completed,failed,cancelled',
            limit: '1',
            offset: '0'
          }),
          expect.objectContaining({
            status: 'completed,failed,cancelled',
            limit: '2',
            offset: '0'
          })
        ])
      )
    } finally {
      await localApi.close()
    }
  })
})

async function startLocalApiServer(): Promise<LocalApiServer> {
  const jobsRequests: JobsRequest[] = []
  const server = createServer((req, res) =>
    handleLocalApiRequest(req, res, jobsRequests)
  )

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Local API server did not bind to a TCP address')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    jobsRequests,
    close: () => closeServer(server)
  }
}

function handleLocalApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  jobsRequests: JobsRequest[]
) {
  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url ?? '/', 'http://127.0.0.1')

  if (req.method === 'GET' && url.pathname === '/api/jobs') {
    handleJobsRequest(url, res, jobsRequests)
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/view') {
    res.writeHead(200, { 'Content-Type': 'image/png' })
    res.end(transparentPng)
    return
  }

  if (req.method === 'POST' && url.pathname.startsWith('/api/settings')) {
    sendJson(res, {})
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
}

function handleJobsRequest(
  url: URL,
  res: ServerResponse,
  jobsRequests: JobsRequest[]
) {
  const status = url.searchParams.get('status') ?? ''
  const limit = url.searchParams.get('limit') ?? '200'
  const offset = url.searchParams.get('offset') ?? '0'
  jobsRequests.push({ status, limit, offset })

  const jobs = status.includes('in_progress') ? activeJobs : historyJobs
  const pageOffset = Number(offset)
  const pageLimit = Number(limit)
  const pageJobs = jobs.slice(pageOffset, pageOffset + pageLimit)

  sendJson(res, {
    jobs: pageJobs,
    pagination: {
      offset: pageOffset,
      limit: pageLimit,
      total: jobs.length,
      has_more: pageOffset + pageJobs.length < jobs.length
    }
  })
}

function setCorsHeaders(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Comfy-User')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

function sendJson(res: ServerResponse, body: unknown) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

async function pointComfyApiAt(comfyPage: ComfyPage, baseUrl: string) {
  await comfyPage.page.evaluate((url) => {
    window.app!.api.api_base = url
  }, baseUrl)
}

async function refreshQueueFromApi(comfyPage: ComfyPage, baseUrl: string) {
  const queueResponse = waitForJobsResponse(
    comfyPage,
    baseUrl,
    'in_progress,pending'
  )
  const historyResponse = waitForJobsResponse(
    comfyPage,
    baseUrl,
    'completed,failed,cancelled'
  )

  await comfyPage.page.evaluate(() => {
    window.app!.api.dispatchCustomEvent('status', {
      exec_info: { queue_remaining: 0 }
    })
  })

  await Promise.all([queueResponse, historyResponse])
}

function waitForJobsResponse(
  comfyPage: ComfyPage,
  baseUrl: string,
  status: string
) {
  return comfyPage.page.waitForResponse((response) => {
    const url = response.url()
    return (
      response.request().method() === 'GET' &&
      url.startsWith(`${baseUrl}/api/jobs?`) &&
      new URL(url).searchParams.get('status') === status
    )
  })
}

async function openJobHistorySidebar(comfyPage: ComfyPage) {
  await comfyPage.page
    .getByTestId(TestIds.sidebar.toolbar)
    .getByRole('button', { name: 'Job History', exact: true })
    .click()
  await expect(
    comfyPage.page.getByTestId(TestIds.queue.jobHistorySidebar)
  ).toBeVisible()
}

function jobRow(comfyPage: ComfyPage) {
  const list = comfyPage.page.getByTestId(TestIds.queue.jobAssetsList)

  return (jobId: string) => list.locator(`[data-job-id="${jobId}"]`)
}
