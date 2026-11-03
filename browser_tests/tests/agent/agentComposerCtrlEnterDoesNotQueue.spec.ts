import { expect, mergeTests } from '@playwright/test'

import { pageShortcutProbeFixture } from '@e2e/fixtures/pageShortcutProbeFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest, sentTurn } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture, pageShortcutProbeFixture)

test.describe(
  'Ctrl+Enter in the Agent composer',
  { tag: ['@cloud', '@keyboard'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test.beforeEach(async ({ page }) => {
      await page.route('**/api/prompt', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill(
              jsonRoute({ prompt_id: 'run', number: 1, node_errors: {} })
            )
          : route.fallback()
      )
    })

    test('keeps composer Enter chords away from page shortcuts, while canvas Ctrl+Enter still queues', async ({
      agentPanel,
      comfyPage,
      pageShortcuts,
      postedMessages
    }) => {
      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await test.step('Ctrl+Enter on the canvas requests a run', async () => {
        await pageShortcuts.clear()
        await comfyPage.keyboard.ctrlSend('Enter')
        expect(await pageShortcuts.entersAtPage()).toEqual([
          'Control+Enter on canvas'
        ])
        await expect.poll(() => pageShortcuts.runRequests()).toBe(1)
      })

      await test.step('Ctrl+Enter with the reference menu open stays in the composer', async () => {
        await agentPanel.composer.fill('@')
        await expect(agentPanel.referenceMenu).toBeVisible()
        await pageShortcuts.clear()
        await agentPanel.composer.press('Control+Enter')
        expect(await pageShortcuts.entersAtPage()).toEqual([])
        await agentPanel.composer.press('Escape')
        await expect(agentPanel.referenceMenu).toBeHidden()
      })

      await test.step('Ctrl+Shift+Enter stays in the composer', async () => {
        await agentPanel.composer.fill('Make the image warmer')
        await pageShortcuts.clear()
        await agentPanel.composer.press('Control+Shift+Enter')
        expect(await pageShortcuts.entersAtPage()).toEqual([])
      })

      await test.step('Ctrl+Enter in the composer sends the prompt and stays in the composer', async () => {
        await agentPanel.composer.fill('Make the image warmer')
        await pageShortcuts.clear()
        await agentPanel.composer.press('Control+Enter')
        expect(await pageShortcuts.entersAtPage()).toEqual([])
        await expect.poll(() => postedMessages.length).toBe(1)
        expect(sentTurn(postedMessages).content).toContain(
          'Make the image warmer'
        )
        expect(await pageShortcuts.runRequests()).toBe(1)
      })

      await test.step('Ctrl+Enter on the canvas requests exactly one more run', async () => {
        const before = await pageShortcuts.runRequests()
        await pageShortcuts.clear()
        await comfyPage.keyboard.ctrlSend('Enter')
        expect(await pageShortcuts.entersAtPage()).toEqual([
          'Control+Enter on canvas'
        ])
        await expect.poll(() => pageShortcuts.runRequests()).toBe(before + 1)
      })
    })
  }
)
