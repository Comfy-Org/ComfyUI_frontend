import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Production source: https://linear.app/comfyorg/issue/PM-1931
// An imported missing-node snapshot may carry the document's private
// `__incarnation` key. The command-site snapshot must keep that serializer
// detail out of the add_node accepted by the real host applier.
test.describe(
  'Live node serializer with reserved document storage',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      humanOpsHost: 'apply'
    })

    test('adding the node creates a host-accepted visible node', async ({
      agentConversation,
      page
    }) => {
      test.setTimeout(90_000)
      await agentConversation.runTurns()

      const addedNodeId = await page.evaluate(() => {
        const node = window.LiteGraph!.createNode('KSampler')
        if (!node) throw new Error('KSampler is not registered')
        const serialize = node.serialize.bind(node)
        node.serialize = () => ({
          ...serialize(),
          __incarnation: '0',
          extension_payload: { owner: 'custom-node' }
        })
        node.pos = [420, 320]
        window.app!.graph.add(node)
        return String(node.id)
      })

      await expect(
        agentConversation.vueNodes.getNodeLocator(addedNodeId)
      ).toBeVisible()
      await expect
        .poll(() => agentConversation.hostNodeIds())
        .toContain(addedNodeId)
      expect(agentConversation.humanOpOutcomes()).toContainEqual(
        expect.objectContaining({ outcome: 'applied' })
      )
    })
  }
)
