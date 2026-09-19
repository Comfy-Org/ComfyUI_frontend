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
  })

  test.describe('title reset on reconcile', () => {
    test.use({ conversationCase: 'agent-rec-clarifying-question' })

    // Renaming a node through the canvas title editor writes only to the
    // local node store (useNodeEventHandlers.handleNodeTitleUpdate); nothing
    // mints that rename into the CRDT doc. The next agent reconcile derives
    // the node's title straight from that stale doc (graphMutations.ts
    // prepareNode -> nodePayload.ts nodeTitle), so the rename is silently
    // lost even though this turn's only edit is the node's "steps" widget.
    test('keeps a manual rename across an unrelated agent widget update', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)
      const CUSTOM_TITLE = 'My renamed sampler'

      // Turn 0 asks a clarifying question with no graph edits; its
      // agent_active_tab event is what subscribes the follower and
      // materializes the seed graph, including KSampler (node 3), onto the
      // canvas.
      await agentConversation.sendPrompt(0)
      await agentConversation.replayResponse(0)
      await agentConversation.waitForTurnComplete()

      const sampler =
        await agentConversation.vueNodes.getFixtureByTitle('KSampler')
      await sampler.setTitle(CUSTOM_TITLE)
      await expect(sampler.title).toHaveText(CUSTOM_TITLE)

      // Turn 1's only graph edit is set_widget('steps') on that same node
      // (node 3); it never touches title.
      await agentConversation.sendPrompt(1)
      await agentConversation.replayResponse(1)
      await agentConversation.waitForTurnComplete()

      test.fail(
        true,
        'an unrelated agent reconcile resets a manually renamed node back to its default title'
      )
      await expect(sampler.title).toHaveText(CUSTOM_TITLE)
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
