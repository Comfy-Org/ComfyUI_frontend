import { mergeTests } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { AgentConversationHarness } from '@e2e/fixtures/agentConversationFixture'
import { agentConversationTest } from '@e2e/fixtures/agentConversationFixture'
import { hostTelemetryFixture } from '@e2e/fixtures/hostTelemetryFixture'

const test = mergeTests(agentConversationTest, hostTelemetryFixture)

const SECOND_WORKFLOW_ID = '2d1c4f58-9b3a-4a71-8f0d-6c5e1b2a7d94'
const SECOND_WORKFLOW_NAME = 'Second workflow'
const BOUND_TAB_NAME = 'Unsaved Workflow'
const UNBOUND_GRAPH_REPORT = 'agent_crdt_op_for_unbound_graph'

/** Every op this client has sent so far, in frame order, as `op:node_id`. */
function mintedOps(agentConversation: AgentConversationHarness): string[] {
  return agentConversation
    .clientDocFrames()
    .filter((frame) => frame.type === 'doc_ops')
    .flatMap((frame) => frame.ops)
}

// Closing a workflow tab disposes that tab's own `LGraph` with `graph.clear()`
// (`ComfyWorkflow.releaseGraph`, per-workflow graph ownership since #21571).
// Disposal is not a user editing the canvas, so it must not reach the agent's
// doc op minter at all: a disposal the minter accepts either mints
// `{ op: 'clear', removed_nodes: [every node] }` into the document the tab was
// bound to -- the user closes one tab and the agent's copy of that workflow is
// emptied -- or, when the closed tab is not the bound one, is refused with an
// `agent_crdt_op_for_unbound_graph` report (Sentry CLOUD-FRONTEND-PROD-3PD).
//
// Both outcomes are read here through what leaves the client and what the host
// document holds, not through the minter: the fix is a provenance scope on a
// shared disposal path, and the contract it has to keep is that the document
// survives a tab close. `docOpMinter.test.ts` ("closing a workflow tab
// disposes its graph") covers the same chain at the minter + workflow-store
// level, including the arm where the closed tab is itself the bound one.
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
      test.setTimeout(120_000)
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

      await test.step('the user closes the first tab', async () => {
        await topbar.closeWorkflowTab(BOUND_TAB_NAME)
        const closeAnyway = page.getByRole('dialog').getByRole('button', {
          name: enMessages.sideToolbar.workflowTab.dirtyCloseAnyway,
          exact: true
        })
        if (await closeAnyway.isVisible()) await closeAnyway.click()
        await expect(topbar.getWorkflowTab(BOUND_TAB_NAME)).toHaveCount(0)
      })

      // A later op on the same socket is the barrier the absence assertions
      // below need: frames reach the host in order on one channel, so once the
      // host has judged this edit, a clear minted by the close ahead of it has
      // already arrived. Without it, "no clear was sent" could resolve against
      // a client that simply has not flushed its batch yet.
      await test.step('an edit after the close reaches the host', async () => {
        const nodeId = await agentConversation.addNodeOfType('Note', [500, 400])
        await expect(
          agentConversation.vueNodes.getNodeLocator(nodeId)
        ).toBeVisible()
        await agentConversation.waitForHumanOps(1)
        expect(mintedOps(agentConversation)).toContain(`add_node:${nodeId}`)
      })

      expect(
        mintedOps(agentConversation).filter((op) => op.startsWith('clear:'))
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
