import type { WebSocketRoute } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { parseServerDocFrame } from '@/workbench/extensions/agent/crdt/docFrameClient'
import type { AgentWsEvent } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import type { HostFrame } from '@e2e/fixtures/agentConversationHostDoc'
import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import type { WorkspaceStore } from '@e2e/types/globals'

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

/** `true` for a `doc_subscribe` frame addressed to `WORKFLOW_ID`; never throws inside the socket mock. */
function parseDocSubscribeForWorkflow(raw: Buffer | string): boolean {
  let frame: unknown
  try {
    frame = JSON.parse(raw.toString())
  } catch {
    return false
  }
  if (typeof frame !== 'object' || frame === null) return false
  const { type, data } = frame as { type?: unknown; data?: unknown }
  if (type !== 'doc_subscribe' || typeof data !== 'object' || data === null)
    return false
  const { workflow_id } = data as { workflow_id?: unknown }
  return workflow_id === WORKFLOW_ID
}

/** Awaits the Nth `doc_subscribe` for `WORKFLOW_ID`: 1 is the turn's binding, 2 the post-reset resubscribe. */
function createSubscribeTracker(): {
  recordSubscribe: () => void
  waitForCount: (target: number) => Promise<void>
} {
  let count = 0
  const waiters: { target: number; resolve: () => void }[] = []
  return {
    recordSubscribe: () => {
      count++
      for (let i = waiters.length - 1; i >= 0; i--) {
        if (count >= waiters[i].target) {
          waiters[i].resolve()
          waiters.splice(i, 1)
        }
      }
    },
    waitForCount: (target) => {
      if (count >= target) return Promise.resolve()
      return new Promise((resolve) => waiters.push({ target, resolve }))
    }
  }
}

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

      let socket: WebSocketRoute | null = null
      const subscribeTracker = createSubscribeTracker()
      const send = (frame: AgentWsEvent | HostFrame): void => {
        if (
          (frame.type.startsWith('doc_') || frame.type === 'awareness') &&
          parseServerDocFrame(frame) === null
        )
          throw new Error(`frame ${frame.type} is not a valid doc frame`)
        if (!socket) throw new Error('the app has not opened /ws yet')
        socket.send(JSON.stringify(frame))
      }

      await page.routeWebSocket(/\/ws/, (ws) => {
        socket = ws
        ws.onMessage((raw) => {
          if (!parseDocSubscribeForWorkflow(raw)) return
          subscribeTracker.recordSubscribe()
          send(host.subscribed())
        })
      })

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

      // Load into the boot tab (4th arg) rather than minting a second
      // "Unsaved Workflow (2)" tab, which selectWorkflow() below would not
      // pick. Boot's own default-workflow load is not awaited by bootAgentApp,
      // so wait for the active workflow before reading it.
      await page.waitForFunction(() => {
        const workspace = window.app?.extensionManager as
          | WorkspaceStore
          | undefined
        return workspace?.workflow.activeWorkflow != null
      })
      await page.evaluate(async (json) => {
        const activeWorkflow = (window.app!.extensionManager as WorkspaceStore)
          .workflow.activeWorkflow!
        await window.app!.loadGraphData(json, true, true, activeWorkflow)
      }, TEMPLATE_GRAPH)
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
      await subscribeTracker.waitForCount(1)

      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_A_ID))
      ).toBeVisible()
      await expect(
        vueNodes.getNodeLocator(String(TEMPLATE_NODE_B_ID))
      ).toBeVisible()

      send({
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

      send({
        type: 'doc_reset',
        data: { v: 1, workflow_id: WORKFLOW_ID, seq: 1, actor: 'system:mint' }
      })

      // The bridge resubscribes once it has dispatched the reset, so the
      // second subscribe proves the reset was processed.
      await subscribeTracker.waitForCount(2)

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
