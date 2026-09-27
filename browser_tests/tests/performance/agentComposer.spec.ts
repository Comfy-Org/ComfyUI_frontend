import type { AgentMessage } from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'
import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

const THREAD_ID = '7d342227-f9d2-4d25-90c0-81a5fa770209'
const TURN_COUNT = 100

function longConversation(): AgentMessage[] {
  return Array.from({ length: TURN_COUNT }, (_, index) => {
    const turn = index + 1
    const turnId = `37f549ae-4a07-4c27-a3d3-${String(turn).padStart(12, '0')}`
    const common = {
      thread_id: THREAD_ID,
      turn_id: turnId,
      status: 'complete' as const
    }
    return [
      {
        ...common,
        id: `user-${turn}`,
        seq: index * 2 + 1,
        role: 'user' as const,
        content: {
          text: `Turn ${turn}: adjust the workflow while preserving the existing composition.`
        }
      },
      {
        ...common,
        id: turnId,
        seq: index * 2 + 2,
        role: 'assistant' as const,
        content: {
          text: `Turn ${turn} is complete. I updated the requested settings and checked the graph for consistency.\n\n- The existing composition is preserved.\n- The workflow remains ready to run.`
        }
      }
    ]
  }).flat()
}

test.describe(
  'Agent composer performance',
  { tag: ['@perf', '@cloud'] },
  () => {
    test.use({
      agentPanelInitiallyOpen: true
    })

    test('typing with a long restored conversation', async ({
      agentPanel,
      comfyPage
    }) => {
      const { page } = comfyPage
      const messages = longConversation()
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() !== 'GET') return route.fallback()
        return route.fulfill(jsonRoute(messages))
      })
      await page.evaluate(
        ({ key, threadId }) => localStorage.setItem(key, threadId),
        {
          key: StorageKeys.agentThread('personal'),
          threadId: THREAD_ID
        }
      )
      await page.reload()

      const panel = agentPanel.root
      const editor = panel.getByRole('textbox', { name: /^Describe ideas/ })
      await expect(panel.getByTestId('user-message-bubble')).toHaveCount(
        TURN_COUNT
      )
      const assistantResponses = panel.getByTestId('markdown-stream')
      await expect(assistantResponses).toHaveCount(TURN_COUNT)
      await expect(assistantResponses.first()).toContainText(
        'Turn 1 is complete'
      )
      await expect(assistantResponses.last()).toContainText(
        `Turn ${TURN_COUNT} is complete`
      )
      await expect(editor).toBeEditable()

      const text =
        'Keep the lighting soft, preserve the framing, and render four variations.'
      await comfyPage.perf.startMeasuring()
      await editor.pressSequentially(text)
      const measurement = await comfyPage.perf.stopMeasuring(
        'agent-composer-long-conversation-typing'
      )

      await expect(editor).toHaveText(text)
      recordMeasurement(measurement)
      logMeasurement('Agent composer long-conversation typing', measurement, [
        'taskDurationMs',
        'scriptDurationMs',
        'styleRecalcs',
        'layouts',
        'totalBlockingTimeMs',
        'heapUsedBytes'
      ])
    })
  }
)
