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
      await test.step('replay the recorded text-only Agent turn', async () => {
        await agentConversation.runTurns()
      })

      const nodeId =
        await test.step('add a note and wait for the host echo to land', async () => {
          const addedNodeId = await agentConversation.addNoteThroughSearchBox({
            x: 400,
            y: 400
          })
          await agentConversation.waitForHumanOps(1)
          await agentConversation.waitForPendingFrames(
            ADDITIVE_READINESS_NODE_ID,
            ADDITIVE_READINESS_WIDGET,
            'note echo landed'
          )
          await expect(
            agentConversation.vueNodes.getNodeLocator(addedNodeId)
          ).toBeVisible()
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
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toHaveCount(0)
      })
    })
  }
)
