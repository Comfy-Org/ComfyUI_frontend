import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'
import {
  referenceGraphOps,
  routeReferenceNodeDef,
  wireAndReopen
} from '@e2e/fixtures/minimaxAutogrowReload'

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

const minimaxTest = test.extend({
  page: async ({ page }, use) => {
    const unroute = await routeReferenceNodeDef(page)
    try {
      await use(page)
    } finally {
      await unroute()
    }
  }
})

minimaxTest.describe(
  'MiniMax-style autogrow reload',
  { tag: ['@agent', '@cloud'] },
  () => {
    minimaxTest.use({ conversationCase: WIRING_CASE })

    // PM-993: the saved document addresses inputs by index, so growing the
    // next reference image on reopen used to re-target every wire below it.
    minimaxTest(
      'keeps widget links after a reference input grows',
      async ({ agentConversation, page }) => {
        await agentConversation.runTurns()
        await agentConversation.applyGraphOps(referenceGraphOps)

        const wiring = await wireAndReopen(page)

        expect(wiring).toEqual({
          hasNextReference: true,
          referenceLinked: true,
          seedLinkBefore: expect.any(Number),
          seedLinkAfter: wiring.seedLinkBefore
        })
      }
    )
  }
)
