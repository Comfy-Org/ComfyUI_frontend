import type { WebSocketRoute } from '@playwright/test'
import { mergeTests } from '@playwright/test'
import type { z } from 'zod'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'
import type {
  RawJobListItem,
  zJobsListResponse
} from '@/platform/remote/comfyui/jobs/jobTypes'

type JobsListResponse = z.infer<typeof zJobsListResponse>

const test = mergeTests(comfyPageFixture, webSocketFixture)

const KSAMPLER_NODE = '3'
const EXECUTING_CLASS = /outline-node-stroke-executing/

const QUEUE_ROUTE = /\/api\/jobs\?[^/]*status=in_progress,pending/
const HISTORY_ROUTE = /\/api\/jobs\?[^/]*status=completed/

function jobsResponse(jobs: RawJobListItem[]): JobsListResponse {
  return {
    jobs,
    pagination: { offset: 0, limit: 200, total: jobs.length, has_more: false }
  }
}

async function mockJobsRoute(
  comfyPage: ComfyPage,
  pattern: RegExp,
  body: string,
  status: number = 200
): Promise<() => number> {
  let count = 0
  await comfyPage.page.route(pattern, async (route) => {
    count += 1
    await route.fulfill({
      status,
      contentType: 'application/json',
      body
    })
  })
  return () => count
}

const emptyJobsBody = JSON.stringify(jobsResponse([]))

type Scenario = {
  name: string
  /** Built per-test so it can incorporate the runtime-assigned jobId. */
  queueBody: (jobId: string) => string
  /** Whether the active job state should still be reflected after reconnect. */
  expectsActiveAfter: boolean
}

const scenarios: Scenario[] = [
  {
    name: 'clears stale active job when queue is empty after reconnect',
    queueBody: () => emptyJobsBody,
    expectsActiveAfter: false
  },
  {
    name: 'preserves active job when the job is still in the queue',
    queueBody: (jobId) =>
      JSON.stringify(
        jobsResponse([
          { id: jobId, status: 'in_progress', create_time: Date.now() }
        ])
      ),
    expectsActiveAfter: true
  }
]

/**
 * Stub the queue/history endpoints per `scenario`, close the WS, and wait
 * for the auto-reconnect to issue a fresh queue fetch.
 */
async function triggerReconnect(
  comfyPage: ComfyPage,
  ws: WebSocketRoute,
  scenario: Scenario,
  jobId: string
): Promise<void> {
  await mockJobsRoute(comfyPage, HISTORY_ROUTE, emptyJobsBody)
  const queueFetches = await mockJobsRoute(
    comfyPage,
    QUEUE_ROUTE,
    scenario.queueBody(jobId)
  )
  const fetchesBeforeClose = queueFetches()
  await ws.close()
  await expect.poll(queueFetches).toBeGreaterThan(fetchesBeforeClose)
}

test.describe('WebSocket reconnect with stale job', { tag: '@ui' }, () => {
  test.describe('app mode skeleton', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.appMode.enterAppModeWithInputs([[KSAMPLER_NODE, 'seed']])
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()
    })

    for (const scenario of scenarios) {
      test(scenario.name, async ({ comfyPage, getWebSocket }) => {
        const ws = await getWebSocket()
        const exec = new ExecutionHelper(comfyPage, ws)

        const jobId = await exec.run()
        exec.executionStart(jobId)

        // Skeleton visibility is the deterministic sync point: it appears
        // once both `storeJob` (HTTP) and `executionStart` (WS) have been
        // processed, regardless of arrival order.
        const firstSkeleton = comfyPage.appMode.outputHistory.skeletons.first()
        await expect(firstSkeleton).toBeVisible()

        await triggerReconnect(comfyPage, ws, scenario, jobId)

        if (scenario.expectsActiveAfter) {
          await expect(firstSkeleton).toBeVisible()
        } else {
          await expect(comfyPage.appMode.outputHistory.skeletons).toHaveCount(0)
        }
      })
    }

    test('preserves active job when the queue endpoint fails on reconnect', async ({
      comfyPage,
      getWebSocket
    }) => {
      const ws = await getWebSocket()
      const exec = new ExecutionHelper(comfyPage, ws)

      const jobId = await exec.run()
      exec.executionStart(jobId)

      const firstSkeleton = comfyPage.appMode.outputHistory.skeletons.first()
      await expect(firstSkeleton).toBeVisible()

      await mockJobsRoute(comfyPage, HISTORY_ROUTE, emptyJobsBody)

      // Prime queueStore.runningTasks with the active job — a WS status
      // event drives GraphView.onStatus -> queueStore.update().
      const primer = await mockJobsRoute(
        comfyPage,
        QUEUE_ROUTE,
        JSON.stringify(
          jobsResponse([
            { id: jobId, status: 'in_progress', create_time: Date.now() }
          ])
        )
      )
      exec.status(1)
      await expect.poll(primer).toBeGreaterThanOrEqual(1)

      // Swap to a failing handler so the reconnect-driven fetch 500s.
      // The fix should preserve runningTasks from the priming call rather
      // than overwriting it with empty/error state.
      await comfyPage.page.unroute(QUEUE_ROUTE)
      const failed = await mockJobsRoute(comfyPage, QUEUE_ROUTE, '{}', 500)

      const before = failed()
      await ws.close()
      await expect.poll(failed).toBeGreaterThan(before)

      await expect(firstSkeleton).toBeVisible()
    })
  })

  test.describe('vue node executing class', { tag: '@vue-nodes' }, () => {
    for (const scenario of scenarios) {
      test(scenario.name, async ({ comfyPage, getWebSocket }) => {
        const ws = await getWebSocket()
        const exec = new ExecutionHelper(comfyPage, ws)

        // The executing outline lives on the outer `[data-node-id]`
        // container, not the inner wrapper.
        const ksamplerNode = comfyPage.vueNodes.getNodeLocator(KSAMPLER_NODE)
        await expect(ksamplerNode).toBeVisible()

        const jobId = await exec.run()
        exec.executionStart(jobId)
        exec.progressState(jobId, {
          [KSAMPLER_NODE]: {
            value: 0,
            max: 1,
            state: 'running',
            node_id: KSAMPLER_NODE,
            display_node_id: KSAMPLER_NODE,
            prompt_id: jobId
          }
        })

        await expect(ksamplerNode).toHaveClass(EXECUTING_CLASS)

        await triggerReconnect(comfyPage, ws, scenario, jobId)

        if (scenario.expectsActiveAfter) {
          await expect(ksamplerNode).toHaveClass(EXECUTING_CLASS)
        } else {
          await expect(ksamplerNode).not.toHaveClass(EXECUTING_CLASS)
        }
      })
    }
  })
})
