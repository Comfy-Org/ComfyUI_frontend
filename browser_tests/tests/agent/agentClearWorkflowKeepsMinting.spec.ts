import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

const CASE = 'agent-rec-text-only-answer'
const ADD_POSITION: [number, number] = [400, 400]

test.describe(
  'Clear Workflow does not stop human edits reaching the Agent document',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('a node added after Clear Workflow still reaches the document', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)

      await test.step('bind the seeded workflow to the conversation', async () => {
        await agentConversation.runTurns()
        expect(agentConversation.hostNodeIds()).not.toEqual([])
      })

      const { before, after } =
        await test.step('the user clears the workflow', () =>
          agentConversation.clearWorkflowFromCommand())

      await test.step('the clear rotated the root graph id and emptied the document', async () => {
        expect(after).not.toBe(before)
        await expect.poll(() => agentConversation.hostNodeIds()).toEqual([])
      })

      await test.step('a node the user adds after the clear reaches the document', async () => {
        const nodeId = await agentConversation.addNodeOfType(
          'KSampler',
          ADD_POSITION
        )
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toBeVisible()

        await expect
          .poll(() => agentConversation.hostNodeIds())
          .toEqual([nodeId])
        expect(
          agentConversation
            .humanOpOutcomes()
            .filter((outcome) => outcome.outcome === 'rejected')
        ).toEqual([])
      })
    })
  }
)
