import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe(
  'A node placed through the search box stays interactive with Agent bound',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      humanOpsHost: 'apply'
    })

    test('stays clickable and selectable after a workflow tab switch', async ({
      agentConversation
    }, testInfo) => {
      test.setTimeout(90_000)

      await test.step('replay the recorded turn', async () => {
        await agentConversation.runTurns()
        await agentConversation.installTabSwitchObserver()
      })

      const nodeId =
        await test.step('place a node through the search box and let the host judge it', async () => {
          const addedNodeId = await agentConversation.addNoteThroughSearchBox({
            x: 400,
            y: 400
          })
          await expect(
            agentConversation.vueNodes.getNodeLocator(addedNodeId)
          ).toBeVisible()
          const outcomes = await agentConversation.waitForHumanOps(1)
          expect(
            outcomes.filter((outcome) => outcome.outcome === 'rejected')
          ).toEqual([])
          expect(
            outcomes.some((outcome) => outcome.outcome === 'applied')
          ).toBe(true)
          expect(agentConversation.placementWasGhosted).toBe(true)
          return addedNodeId
        })

      await test.step('the placement flag is already clear locally', async () => {
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).not.toHaveAttribute('data-ghost')
      })

      await test.step('switch to another tab and back', () =>
        agentConversation.switchAwayAndBack('6', 'text'))

      await test.step('the reconcile did not resurrect the placement flag', async () => {
        await agentConversation.attachEvidence(testInfo, 'after-return')
        const node = agentConversation.vueNodes.getNodeLocator(nodeId)
        await expect(node).toBeVisible()
        await expect(node).not.toHaveAttribute('data-ghost')
        await expect(node).not.toHaveClass(/pointer-events-none/)
      })

      await test.step('the user can still select the node they placed', async () => {
        await agentConversation.vueNodes.selectNode(nodeId)
        await expect(agentConversation.vueNodes.selectedNodes).toHaveCount(1)
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toHaveClass(/outline-node-component-outline/)
      })
    })
  }
)
