import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// A node the user added by hand, whose `add_node` the host has received but
// not acknowledged, is lost by the first reconcile after a reload: the follower
// treats a document that has never heard of the node as authority over a canvas
// that has it, and removes it. The node is on screen right up to that reconcile,
// so from the user's side a node they placed vanishes on its own.
//
// Extracted from FE #18277 (`fix(agent): keep a hand-added node live through the
// first CRDT reconcile`), whose code half stays parked for the remote-apply
// pivot (Linear FE-2504, landing on FE #18700). Pinned with `test.fail()` on the
// last step so the bug is recorded now and the fix flips this to passing.
test.describe(
  'Human-added node survives reload before host acknowledgement',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      humanOpsHost: 'hold',
      blankStartupGraph: true
    })

    test('keeps the in-flight node through the first reconcile after reload', async ({
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
      })

      // Everything above is structure, and a failure there is still
      // unexpected: it would mean the node never reached the canvas or never
      // survived the reload at all, which is a different defect from the one
      // pinned below. test.fail() only reclassifies what is thrown after it.
      test.fail()

      await test.step('preserve the local node through first reconcile', async () => {
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
