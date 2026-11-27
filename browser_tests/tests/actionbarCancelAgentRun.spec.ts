import type {
  JobsListResponse,
  RawJobListItem
} from '@comfyorg/api-client/jobTypes'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { QueuedExecution } from '@e2e/fixtures/queuedExecutionFixture'
import { queuedExecutionFixture as test } from '@e2e/fixtures/queuedExecutionFixture'
import { TestIds } from '@e2e/fixtures/selectors'

const QUEUE_ROUTE = /\/api\/jobs\?[^/]*status=in_progress,pending/
const HISTORY_ROUTE = /\/api\/jobs\?[^/]*status=completed/
const INTERRUPT_ROUTE = /\/api\/interrupt$/

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

async function startRunOwnedByAnotherClient(
  comfyPage: ComfyPage,
  queuedExecution: QueuedExecution
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
  queuedExecution.status(1)
  await expect.poll(queueFetches).toBeGreaterThanOrEqual(1)
}

test.describe(
  'Actionbar cancel control during an Agent-started run',
  { tag: '@ui' },
  () => {
    test('is enabled while a run this client did not queue is active (PM-2219)', async ({
      comfyPage,
      queuedExecution
    }) => {
      const cancel = comfyPage.actionbar.cancelButton

      await expect(cancel).toBeDisabled()

      await startRunOwnedByAnotherClient(comfyPage, queuedExecution)

      await expect(cancel).toBeEnabled()
      await expect(cancel).toHaveAttribute('data-variant', 'destructive')
    })

    test('cancelling an Agent-started run interrupts that run (PM-2219)', async ({
      comfyPage,
      queuedExecution
    }) => {
      const cancel = comfyPage.actionbar.cancelButton

      await startRunOwnedByAnotherClient(comfyPage, queuedExecution)
      await expect(cancel).toBeEnabled()

      const interrupted = comfyPage.page.waitForRequest(
        (request) =>
          request.method() === 'POST' && INTERRUPT_ROUTE.test(request.url())
      )
      await cancel.click()

      const request = await interrupted
      expect(request.postDataJSON()).toEqual({ prompt_id: AGENT_JOB_ID })
    })

    test('stays disabled when several runs from other clients are active', async ({
      comfyPage,
      queuedExecution
    }) => {
      const cancel = comfyPage.actionbar.cancelButton

      await mockJobsRoute(comfyPage, HISTORY_ROUTE, emptyJobsBody)
      await mockJobsRoute(
        comfyPage,
        QUEUE_ROUTE,
        JSON.stringify(
          jobsResponse([
            {
              id: AGENT_JOB_ID,
              status: 'in_progress',
              create_time: Date.now()
            },
            {
              id: 'other-client-job-2',
              status: 'in_progress',
              create_time: Date.now() - 1
            }
          ])
        )
      )
      queuedExecution.status(2)
      await expect(
        comfyPage.page.getByTestId(TestIds.queue.overlayToggle)
      ).toContainText('2 active')

      await expect(cancel).toBeDisabled()
      await expect(cancel).toHaveAttribute('data-variant', 'secondary')
    })

    test('stays disabled when the backend has nothing running', async ({
      comfyPage,
      queuedExecution
    }) => {
      const cancel = comfyPage.actionbar.cancelButton

      await mockJobsRoute(comfyPage, HISTORY_ROUTE, emptyJobsBody)
      const queueFetches = await mockJobsRoute(
        comfyPage,
        QUEUE_ROUTE,
        emptyJobsBody
      )
      queuedExecution.status(0)
      await expect.poll(queueFetches).toBeGreaterThanOrEqual(1)

      await expect(cancel).toBeDisabled()
      await expect(cancel).toHaveAttribute('data-variant', 'secondary')
    })

    test('is enabled while a run this client queued is active', async ({
      comfyPage,
      queuedExecution
    }) => {
      const cancel = comfyPage.actionbar.cancelButton

      await expect(cancel).toBeDisabled()

      const job = await queuedExecution.capture(() =>
        comfyPage.runButton.click()
      )
      job.start()

      await expect(cancel).toBeEnabled()

      const interrupted = comfyPage.page.waitForRequest(
        (request) =>
          request.method() === 'POST' && INTERRUPT_ROUTE.test(request.url())
      )
      await cancel.click()

      const request = await interrupted
      expect(request.postDataJSON()).toEqual({ prompt_id: job.id })
    })
  }
)
