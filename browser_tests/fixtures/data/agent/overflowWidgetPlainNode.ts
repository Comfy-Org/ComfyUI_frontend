import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'

import overflowPlainWorkflow from '@e2e/assets/agent/overflow-widget-plain-node.json' with { type: 'json' }
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

const OVERFLOW_PLAIN_NODE_TYPE = 'TestCatalogShortPlainNode'
export const OVERFLOW_PLAIN_NODE_ID = 2647
const OVERFLOW_PLAIN_WORKFLOW_ID = '6c1e9b7d-3a4f-4e2b-8c5d-9f0a1b2c3d4e'
const OVERFLOW_PLAIN_THREAD_ID = 'd8e9fa0b-1c2d-4e3f-9a4b-5c6d7e8f9a0b'
const OVERFLOW_PLAIN_MESSAGE_ID = 'a1b2c3d4-e5f6-4789-8a9b-0c1d2e3f4a5b'

function intSlider(value: number): InputSpec {
  return [
    'INT',
    { default: value, min: 0, max: 100, step: 1, display: 'slider' }
  ]
}

const overflowPlainNodeDef: ComfyNodeDef = {
  name: OVERFLOW_PLAIN_NODE_TYPE,
  display_name: 'Test Catalog Short Plain Node',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  api_node: true,
  output: ['IMAGE'],
  output_is_list: [false],
  output_name: ['IMAGE'],
  input: {
    required: {
      known: intSlider(10),
      added_after_catalog: intSlider(20)
    }
  },
  input_order: { required: ['known', 'added_after_catalog'] }
}

const overflowPlainCatalog: WidgetCatalog = {
  types: { [OVERFLOW_PLAIN_NODE_TYPE]: { widget_order: ['known'] } }
}

const overflowPlainSeed = overflowPlainWorkflow as WorkflowJSON

/** The host document and the socket delivering its frames to a booted app. */
export interface OverflowPlainHost {
  doc: HostDoc
  socket: AgentFollowerHostSocket
  endTurn: () => void
}

export const overflowPlainNodeTest = agentTest.extend<{
  overflowPlainHost: OverflowPlainHost
}>({
  overflowPlainHost: async ({ page, agentFlagEnabled }, use) => {
    await page.route('**/api/object_info', (route) =>
      route.fulfill(
        jsonRoute({ [OVERFLOW_PLAIN_NODE_TYPE]: overflowPlainNodeDef })
      )
    )

    const doc = new HostDoc(
      OVERFLOW_PLAIN_WORKFLOW_ID,
      overflowPlainSeed,
      overflowPlainCatalog
    )
    const socket = new AgentFollowerHostSocket(
      page,
      OVERFLOW_PLAIN_WORKFLOW_ID,
      doc
    )
    await socket.install()

    await bootAgentApp(page, agentFlagEnabled, {
      objectInfo: 'server',
      settings: { 'Comfy.Graph.CanvasInfo': false },
      beforeNavigate: async (page) => {
        await mockAgentTurnApi(page, {
          thread_id: OVERFLOW_PLAIN_THREAD_ID,
          message_id: OVERFLOW_PLAIN_MESSAGE_ID,
          workflow_id: OVERFLOW_PLAIN_WORKFLOW_ID
        })
        await mockWorkflowPersistence(page, OVERFLOW_PLAIN_WORKFLOW_ID)
      }
    })

    await use({
      doc,
      socket,
      endTurn: () =>
        socket.send({
          type: 'agent_message_done',
          data: {
            message_id: OVERFLOW_PLAIN_MESSAGE_ID,
            thread_id: OVERFLOW_PLAIN_THREAD_ID
          }
        })
    })
  }
})
