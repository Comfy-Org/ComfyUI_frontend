import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'

// A recording whose second turn wires two nodes; the first turn only adds.
const WIRING_CASE = 'agent-rec-two-turn-dependent-edit'

test.describe('Agent conversation replay', { tag: '@cloud' }, () => {
  test.describe('wire evidence', () => {
    test.use({ conversationCase: WIRING_CASE })

    // The second turn's only edit is a connect, so what the canvas shows after
    // it is the wire itself: the app's own render loop paints it, and the
    // expectation is the picture, not a reconstruction of the renderer.
    test('paints the wire the second turn connects @screenshot', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      await expect(page.locator('#graph-canvas')).toHaveScreenshot(
        'two-turn-dependent-edit-wired.png',
        { mask: [agentConversation.panel] }
      )
    })

    // PM-985: leaving and re-entering the agent's workflow tab rebuilt the
    // canvas from a snapshot that carried no display titles or positional
    // widget values. After the round trip the canvas must still read the way
    // it did when the last turn landed: same nodes, titles and widget values.
    // (The canvas viewport is not part of the contract: the tab switch may
    // restore a different offset/scale, so this is not a pixel comparison.)
    test('preserves the rendered graph after switching workflow tabs', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()
      const lastTurn = agentConversation.conversation.turns.length - 1

      const tabs = page.getByTestId('workflow-tab')
      await expect(tabs).toHaveCount(1)
      await page.locator('.new-blank-workflow-button').click()
      await expect(tabs).toHaveCount(2)
      await tabs.first().click()

      await agentConversation.expectCanvasReplayed(lastTurn)
    })
  })

  for (const conversationCase of listRecordedConversations()) {
    test.describe(`recorded ${conversationCase}`, () => {
      test.use({ conversationCase })

      test('replays every recorded turn onto the panel and the canvas', async ({
        agentConversation
      }) => {
        test.setTimeout(90_000)
        await agentConversation.runTurns()

        await expect(
          agentConversation.panel.getByRole('button', {
            name: `Open ${agentConversation.conversation.workflow.name}`
          })
        ).toBeVisible()
      })
    })
  }
})
