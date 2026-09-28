import type {
  AgentMessage,
  AgentRunMode,
  AgentThreadListResponse
} from '@comfyorg/ingest-types'
import { expect } from '@playwright/test'

import { StorageKeys } from '@/platform/workflow/persistence/base/storageKeys'

import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { PerformanceHelper } from '@e2e/fixtures/helpers/PerformanceHelper'
import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'

const THREAD_ID = '7d342227-f9d2-4d25-90c0-81a5fa770209'
const SEEDED_AT = '2026-09-25T00:00:00Z'

function conversation(turnCount: number): AgentMessage[] {
  return Array.from({ length: turnCount }, (_, index) => {
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
    for (const {
      title,
      turnCount,
      sessionSize,
      expectedResponseBoundaries
    } of [
      {
        title: 'typing with an empty restored conversation',
        turnCount: 0,
        sessionSize: 'empty',
        expectedResponseBoundaries: { first: null, last: null }
      },
      {
        title: 'typing with a long restored conversation',
        turnCount: 100,
        sessionSize: 'long',
        expectedResponseBoundaries: {
          first: 'Turn 1 is complete',
          last: 'Turn 100 is complete'
        }
      }
    ] as const) {
      test(title, async ({ page, agentFlagEnabled }) => {
        const messages = conversation(turnCount)
        const threads: AgentThreadListResponse = {
          threads: [
            {
              created_at: SEEDED_AT,
              id: THREAD_ID,
              last_message_at: SEEDED_AT,
              message_count: messages.length,
              preview: 'Long composer performance conversation',
              status: 'active',
              title: 'Long composer performance conversation',
              updated_at: SEEDED_AT,
              workflow_id: ''
            }
          ],
          pagination: {
            has_more: false,
            limit: 100,
            offset: 0,
            total: 1
          }
        }
        const runMode: AgentRunMode = {
          mode: 'ask_approval',
          credit_limit: null
        }

        await page.route('**/api/experiment/models', (route) =>
          route.fulfill(jsonRoute([]))
        )
        await page.route('**/api/agent/threads', (route) =>
          route.fulfill(jsonRoute(threads))
        )
        await page.route('**/api/agent/run-mode', (route) =>
          route.fulfill(jsonRoute(runMode))
        )
        await page.route('**/api/agent/threads/*/messages', (route) => {
          if (route.request().method() !== 'GET') return route.fallback()
          return route.fulfill(jsonRoute(messages))
        })
        await page.addInitScript(
          ({ key, threadId }) => localStorage.setItem(key, threadId),
          {
            key: StorageKeys.agentThread('personal'),
            threadId: THREAD_ID
          }
        )
        await bootAgentApp(page, agentFlagEnabled)

        const agentPanel = new AgentPanel(page)
        await agentPanel.open()

        const panel = agentPanel.root
        const editor = agentPanel.composer
        await expect(panel.getByTestId('user-message-bubble')).toHaveCount(
          turnCount
        )
        const assistantResponses = panel.getByTestId('markdown-stream')
        await expect(assistantResponses).toHaveCount(turnCount)
        const responseBoundaries = await assistantResponses.evaluateAll(
          (responses) => {
            const boundaryText = (response: Element | undefined) => {
              if (response === undefined) return null
              return (
                response.textContent.match(/Turn \d+ is complete/)?.[0] ?? null
              )
            }
            return {
              first: boundaryText(responses.at(0)),
              last: boundaryText(responses.at(-1))
            }
          }
        )
        expect(responseBoundaries).toEqual(expectedResponseBoundaries)
        await expect(editor).toBeEditable()

        const text =
          'Keep the lighting soft, preserve the framing, and render four variations.'

        await test.step('warm the composer twice', async () => {
          for (let warmup = 0; warmup < 2; warmup++) {
            await editor.pressSequentially(text)
            await expect(editor).toHaveText(text)
            await editor.fill('')
            await expect(editor).toBeEmpty()
          }
        })

        await test.step('measure composer typing', async () => {
          const perf = new PerformanceHelper(page)
          await perf.init()
          try {
            await perf.startMeasuring()
            await editor.pressSequentially(text)
            const measurement = await perf.stopMeasuring(
              `agent-composer-${sessionSize}-conversation-typing`
            )

            await expect(editor).toHaveText(text)
            recordMeasurement(measurement)
            logMeasurement(
              `Agent composer ${sessionSize}-conversation typing`,
              measurement,
              [
                'taskDurationMs',
                'scriptDurationMs',
                'styleRecalcs',
                'layouts',
                'totalBlockingTimeMs',
                'heapUsedBytes'
              ]
            )
          } finally {
            await perf.dispose()
          }
        })
      })
    }
  }
)
