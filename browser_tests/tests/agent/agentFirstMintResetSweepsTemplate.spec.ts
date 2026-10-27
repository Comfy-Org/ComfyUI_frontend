import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { DocResetFrame } from '@comfyorg/ingest-types'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import {
  agentTest as test,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

/**
 * The backend mints a workflow's CRDT doc lazily on the first agent turn that
 * touches it (`ensureDoc`, actor `system:mint`) and broadcasts a `doc_reset`
 * to an already-subscribed follower with no `doc_update`; the follower's
 * resubscribe catch-up carries the new lineage. The follower used to sweep the
 * canvas on every reset, blanking a freshly opened template until that
 * catch-up landed. A reset now only arms the next frame to replace the graph,
 * so the template nodes stay put.
 */

const WORKFLOW_ID = 'c9a1e5c2-4f3b-4a8e-9d2f-6b7a8c9d0e1f'
const THREAD_ID = 'e2b3c4d5-6f7a-4b8c-9d0e-1f2a3b4c5d6e'
const MESSAGE_ID = 'f3c4d5e6-7a8b-4c9d-0e1f-2a3b4c5d6e7f'

const TEMPLATE_NODE_A_ID = 501
const TEMPLATE_NODE_B_ID = 502

const TEMPLATE_GRAPH: ComfyWorkflowJSON = {
  last_node_id: TEMPLATE_NODE_B_ID,
  last_link_id: 0,
  nodes: [
    {
      id: TEMPLATE_NODE_A_ID,
      type: 'MarkdownNote',
      pos: [0, 0],
      size: [200, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: ['template node a']
    },
    {
      id: TEMPLATE_NODE_B_ID,
      type: 'MarkdownNote',
      pos: [300, 0],
      size: [200, 100],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: ['template node b']
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

const EMPTY_HOST_SEED: WorkflowJSON = { nodes: [], links: [] }
const EMPTY_CATALOG: WidgetCatalog = { types: {} }

test.describe(
  'Agent first turn on a template that has never had a CRDT doc',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test('does not sweep already-rendered template nodes off the canvas on the first-mint doc_reset', async ({
      page
    }) => {
      const host = new HostDoc(WORKFLOW_ID, EMPTY_HOST_SEED, EMPTY_CATALOG)
      const vueNodes = new VueNodeHelpers(page)

      const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)
      hostSocket.answerSubscribesWith(() => [host.subscribed()])
      await hostSocket.install()

      await bootAgentApp(page, true, {
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false
        },
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            message_id: MESSAGE_ID,
            thread_id: THREAD_ID,
            workflow_id: WORKFLOW_ID
          })
          await mockWorkflowPersistence(page, WORKFLOW_ID)
        }
      })

      await loadIntoBootWorkflow(page, TEMPLATE_GRAPH)
      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_A_ID))
      ).toBeVisible()
      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_B_ID))
      ).toBeVisible()

      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      await agentPanel.sendMessage('Check the workflow.')

      // A reset sent before the follower subscribed to WORKFLOW_ID is dropped
      // by the bridge, which would make the assertions below vacuous.
      await expect
        .poll(() => hostSocket.subscribeCount())
        .toBeGreaterThanOrEqual(1)

      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_A_ID))
      ).toBeVisible()
      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_B_ID))
      ).toBeVisible()

      hostSocket.send({
        type: 'agent_tool_call',
        data: {
          tool_call_id: 'call-print',
          tool_name: 'print_workflow',
          status: 'success',
          duration_ms: 40,
          thread_id: THREAD_ID,
          message_id: MESSAGE_ID
        }
      })

      hostSocket.send({
        type: 'doc_reset',
        data: {
          v: 1,
          workflow_id: WORKFLOW_ID,
          seq: 1,
          lineage_seq: 1,
          actor: 'system:mint'
        }
      } satisfies DocResetFrame)

      // The bridge resubscribes once it has dispatched the reset, so the
      // second subscribe proves the reset was processed.
      await expect
        .poll(() => hostSocket.subscribeCount())
        .toBeGreaterThanOrEqual(2)

      await page.screenshot({
        path: test.info().outputPath('template-after-mint-reset.png')
      })

      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_A_ID))
      ).toBeVisible()
      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_B_ID))
      ).toBeVisible()
    })
  }
)
