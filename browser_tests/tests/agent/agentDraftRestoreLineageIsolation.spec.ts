import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import {
  readAgentDraftLineage,
  seedAgentDraftLineage
} from '@e2e/fixtures/agentDraftRestoreFixture'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest as test,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

const WORKFLOW_ID = 'd36d561e-c1d0-4c16-83ff-45c2b1be57f1'
const THREAD_ID = '454616e3-17ce-42dd-973a-10c185b562eb'
const MESSAGE_ID = 'cae77e1f-643c-46e8-9579-7671578cf223'
const STALE_NODE_ID = 951
const RESTORED_LINEAGE = 4
const CURRENT_LINEAGE = 9
// Documents minted before lineage tracking sit at lineage 0, which the host's
// omitempty ack encodes by omitting lineage_seq.
const PRE_TRACKING_LINEAGE = 0
const EMPTY_HOST_SEED: WorkflowJSON = { nodes: [], links: [] }
const EMPTY_CATALOG: WidgetCatalog = { types: {} }
const RESTORED_GRAPH: ComfyWorkflowJSON = {
  last_node_id: STALE_NODE_ID,
  last_link_id: 0,
  nodes: [
    {
      id: STALE_NODE_ID,
      type: 'MarkdownNote',
      pos: [0, 0],
      size: [220, 100],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [],
      properties: {},
      widgets_values: ['belongs to the retired lineage']
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

test.describe(
  'Agent restored draft lineage isolation',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 120_000 })

    async function restoreAndSubscribe(
      page: Page,
      hostLineageSeq: number,
      restoredLineage: { workflowId: string; lineageSeq: number }
    ) {
      const host = new HostDoc(
        WORKFLOW_ID,
        EMPTY_HOST_SEED,
        EMPTY_CATALOG,
        hostLineageSeq
      )
      const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)
      await hostSocket.install()
      await bootAgentApp(page, true, {
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false,
          'Comfy.Workflow.Persist': true
        },
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(
            page,
            {
              message_id: MESSAGE_ID,
              thread_id: THREAD_ID,
              workflow_id: WORKFLOW_ID
            },
            () =>
              seedAgentDraftLineage(
                page,
                restoredLineage.workflowId,
                restoredLineage.lineageSeq
              )
          )
          await mockWorkflowPersistence(page, WORKFLOW_ID)
        }
      })
      await loadIntoBootWorkflow(page, RESTORED_GRAPH)

      const nodes = new VueNodeHelpers(page)
      await expect(nodes.getNodeLocator(String(STALE_NODE_ID))).toBeVisible()
      const panel = new AgentPanel(page)
      await panel.open()
      await panel.selectWorkflow()
      await panel.sendMessage('Inspect this restored workflow.')

      await expect.poll(() => hostSocket.subscribeCount()).toBeGreaterThan(0)
      return { hostSocket, nodes }
    }

    test('replaces a restored canvas when the host reports another lineage', async ({
      page
    }) => {
      const { hostSocket, nodes } = await restoreAndSubscribe(
        page,
        CURRENT_LINEAGE,
        { workflowId: WORKFLOW_ID, lineageSeq: RESTORED_LINEAGE }
      )
      expect(
        hostSocket
          .clientDocFrames()
          .find((frame) => frame.type === 'doc_subscribe')?.knownLineageSeq
      ).toBe(RESTORED_LINEAGE)
      await expect(nodes.getNodeLocator(String(STALE_NODE_ID))).toHaveCount(0)
    })

    test('records the pre-tracking lineage an accepted ack omits', async ({
      page
    }) => {
      await restoreAndSubscribe(page, PRE_TRACKING_LINEAGE, {
        workflowId: 'retired-workflow',
        lineageSeq: RESTORED_LINEAGE
      })

      await expect
        .poll(() => readAgentDraftLineage(page))
        .toEqual({ workflowId: WORKFLOW_ID, lineageSeq: PRE_TRACKING_LINEAGE })
    })
  }
)
