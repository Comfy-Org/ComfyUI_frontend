import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type {
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { GraphOperation } from '@/workbench/extensions/agent/crdt/graphOperations'
import type {
  AgentRunModePreference,
  AgentTurnAccepted
} from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { mintWireOps } from '@/workbench/extensions/agent/crdt/opEnvelope'

/**
 * Regression: the follower's widget write used to skip the
 * `widget.value = value` assignment whenever the preceding store write
 * already left `widget.value` reporting the new value. A `DynamicCombo`
 * widget's value getter (`dynamicComboWidget` in
 * `src/core/graph/widgets/dynamicWidgets.ts`) always does, so its setter —
 * which mounts the option's nested sub-widgets — never ran.
 */

const NODE_TYPE = 'TestMagnificSkinEnhancer'
const NODE_ID = 501
const WORKFLOW_ID = '7c1e2a4d-9b3f-4e5a-8c6d-1f2a3b4c5d6e'
const THREAD_ID = 'e2f3a4b5-6c7d-4e8f-9a0b-1c2d3e4f5a6b'
const MESSAGE_ID = 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d'

const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Test Magnific Skin Enhancer',
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
      mode: [
        'COMFY_DYNAMICCOMBO_V3',
        {
          options: [
            { key: 'creative', inputs: { required: {} } },
            {
              key: 'faithful',
              inputs: {
                required: {
                  skin_detail: [
                    'INT',
                    {
                      default: 80,
                      min: 0,
                      max: 100,
                      step: 1,
                      display: 'slider'
                    }
                  ]
                }
              }
            }
          ]
        }
      ]
    }
  },
  input_order: { required: ['mode'] }
}

const catalog: WidgetCatalog = {
  types: { [NODE_TYPE]: { widget_order: ['mode'] } }
}

const seed: WorkflowJSON = {
  nodes: [
    {
      id: NODE_ID,
      type: NODE_TYPE,
      pos: [0, 0],
      size: [270, 120],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
      properties: {},
      widgets_values: ['creative']
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

const SOCKET_SID = '9c8b7a6f-5e4d-4c3b-8a1f-0d9e8c7b6a5f'

test.describe(
  'Agent set_widget on a dynamic-combo widget',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('keeps applying visible edits after rejecting an unknown dotted widget', async ({
      page
    }) => {
      test.setTimeout(60_000)

      await page.route('**/api/object_info', (route) =>
        route.fulfill(jsonRoute({ [NODE_TYPE]: nodeDef }))
      )

      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        SOCKET_SID
      )
      await hostSocket.install()

      const threadList: AgentThreadListResponse = {
        pagination: { has_more: false, limit: 100, offset: 0, total: 0 },
        threads: []
      }
      await page.route('**/api/agent/threads', (route) =>
        route.fulfill(jsonRoute(threadList))
      )
      const runModePreference: AgentRunModePreference = {
        mode: 'ask_approval',
        credit_limit: null
      }
      await page.route('**/api/agent/run-mode', (route) =>
        route.fulfill(jsonRoute(runModePreference))
      )
      const turnAccepted: AgentTurnAccepted = {
        thread_id: THREAD_ID,
        message_id: MESSAGE_ID,
        workflow_id: WORKFLOW_ID
      }
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() !== 'POST')
          return route.fulfill(jsonRoute([]))
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify(turnAccepted)
        })
      })

      await bootAgentApp(page, true, {
        objectInfo: 'server',
        settings: {
          'Comfy.VueNodes.Enabled': true,
          'Comfy.Graph.CanvasInfo': false
        }
      })

      let savedName: string | undefined
      await page.route('**/api/userdata/*', (route) => {
        const request = route.request()
        const path = decodeURIComponent(
          new URL(request.url()).pathname.split('/userdata/')[1]
        )
        if (request.method() !== 'POST' || !path.startsWith('workflows/'))
          return route.fallback()
        savedName = path.slice('workflows/'.length, -'.json'.length)
        const saved: UserDataFullInfo = {
          path,
          modified: Date.now(),
          size: request.postDataBuffer()?.length ?? 0
        }
        return route.fulfill(jsonRoute(saved))
      })
      await page.route('**/api/workflows?*', (route) => {
        const workflows: WorkflowListResponse = {
          data:
            savedName === undefined
              ? []
              : [
                  {
                    id: WORKFLOW_ID,
                    name: savedName,
                    created_at: '2026-09-01T00:00:00Z',
                    updated_at: '2026-09-01T00:00:00Z',
                    created_by: 'test-user-e2e',
                    latest_version: 1
                  }
                ],
          pagination: {
            has_more: false,
            limit: 100,
            offset: 0,
            total: savedName === undefined ? 0 : 1
          }
        }
        return route.fulfill(jsonRoute(workflows))
      })

      const vueNodes = new VueNodeHelpers(page)
      const agentPanel = new AgentPanel(page)
      const panel = agentPanel.root

      await test.step('open the agent panel and target the workflow', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
      })

      await test.step('send a turn so the session binds the workflow', async () => {
        const composer = panel.getByRole('textbox', {
          name: /^Describe ideas/
        })
        await composer.fill('hello')
        await panel.getByRole('button', { name: enMessages.agent.send }).click()
        await expect(panel.getByText('hello').first()).toBeVisible()
        hostSocket.send({
          type: 'agent_message_done',
          data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
        })
        await hostSocket.waitForSubscribe()
      })

      await expect(vueNodes.getNodeLocator(String(NODE_ID))).toBeVisible()

      await test.step('reject unsupported dotted widget without damaging the projection', async () => {
        const operation: GraphOperation = {
          op: 'set_widget',
          node_id: NODE_ID,
          widget: 'mode.skin_detail',
          value: 90
        }
        const ops = mintWireOps([operation], {
          actor: 'agent:test:turn',
          baseVersion: 1
        })

        const rejected = host.applyWire(ops)

        expect(rejected.outcomes).toEqual([
          expect.objectContaining({
            outcome: 'rejected',
            reason: expect.objectContaining({ code: 'unknown_widget' })
          })
        ])
        expect(rejected.update).toBeNull()
        expect(host.projection().nodes[0].widgets_values).toEqual(['creative'])
      })

      await test.step("agent sets mode to 'faithful' over the CRDT doc", async () => {
        hostSocket.send(
          host.apply([
            {
              op: 'set_widget',
              node_id: NODE_ID,
              widget: 'mode',
              value: 'faithful'
            }
          ])
        )
      })

      // The document now authoritatively records mode: "faithful" (matching
      // an agent tool call that reports success), so the canvas should grow
      // the `mode.skin_detail` widget the "faithful" option declares in the
      // node's real Python schema — exactly what a human clicking the same
      // dropdown gets.
      const skinDetailField = vueNodes
        .getNodeLocator(String(NODE_ID))
        .getByRole('spinbutton', { name: 'mode.skin_detail' })
      await expect(skinDetailField).toBeVisible()
      await expect(
        vueNodes.getNodeLocator(String(NODE_ID)).getByText('faithful', {
          exact: true
        })
      ).toBeVisible()
    })
  }
)
