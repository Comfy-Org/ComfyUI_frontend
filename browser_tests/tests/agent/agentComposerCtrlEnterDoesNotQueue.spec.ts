import type { Page } from '@playwright/test'
import { expect, mergeTests } from '@playwright/test'

import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { webSocketFixture } from '@e2e/fixtures/ws'
import { agentTest, sentTurn } from '@e2e/tests/agent/agentPanelMocks'

const test = mergeTests(agentTest, webSocketFixture)

const PROMPT = 'Make the image warmer'
const REFERENCE_MENU_ID = 'agent-reference-menu'

interface ShortcutProbe {
  entersAtPage: string[]
  runRequests: number
}

interface ProbeWindow {
  shortcutProbe: ShortcutProbe
}

const entersAtPage = (page: Page) =>
  page.evaluate(
    () => (window as unknown as ProbeWindow).shortcutProbe.entersAtPage
  )

const runRequests = (page: Page) =>
  page.evaluate(
    () => (window as unknown as ProbeWindow).shortcutProbe.runRequests
  )

const clearEntersAtPage = (page: Page) =>
  page.evaluate(() => {
    ;(window as unknown as ProbeWindow).shortcutProbe.entersAtPage = []
  })

test.describe(
  'Ctrl+Enter in the Agent composer',
  { tag: ['@cloud', '@keyboard'] },
  () => {
    test.use({ connectWebSocketToServer: false })

    test.beforeEach(async ({ comfyPage }) => {
      const { page } = comfyPage
      await page.route('**/api/prompt', (route) =>
        route.request().method() === 'POST'
          ? route.fulfill(
              jsonRoute({ prompt_id: 'run', number: 1, node_errors: {} })
            )
          : route.fallback()
      )
      await page.evaluate(() => {
        const probe: ShortcutProbe = { entersAtPage: [], runRequests: 0 }
        ;(window as unknown as ProbeWindow).shortcutProbe = probe
        window.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter') return
          const chord = [
            event.ctrlKey && 'Control',
            event.shiftKey && 'Shift',
            'Enter'
          ]
            .filter(Boolean)
            .join('+')
          const onCanvas =
            event.target instanceof Element &&
            event.target.id === 'graph-canvas'
          probe.entersAtPage.push(
            `${chord} ${onCanvas ? 'on canvas' : 'elsewhere'}`
          )
        })
        window.app!.api.addEventListener('promptQueueing', () => {
          probe.runRequests += 1
        })
      })
    })

    test('keeps composer Enter chords away from page shortcuts, while canvas Ctrl+Enter still queues', async ({
      agentPanel,
      comfyPage,
      postedMessages,
      page
    }) => {
      async function pressCtrlEnterOnCanvas() {
        await comfyPage.canvas.focus()
        await expect(comfyPage.canvas).toBeFocused()
        await clearEntersAtPage(page)
        await page.keyboard.press('Control+Enter')
      }

      await agentPanel.open()
      await agentPanel.selectWorkflow()

      await test.step('Ctrl+Enter on the canvas requests a run', async () => {
        await pressCtrlEnterOnCanvas()
        expect(await entersAtPage(page)).toEqual(['Control+Enter on canvas'])
        await expect.poll(() => runRequests(page)).toBe(1)
      })

      await test.step('Ctrl+Enter with the reference menu open stays in the composer', async () => {
        await agentPanel.composer.fill('@')
        await expect(
          agentPanel.root.getByTestId(REFERENCE_MENU_ID)
        ).toBeVisible()
        await clearEntersAtPage(page)
        await agentPanel.composer.press('Control+Enter')
        expect(await entersAtPage(page)).toEqual([])
        await agentPanel.composer.press('Escape')
        await expect(
          agentPanel.root.getByTestId(REFERENCE_MENU_ID)
        ).toBeHidden()
      })

      await test.step('Ctrl+Shift+Enter stays in the composer', async () => {
        await agentPanel.composer.fill(PROMPT)
        await clearEntersAtPage(page)
        await agentPanel.composer.press('Control+Shift+Enter')
        expect(await entersAtPage(page)).toEqual([])
      })

      await test.step('Ctrl+Enter in the composer sends the prompt and stays in the composer', async () => {
        await agentPanel.composer.fill(PROMPT)
        await clearEntersAtPage(page)
        await agentPanel.composer.press('Control+Enter')
        expect(await entersAtPage(page)).toEqual([])
        await expect.poll(() => postedMessages.length).toBe(1)
        expect(sentTurn(postedMessages).content).toContain(PROMPT)
        expect(await runRequests(page)).toBe(1)
      })

      await test.step('Ctrl+Enter on the canvas requests exactly one more run', async () => {
        const before = await runRequests(page)
        await pressCtrlEnterOnCanvas()
        expect(await entersAtPage(page)).toEqual(['Control+Enter on canvas'])
        await expect.poll(() => runRequests(page)).toBe(before + 1)
      })
    })
  }
)
