import { expect } from '@playwright/test'

import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// A text-only turn: the follower subscribes to the recorded workflow's doc and
// the agent changes nothing, so the document holds exactly the seed, and then
// exactly what the user does by hand.
const CASE = 'agent-rec-text-only-answer'
const ADD_POSITION: [number, number] = [400, 400]

// Clear Workflow is the one user action that rotates the live root graph id
// without a graph load: the command calls `app.clean()`, whose `LGraph.clear()`
// mints a fresh uuid while the bound document is unchanged. Whatever owns the
// Agent's "which graph is my document on" answer has to see that rotation --
// otherwise every edit the user makes after clearing is refused as targeting a
// foreign graph (`agent_crdt_op_for_unbound_graph`), with nothing on screen to
// say the canvas and the agent's document have stopped agreeing.
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
        // Without this the test proves nothing: the whole failure mode is the
        // rotation going unobserved, so a run where the id did not rotate would
        // pass for the wrong reason.
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
