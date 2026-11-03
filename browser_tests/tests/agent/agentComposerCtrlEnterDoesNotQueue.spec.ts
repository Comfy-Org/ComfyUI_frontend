import { expect, mergeTests } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest, sentTurn } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const PROMPT = 'Make the image warmer'

interface RunRequestLog {
  runRequestLog: string[]
}

test.describe(
  'Ctrl+Enter in the Agent composer',
  { tag: ['@cloud', '@keyboard'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('sends the message without queueing the workflow, while canvas Ctrl+Enter still queues', async ({
      agentPanel,
      comfyPage,
      postedMessages,
      page
    }) => {
      await page.route('**/api/prompt', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill(
              jsonRoute({ prompt_id: 'run', number: 1, node_errors: {} })
            )
          : route.fallback()
      )
      await page.evaluate(() => {
        const log: string[] = []
        ;(window as unknown as RunRequestLog).runRequestLog = log
        window.addEventListener(
          'keydown',
          (event) => {
            if (event.key !== 'Enter') return
            const onCanvas =
              event.target instanceof Element &&
              event.target.id === 'graph-canvas'
            log.push(onCanvas ? 'Enter on canvas' : 'Enter elsewhere')
          },
          { capture: true }
        )
        window.app!.api.addEventListener('promptQueueing', () =>
          log.push('run requested')
        )
      })
      const runRequestLog = () =>
        page.evaluate(() => (window as unknown as RunRequestLog).runRequestLog)

      async function pressCtrlEnterOnCanvas() {
        await comfyPage.canvas.focus()
        await expect(comfyPage.canvas).toBeFocused()
        await page.keyboard.press('Control+Enter')
      }

      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await test.step('Ctrl+Enter on the canvas requests a run', async () => {
        await pressCtrlEnterOnCanvas()
        await expect
          .poll(runRequestLog)
          .toEqual(['Enter on canvas', 'run requested'])
      })

      await test.step('Ctrl+Enter in the composer sends the prompt', async () => {
        await agentPanel.composer.fill(PROMPT)
        await agentPanel.composer.focus()
        await page.keyboard.press('Control+Enter')
        await expect.poll(() => postedMessages.length).toBe(1)
        expect(sentTurn(postedMessages).content).toContain(PROMPT)
      })

      await test.step('only the canvas presses requested runs', async () => {
        await pressCtrlEnterOnCanvas()
        await expect
          .poll(runRequestLog, {
            message: 'Ctrl+Enter in the Agent composer also queued the workflow'
          })
          .toEqual([
            'Enter on canvas',
            'run requested',
            'Enter elsewhere',
            'Enter on canvas',
            'run requested'
          ])
      })
    })
  }
)
