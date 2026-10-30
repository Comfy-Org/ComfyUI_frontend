import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'

test.describe(
  'Human edit after another workflow resets',
  {
    tag: ['@cloud', '@agent', '@vue-nodes'],
    annotation: {
      type: 'issue',
      description: 'https://github.com/Comfy-Org/ComfyUI_frontend/pull/19871'
    }
  },
  () => {
    const RESET_WORKFLOW_ID = '93ba31ab-65a2-42fe-bd12-b96bf4ef3591'
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      humanOpsHost: 'apply'
    })

    test('keeps the original workflow mint cursor before its resubscribe is acknowledged', async ({
      agentConversation
    }) => {
      const { recordedWorkflowId, firstBaseVersion } =
        await test.step('Edit the original workflow and record its wire version', async () => {
          await agentConversation.runTurns()
          const recordedWorkflowId = agentConversation.conversation.workflow.id
          const firstNodeId = await agentConversation.addNodeOfType(
            'Note',
            [400, 400]
          )
          await expect(
            agentConversation.vueNodes.getNodeLocator(firstNodeId)
          ).toBeVisible()
          await agentConversation.waitForHumanOps(1)
          const firstBaseVersion =
            await agentConversation.humanAddNodeBaseVersion(
              recordedWorkflowId,
              firstNodeId
            )
          return { recordedWorkflowId, firstBaseVersion }
        })

      await test.step('Reset the other workflow', async () => {
        await agentConversation.activateEmptyWorkflow(
          RESET_WORKFLOW_ID,
          'Reset target'
        )
        const beforeReset = agentConversation.subscribeCount(RESET_WORKFLOW_ID)
        agentConversation.sendDocumentReset(RESET_WORKFLOW_ID)
        await expect
          .poll(() => agentConversation.subscribeCount(RESET_WORKFLOW_ID))
          .toBeGreaterThanOrEqual(beforeReset + 1)
      })

      await test.step('Edit before the resubscribe acknowledgement', async () => {
        await agentConversation.activateRecordedWorkflowBeforeSubscribeAck()
        const secondNodeId = await agentConversation.addNodeOfType(
          'Note',
          [650, 400]
        )
        await expect(
          agentConversation.vueNodes.getNodeLocator(secondNodeId)
        ).toBeVisible()
        expect(
          await agentConversation.humanAddNodeBaseVersion(
            recordedWorkflowId,
            secondNodeId
          )
        ).toBeGreaterThan(firstBaseVersion)
        agentConversation.resumeWorkflowSubscribe(recordedWorkflowId)
      })
    })
  }
)
