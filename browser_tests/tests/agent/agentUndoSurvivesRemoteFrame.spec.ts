import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import { nextFrame } from '@e2e/fixtures/utils/timing'

const CASE = 'agent-rec-text-only-answer'
const PROMPT_NODE_ID = '6'
const PROMPT_WIDGET = 'text'

test.describe(
  'Undo while the Agent follows the canvas',
  { tag: ['@cloud', '@agent', '@canvas', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('keeps an echoed node addition undone after the next remote frame', async ({
      agentConversation,
      page
    }, testInfo) => {
      test.setTimeout(90_000)

      await test.step('bind the Agent follower to the visible workflow', async () => {
        await agentConversation.runTurns()
      })

      const nodeId =
        await test.step('add a node and wait for its host echo to reach the canvas', async () => {
          const addedNodeId = await agentConversation.addNoteThroughSearchBox({
            x: 400,
            y: 400
          })
          const node = agentConversation.vueNodes.getNodeLocator(addedNodeId)
          await expect(node).toBeVisible()
          await agentConversation.waitForHumanOps(1)
          await expect(node).toBeVisible()
          return addedNodeId
        })

      await test.step('undo the echoed addition', async () => {
        await page.locator('#graph-canvas').press('Control+KeyZ')
        await nextFrame(page)
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toBeHidden()
        await agentConversation.waitForHumanOps(2)
      })

      await test.step('an unrelated remote frame does not resurrect the node', async () => {
        await agentConversation.waitForPendingFrames(
          PROMPT_NODE_ID,
          PROMPT_WIDGET,
          'later remote frame landed'
        )
        await agentConversation.attachEvidence(testInfo, 'after-remote-frame')
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toBeHidden()
      })
    })
  }
)
