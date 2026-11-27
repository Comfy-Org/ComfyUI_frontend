import { mergeTests } from '@playwright/test'
import { z } from 'zod'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const acceptedPrompt = z.object({ prompt_id: z.string() })

interface QueuedJob {
  finish: () => void
  id: string
  output: (
    node: string,
    output: Parameters<ExecutionHelper['executed']>[2]
  ) => void
  progress: (node: string, value: number, max: number) => void
  start: () => void
}

export interface QueuedExecution {
  capture: (submit: () => Promise<void>) => Promise<QueuedJob>
  status: (remaining: number) => void
}

export const queuedExecutionFixture = mergeTests(
  comfyPageFixture,
  webSocketFixture
).extend<{
  queuedExecution: QueuedExecution
}>({
  async queuedExecution({ comfyPage, getWebSocket }, use) {
    const { page } = comfyPage
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    let jobCount = 0

    function promptUrl(url: URL) {
      return url.pathname === '/api/prompt'
    }

    await page.route(promptUrl, async (route) => {
      if (route.request().method() !== 'POST') return route.fallback()
      await route.fulfill({
        json: { prompt_id: `test-job-${++jobCount}`, node_errors: {} }
      })
    })

    await use({
      async capture(submit) {
        const [response] = await Promise.all([
          page.waitForResponse(
            (response) =>
              promptUrl(new URL(response.url())) &&
              response.request().method() === 'POST' &&
              response.ok()
          ),
          submit()
        ])
        const { prompt_id: id } = acceptedPrompt.parse(await response.json())
        await expect
          .poll(
            () =>
              page.evaluate((jobId) => {
                const executionStore = document
                  .getElementById('vue-app')
                  ?.__vue_app__?.config.globalProperties.$pinia._s.get(
                    'execution'
                  )
                const job: unknown = executionStore?.queuedJobs[jobId]
                return (
                  typeof job === 'object' &&
                  job !== null &&
                  'workflow' in job &&
                  !!job.workflow
                )
              }, id),
            { message: `Waiting for ComfyUI to register queued job ${id}` }
          )
          .toBe(true)
        return {
          finish() {
            execution.executionSuccess(id)
          },
          id,
          output(node, output) {
            execution.executed(id, node, output)
          },
          progress(node, value, max) {
            execution.nodeRunning(id, node, value, max)
          },
          start() {
            execution.executionStart(id)
          }
        }
      },
      status(remaining) {
        execution.status(remaining)
      }
    })
  }
})
