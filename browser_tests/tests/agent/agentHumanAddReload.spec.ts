import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// A node the user added by hand, whose `add_node` the host has received but
// not acknowledged, must survive the catch-up that answers the first subscribe
// after a reload. The catch-up merges what the document holds into the canvas;
// it is not authority over nodes the document has never heard of.
test.describe(
  'Human-added node survives reload before host acknowledgement',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer'
    })

    test('keeps the in-flight node through the catch-up after reload', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)

      await test.step('bind the seeded workflow', async () => {
        await agentConversation.runTurns()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(0)
      })

      const nodeId =
        await test.step('add a node while the host withholds acknowledgement', async () => {
          const addedNodeId = await agentConversation.addNodeOfType(
            'Note',
            [400, 400]
          )
          await expect(
            agentConversation.vueNodes.getNodeLocator(addedNodeId)
          ).toBeVisible()
          await expect
            .poll(() =>
              agentConversation.clientDocFrames().flatMap((frame) => frame.ops)
            )
            .toContain(`add_node:${addedNodeId}`)
          expect(agentConversation.hostNodeIds()).not.toContain(addedNodeId)
          return addedNodeId
        })

      await test.step('reload before the held add is acknowledged', async () => {
        const subscribeCount = agentConversation.subscribeCount()
        await agentConversation.reloadWithCurrentGraph()
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toBeVisible()
        await agentConversation.sendPrompt()
        await expect
          .poll(() => agentConversation.subscribeCount())
          .toBeGreaterThan(subscribeCount)
        // `subscribeCount()` rises in the mock host the instant it sends, so
        // on its own it would let the assertions below run against a canvas
        // the catch-up has not reached yet. A host widget edit lands after
        // the catch-up in frame order, so seeing its value on the canvas
        // proves the client applied both.
        await agentConversation.waitForPendingFrames(
          '6',
          'text',
          'reload catch-up landed'
        )
      })

      await test.step('preserve the local node through the catch-up', async () => {
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toBeVisible()
        const lens = await agentConversation.readNodeLens()
        expect(lens.live).toContain(nodeId)
        expect(lens.serialized).toContain(nodeId)
        expect(agentConversation.hostNodeIds()).not.toContain(nodeId)
      })
    })
  }
)
