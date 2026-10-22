import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import {
  ADDITIVE_CANVAS_CASE,
  ADDITIVE_READINESS_NODE_ID,
  ADDITIVE_READINESS_WIDGET
} from '@e2e/fixtures/data/agent/agentCanvasAdditive'

test.describe(
  'Agent undo survives a remote frame',
  { tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: ADDITIVE_CANVAS_CASE, humanOpsHost: 'apply' })

    test('keeps an echoed node addition undone after the next remote frame', async ({
      agentConversation,
      comfyPage
    }, testInfo) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded text-only Agent turn', async () => {
        await agentConversation.runTurns()
      })

      const nodeId =
        await test.step('add a note and wait for the host to accept it', async () => {
          const addedNodeId = await agentConversation.addNoteThroughSearchBox({
            x: 400,
            y: 400
          })
          await expect(
            agentConversation.vueNodes.getNodeLocator(addedNodeId)
          ).toBeVisible()
          // "The host judged the add" is not the precondition this test needs;
          // "the host applied it" is. Without the verdict and the document
          // check below, a refused add would leave the two later assertions
          // true for the wrong reason: the host would never have held the
          // node, so dropping it on undo and not resurrecting it are both
          // free.
          const outcomes = await agentConversation.waitForHumanOps(1)
          expect(
            outcomes.some((outcome) => outcome.outcome === 'applied')
          ).toBe(true)
          await expect
            .poll(() => agentConversation.hostNodeIds())
            .toContain(addedNodeId)
          return addedNodeId
        })

      await test.step('undo the addition and wait for the host to drop it', async () => {
        await comfyPage.keyboard.undo()
        await expect
          .poll(() => agentConversation.hostNodeIds())
          .not.toContain(nodeId)
      })

      await test.step('the next remote frame does not resurrect the node', async () => {
        await agentConversation.waitForPendingFrames(
          ADDITIVE_READINESS_NODE_ID,
          ADDITIVE_READINESS_WIDGET,
          'next remote frame landed'
        )
        await agentConversation.attachEvidence(testInfo, 'after-remote-frame')
        // Both layers, because resurrection originates in the document: a node
        // put back there but not yet mounted would pass an unmounted-only
        // check on its first sample.
        expect(agentConversation.hostNodeIds()).not.toContain(nodeId)
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toHaveCount(0)
      })
    })
  }
)
