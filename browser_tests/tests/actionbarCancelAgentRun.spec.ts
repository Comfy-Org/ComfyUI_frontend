import { mergeTests } from '@playwright/test'
import type { z } from 'zod'

import type {
  RawJobListItem,
  zJobsListResponse
} from '@/platform/remote/comfyui/jobs/jobTypes'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

type JobsListResponse = z.infer<typeof zJobsListResponse>

const test = mergeTests(comfyPageFixture, webSocketFixture)

const QUEUE_ROUTE = /\/api\/jobs\?[^/]*status=in_progress,pending/
const HISTORY_ROUTE = /\/api\/jobs\?[^/]*status=completed/
const INTERRUPT_ROUTE = /\/api\/interrupt$/

/**
 * A job id this client did not queue. The backend addresses `execution_start`
 * to the connection that submitted the prompt, so a run the Agent started
 * reaches the Agent's socket and never this one — the frontend-observable
 * signature reproduced below.
 */
const AGENT_JOB_ID = 'agent-started-job-1'

function jobsResponse(jobs: RawJobListItem[]): JobsListResponse {
  return {
    jobs,
    pagination: { offset: 0, limit: 200, total: jobs.length, has_more: false }
  }
}

const emptyJobsBody = JSON.stringify(jobsResponse([]))

async function mockJobsRoute(
  comfyPage: ComfyPage,
  pattern: RegExp,
  body: string
): Promise<() => number> {
  let count = 0
  await comfyPage.page.route(pattern, async (route) => {
    count += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body
    })
  })
  return () => count
}

/**
 * Put a run this client never queued into the backend's queue, then deliver the
 * one frame the backend *does* broadcast to every client (`status`), which is
 * what drives `queueStore.update()`. After this the toolbar is in exactly the
 * state PM-2219 reports: a run is active, and nothing told this client about it.
 */
async function startRunOwnedByAnotherClient(
  comfyPage: ComfyPage,
  exec: ExecutionHelper
): Promise<void> {
  await mockJobsRoute(comfyPage, HISTORY_ROUTE, emptyJobsBody)
  const queueFetches = await mockJobsRoute(
    comfyPage,
    QUEUE_ROUTE,
    JSON.stringify(
      jobsResponse([
        { id: AGENT_JOB_ID, status: 'in_progress', create_time: Date.now() }
      ])
    )
  )
  exec.status(1)
  await expect.poll(queueFetches).toBeGreaterThanOrEqual(1)
}

test.describe(
  'Actionbar cancel control during an Agent-started run',
  { tag: '@ui' },
  () => {
    test('is enabled while a run this client did not queue is active (PM-2219)', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const cancel = comfyPage.actionbar.cancelButton

      await expect(cancel).toBeDisabled()

      await startRunOwnedByAnotherClient(comfyPage, exec)

      await expect(cancel).toBeEnabled()
      await expect(cancel).toHaveAttribute('data-variant', 'destructive')
    })

    test('cancelling an Agent-started run interrupts that run (PM-2219)', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const cancel = comfyPage.actionbar.cancelButton

      await startRunOwnedByAnotherClient(comfyPage, exec)
      await expect(cancel).toBeEnabled()

      const interrupted = comfyPage.page.waitForRequest(
        (request) =>
          request.method() === 'POST' && INTERRUPT_ROUTE.test(request.url())
      )
      await cancel.click()

      // Targeted rather than global: the id must name the run being stopped,
      // so the click cannot cancel some other client's job.
      const request = await interrupted
      expect(request.postDataJSON()).toEqual({ prompt_id: AGENT_JOB_ID })
    })

    test('stays disabled when the backend has nothing running', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const cancel = comfyPage.actionbar.cancelButton

      await mockJobsRoute(comfyPage, HISTORY_ROUTE, emptyJobsBody)
      const queueFetches = await mockJobsRoute(
        comfyPage,
        QUEUE_ROUTE,
        emptyJobsBody
      )
      exec.status(0)
      await expect.poll(queueFetches).toBeGreaterThanOrEqual(1)

      await expect(cancel).toBeDisabled()
      await expect(cancel).toHaveAttribute('data-variant', 'secondary')
    })

    test('is enabled while a run this client queued is active', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)
      const cancel = comfyPage.actionbar.cancelButton

      await expect(cancel).toBeDisabled()

      const jobId = await exec.run()
      exec.executionStart(jobId)

      await expect(cancel).toBeEnabled()
    })
  }
)
