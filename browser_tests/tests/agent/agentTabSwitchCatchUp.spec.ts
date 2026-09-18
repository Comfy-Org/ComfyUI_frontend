import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { CanvasHelper } from '@e2e/fixtures/helpers/CanvasHelper'

// Five wired nodes, one renamed, whose recorded turn sets widget values on
// existing nodes. Returning to the tab re-subscribes the follower, which
// replays the whole saved document over those live nodes.
const EDITED_CASE = 'agent-rec-set-widget-existing'
const PAN = { x: 137, y: -61 }
const EMPTY_CANVAS_SPOT = { x: 1050, y: 1075 }

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
      const topbar = new Topbar(page)
      const canvas = new CanvasHelper(
        page,
        page.locator('#graph-canvas'),
        page.getByRole('button', { name: 'Reset View' })
      )
      const tabs = topbar.workflowTabs.locator('.p-togglebutton')
      const lastTurn = agentConversation.conversation.turns.length - 1

      const widgetRows =
        await test.step('agent edits the workflow', async () => {
          await agentConversation.runTurns()
          const rows = await agentConversation.renderedWidgetRows()
          expect(rows.length).toBeGreaterThan(0)
          return rows
        })

      const viewport = await test.step('user zooms and pans', async () => {
        const restingOffset = await canvas.getOffset()
        await canvas.setScale(0.8)
        await canvas.pan(PAN, EMPTY_CANVAS_SPOT)
        const offset = await canvas.getOffset()
        expect(offset).not.toEqual(restingOffset)
        return { scale: await canvas.getScale(), offset }
      })

      await test.step('user opens a new blank workflow', async () => {
        await expect(tabs).toHaveCount(1)
        await topbar.newWorkflowButton.click()
        await expect(tabs).toHaveCount(2)
        await expect(agentConversation.vueNodes.nodes).toHaveCount(0)
        await expect(panel).toBeVisible()
      })

      await test.step('user returns to the edited workflow', async () => {
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
        await agentConversation.expectCanvasReplayed(lastTurn)
        await expect
          .poll(() => agentConversation.renderedWidgetRows())
          .toEqual(widgetRows)
        expect({
          scale: await canvas.getScale(),
          offset: await canvas.getOffset()
        }).toEqual(viewport)
        await expect(panel).toBeVisible()
      })
    })
  }
)
