import type { Request } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest, sentTurn } from '@e2e/tests/agent/agentPanelMocks'

// Source: Frontend 1.60 QA, part B row REG06 (Comfy-Org/ideation-sharing,
// branch synap5e/docs/fe160-qa-checklist,
// fe160-qa-checklist/results/part-b/README.md): "Ctrl+Enter pressed IN the
// Agent composer sends the message AND queues a canvas run", on 1.59.0.dev2
// and 1.60.0.dev1.
//
// Ctrl+Enter is the global Comfy.QueuePrompt binding and deliberately fires
// from text inputs, so the composer has to keep an Enter it consumed to
// itself. Canvas Ctrl+Enter must still queue.

const test = mergeTests(agentTest, webSocketFixture)

const PROMPT = 'Make the image warmer'

function isQueuePrompt(request: Request): boolean {
  return (
    request.method() === 'POST' &&
    new URL(request.url()).pathname.endsWith('/api/prompt')
  )
}

test.describe(
  'Ctrl+Enter in the Agent composer',
  { tag: ['@cloud', '@keyboard'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test('sends the message without queueing the workflow', async ({
      agentPanel,
      comfyPage,
      postedMessages,
      page
    }) => {
      const queued: Request[] = []
      await page.route('**/api/prompt', (route) => {
        if (!isQueuePrompt(route.request())) return route.fallback()
        queued.push(route.request())
        return route.fulfill(
          jsonRoute({ prompt_id: 'ctrl-enter-run', number: 1, node_errors: {} })
        )
      })

      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await test.step('Ctrl+Enter in the composer sends the prompt', async () => {
        await agentPanel.composer.fill(PROMPT)
        await agentPanel.composer.focus()
        await page.keyboard.press('Control+Enter')
        await expect.poll(() => postedMessages.length).toBe(1)
        expect(sentTurn(postedMessages).content).toContain(PROMPT)
      })

      await test.step('Ctrl+Enter on the canvas still queues a run', async () => {
        await comfyPage.canvas.click({ position: { x: 100, y: 100 } })
        await expect(agentPanel.composer).not.toBeFocused()
        await page.keyboard.press('Control+Enter')
        await expect.poll(() => queued.length).toBeGreaterThan(0)
      })

      // The composer keydown came first, so a run it queued would already be
      // recorded by the time the canvas run is.
      expect(
        queued,
        'Ctrl+Enter in the Agent composer also queued the workflow'
      ).toHaveLength(1)
    })
  }
)
