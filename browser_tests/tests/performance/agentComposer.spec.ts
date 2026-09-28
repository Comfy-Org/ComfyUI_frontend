import { expect } from '@playwright/test'

import { PerformanceHelper } from '@e2e/fixtures/helpers/PerformanceHelper'
import { agentComposerPerformanceTest as test } from '@e2e/fixtures/agentPanelFixture'
import {
  logMeasurement,
  recordMeasurement
} from '@e2e/fixtures/utils/perfReporter'

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
      test.describe(title, () => {
        test.use({ agentComposerTurnCount: turnCount })

        test('records typing latency', async ({ page, agentComposerPanel }) => {
          const panel = agentComposerPanel.root
          const editor = agentComposerPanel.composer
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
                  response.textContent.match(/Turn \d+ is complete/)?.[0] ??
                  null
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
      })
    }
  }
)
