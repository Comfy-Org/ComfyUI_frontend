import { mergeTests } from '@playwright/test'
import { z } from 'zod'

import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { webSocketFixture } from '@e2e/fixtures/ws'

const acceptedPrompt = z.object({ prompt_id: z.string() })

interface QueuedJob {
  id: string
  start: () => void
  progress: (node: string, value: number, max: number) => void
  output: (node: string, output: Record<string, unknown>) => void
  finish: () => void
}

export const queuedExecutionFixture = mergeTests(
  comfyPageFixture,
  webSocketFixture
).extend<{
  queuedExecution: {
    capture: (submit: () => Promise<void>) => Promise<QueuedJob>
    status: (remaining: number) => void
  }
}>({
  queuedExecution: async ({ comfyPage, getWebSocket }, use) => {
    const { page } = comfyPage
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const promptUrl = (url: URL) => url.pathname === '/api/prompt'
    let jobCount = 0

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
        return {
          id,
          start: () => execution.executionStart(id),
          progress: (node, value, max) =>
            execution.nodeRunning(id, node, value, max),
          output: (node, output) => execution.executed(id, node, output),
          finish: () => execution.executionSuccess(id)
        }
      },
      status: (remaining) => execution.status(remaining)
    })
  }
})
