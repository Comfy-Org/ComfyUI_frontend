import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

// Source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/19871
// A reset belongs to one document lineage. It must not erase the human
// sender's creator-owned Lamport cursor for another workflow visited earlier
// in the same page session.
const CASE = 'agent-rec-text-only-answer'
const RESET_WORKFLOW_ID = '93ba31ab-65a2-42fe-bd12-b96bf4ef3591'

test.describe(
  'Human edit after another workflow resets',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE, humanOpsHost: 'apply' })

    test('keeps the original workflow mint cursor before its resubscribe is acknowledged', async ({
      agentConversation
    }) => {
      test.setTimeout(90_000)

      await agentConversation.runTurns()

      const firstNodeId = await agentConversation.addNodeOfType(
        'Note',
        [400, 400]
      )
      await expect(
        agentConversation.vueNodes.getNodeLocator(firstNodeId)
      ).toBeVisible()
      await agentConversation.waitForHumanOps(1)

      const recordedWorkflowId = agentConversation.conversation.workflow.id
      const firstBatch = agentConversation
        .clientDocFrames()
        .find(
          (frame) =>
            frame.type === 'doc_ops' &&
            frame.workflowId === recordedWorkflowId &&
            frame.ops.includes(`add_node:${firstNodeId}`)
        )
      expect(firstBatch?.baseVersions).toHaveLength(1)

      await agentConversation.activateEmptyWorkflow(
        RESET_WORKFLOW_ID,
        'Reset target'
      )
      const beforeReset = agentConversation.subscribeCount(RESET_WORKFLOW_ID)
      agentConversation.sendDocumentReset(RESET_WORKFLOW_ID)
      await expect
        .poll(() => agentConversation.subscribeCount(RESET_WORKFLOW_ID))
        .toBeGreaterThanOrEqual(beforeReset + 1)

      await agentConversation.activateRecordedWorkflowBeforeSubscribeAck()
      const secondNodeId = await agentConversation.addNodeOfType(
        'Note',
        [650, 400]
      )
      await expect(
        agentConversation.vueNodes.getNodeLocator(secondNodeId)
      ).toBeVisible()

      await expect
        .poll(() =>
          agentConversation
            .clientDocFrames()
            .find(
              (frame) =>
                frame.type === 'doc_ops' &&
                frame.workflowId === recordedWorkflowId &&
                frame.ops.includes(`add_node:${secondNodeId}`)
            )
        )
        .not.toBeUndefined()

      // `expect.poll().not` returns void; re-read the frame after the retrying
      // boundary so the assertion below judges the actual wire envelope.
      const resumedBatch = agentConversation
        .clientDocFrames()
        .find(
          (frame) =>
            frame.type === 'doc_ops' &&
            frame.workflowId === recordedWorkflowId &&
            frame.ops.includes(`add_node:${secondNodeId}`)
        )
      expect(resumedBatch?.baseVersions[0]).toBeGreaterThan(
        firstBatch!.baseVersions[0]
      )
      agentConversation.resumeWorkflowSubscribe(recordedWorkflowId)
    })
  }
)
