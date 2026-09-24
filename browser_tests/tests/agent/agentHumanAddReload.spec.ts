import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const ADD_POSITION: [number, number] = [400, 400]

test.describe(
  'Human-added node survives reload before host acknowledgement',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: CASE,
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
            ADD_POSITION
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
