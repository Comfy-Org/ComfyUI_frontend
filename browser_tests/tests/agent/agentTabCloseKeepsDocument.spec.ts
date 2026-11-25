import { mergeTests } from '@playwright/test'

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { agentConversationTest } from '@e2e/fixtures/agentConversationFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'

const test = mergeTests(agentConversationTest, hostTelemetryFixture)

test.describe(
  'Closing a workflow tab keeps the agent document',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({
      conversationCase: 'agent-rec-text-only-answer',
      humanOpsHost: 'apply',
      telemetryEnabled: true
    })

    test('does not clear it, and does not report the disposal as a refused edit', async ({
      agentConversation,
      hostErrorReports,
      page
    }) => {
      const SECOND_WORKFLOW_ID = '2d1c4f58-9b3a-4a71-8f0d-6c5e1b2a7d94'
      const SECOND_WORKFLOW_NAME = 'Second workflow'
      const BOUND_TAB_NAME = 'Unsaved Workflow'
      const UNBOUND_GRAPH_REPORT = 'agent_crdt_op_for_unbound_graph'
      const topbar = agentConversation.topbar

      const nodesBefore =
        await test.step('the bound tab has a document with nodes', async () => {
          await agentConversation.runTurns()
          const nodes = agentConversation.hostNodeIds()
          expect(nodes.length).toBeGreaterThan(0)
          return nodes
        })

      await test.step('the user opens a second workflow, which the agent binds to', async () => {
        await agentConversation.activateEmptyWorkflow(
          SECOND_WORKFLOW_ID,
          SECOND_WORKFLOW_NAME
        )
        await expect(topbar.getWorkflowTab(BOUND_TAB_NAME)).toHaveCount(1)
      })

      await test.step('the user closes the first tab, with no unsaved-changes prompt', async () => {
        await topbar.closeWorkflowTab(BOUND_TAB_NAME)
        await expect(page.getByRole('dialog')).toHaveCount(0)
        await expect(topbar.getWorkflowTab(BOUND_TAB_NAME)).toHaveCount(0)
      })

      await test.step('an edit after the close reaches the host, ordering any op the close sent ahead of it', async () => {
        const nodeId = await agentConversation.addNodeOfType('Note', [500, 400])
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toBeVisible()
        await agentConversation.waitForHumanOps(1)
        expect(agentConversation.humanOps()).toContain(`add_node:${nodeId}`)
      })

      expect(
        agentConversation.humanOps().filter((op) => op.startsWith('clear:'))
      ).toEqual([])
      expect(agentConversation.hostNodeIds()).toEqual(nodesBefore)
      expect(
        hostErrorReports.filter(
          ({ properties }) => properties.error_type === UNBOUND_GRAPH_REPORT
        )
      ).toEqual([])
    })
  }
)
