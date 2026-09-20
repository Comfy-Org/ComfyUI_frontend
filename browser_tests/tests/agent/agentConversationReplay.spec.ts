import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { listRecordedConversations } from '@e2e/fixtures/data/agent/agentConversation'
import {
  BYTEDANCE_REFERENCE_NODE_TYPE,
  byteDanceReferenceNodeDef
} from '@e2e/fixtures/data/byteDanceReferenceNodeDef'
import {
  referenceGraphOps,
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

test.describe(
  'MiniMax-style autogrow reload',
  { tag: ['@agent', '@cloud'] },
  () => {
    // The reference node is not in the recorded core subset, so its definition
    // is served through the conversation fixture's own /object_info payload.
    // Routing it separately is shadowed by that route and the node lands
    // unregistered, which silently disarms this regression.
    test.use({
      conversationCase: WIRING_CASE,
      extraNodeDefs: {
        [BYTEDANCE_REFERENCE_NODE_TYPE]: byteDanceReferenceNodeDef
      }
    })

    // PM-993: the saved document addresses inputs by index, so growing the
    // next reference image on reopen used to re-target every wire below it.
    test('keeps widget links after a reference input grows', async ({
      agentConversation,
      page
    }) => {
      await agentConversation.runTurns()
      await agentConversation.applyGraphOps(referenceGraphOps)

      const wiring = await wireAndReopen(page)

      expect(wiring).toEqual({
        hasNextReference: true,
        referenceLinked: true,
        seedLinkBefore: expect.any(Number),
        seedLinkAfter: wiring.seedLinkBefore
      })
    })
  }
)
