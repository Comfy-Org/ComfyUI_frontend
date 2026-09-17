import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Five wired nodes, one renamed, whose recorded turn sets widget values on
// existing nodes. Returning to the tab re-subscribes the follower, which
// replays the whole saved document over those live nodes.
const EDITED_CASE = 'agent-rec-set-widget-existing'
const PANNED_VIEWPORT = { scale: 0.8, offset: [137, -61] as const }

function viewport(page: Page) {
  return page.evaluate(() => {
    const { ds } = window.app!.canvas
    return { scale: ds.scale, offset: [ds.offset[0], ds.offset[1]] }
  })
}

test.describe(
  'Agent workflow tab switch',
  { tag: ['@cloud', '@agent'] },
  () => {
    test.use({ conversationCase: EDITED_CASE })

    test('shows the edited workflow unchanged after switching away and back with Agent open', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      const panel = page.getByTestId('docked-agent-panel')
      const tabs = page.locator('.workflow-tabs .p-togglebutton')
      const lastTurn = agentConversation.conversation.turns.length - 1

      await agentConversation.runTurns()
      const widgetRows = await agentConversation.renderedWidgetRows()
      expect(widgetRows.length).toBeGreaterThan(0)
      await page.evaluate((next) => {
        window.app!.canvas.ds.scale = next.scale
        window.app!.canvas.ds.offset = [...next.offset]
      }, PANNED_VIEWPORT)
      await expect(tabs).toHaveCount(1)

      await page.locator('.new-blank-workflow-button').click()
      await expect(tabs).toHaveCount(2)
      await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
      await expect(panel).toHaveCount(1)
      await expect(panel).toBeVisible()

      await tabs.first().click()
      await agentConversation.expectCanvasReplayed(lastTurn)
      await expect
        .poll(() => agentConversation.renderedWidgetRows())
        .toEqual(widgetRows)
      expect(await viewport(page)).toEqual({
        scale: PANNED_VIEWPORT.scale,
        offset: [...PANNED_VIEWPORT.offset]
      })
      await expect(panel).toHaveCount(1)
      await expect(panel).toBeVisible()
    })
  }
)
