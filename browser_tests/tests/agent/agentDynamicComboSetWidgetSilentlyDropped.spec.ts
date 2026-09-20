import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { toNodeId } from '@/types/nodeId'

/**
 * Regression for the #comfy-agent-user-feedback report from Jo Zhang
 * ("Magnific skin enhance"): the agent narrated "Faithful mode needs a
 * skin-detail value, but this session isn't letting me write that nested
 * sub-value directly" and later claimed it "can edit the drop down" but the
 * change never appeared. The node's `mode` widget is a real
 * `COMFY_DYNAMICCOMBO_V3` (see `MagnificImageSkinEnhancerNode.define_schema`
 * in ComfyUI's `comfy_api_nodes/nodes_magnific.py`) whose `faithful` option
 * genuinely reveals a nested `skin_detail` input — the agent's tool schema
 * (`show_node`'s `dynamic_options`, cloud's `digest.go`) correctly advertises
 * this, so the agent's narration was accurate, not a hallucination.
 *
 * Root cause: `setWidgetValue` in
 * `src/workbench/extensions/agent/crdt/liveWidgetProjection.ts` updates
 * `widgetValueStore` directly, then only assigns `widget.value = value` (the
 * step that actually runs a widget's own setter) when the store update
 * "didn't already make `widget.value` equal the new value". A `DynamicCombo`
 * widget's `value` getter (`dynamicComboWidget` in
 * `src/core/graph/widgets/dynamicWidgets.ts`) reads directly from that same
 * store, so right after the store write the getter already reports the new
 * value and the optimization skips the assignment — which means the
 * `DynamicCombo`'s custom setter (whose entire job is to mount/unmount the
 * option's nested sub-widgets via `updateWidgets`) never runs. The store
 * silently records "faithful" (an agent `set_widget` on `mode` can report
 * success) while the live canvas node never grows the `mode.skin_detail`
 * widget, so the option looks unchanged to the user.
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

test.describe(
  'Agent set_widget on a dynamic-combo widget',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('reveals the nested sub-widget the option declares, live on canvas', async ({
      page
    }) => {
      test.setTimeout(60_000)

      await page.route('**/api/object_info', (route) =>
        route.fulfill(jsonRoute({ [NODE_TYPE]: nodeDef }))
      )

      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      let socketSend: ((frame: unknown) => void) | null = null
      let subscribedTo: string | null = null
      await page.routeWebSocket(/\/ws/, (socket) => {
        socketSend = (frame) => socket.send(JSON.stringify(frame))
        socket.onMessage((raw) => {
          const frame: unknown = JSON.parse(raw.toString())
          if (typeof frame !== 'object' || frame === null) return
          const { type, data } = frame as { type?: unknown; data?: unknown }
          if (
            type !== 'doc_subscribe' ||
            typeof data !== 'object' ||
            data === null
          )
            return
          const { workflow_id, state_vector_b64 } = data as {
            workflow_id?: unknown
            state_vector_b64?: unknown
          }
          if (
            workflow_id !== WORKFLOW_ID ||
            typeof state_vector_b64 !== 'string'
          )
            return
          subscribedTo = workflow_id
          socketSend!(host.subscribed())
          socketSend!(host.catchUp(state_vector_b64))
        })
        socketSend({
          type: 'status',
          data: { status: { exec_info: { queue_remaining: 0 } }, sid: 's' }
        })
      })
      await page.route('**/api/agent/threads', (route) =>
        route.fulfill(jsonRoute({ threads: [] }))
      )
      await page.route('**/api/agent/run-mode', (route) =>
        route.fulfill(jsonRoute({ mode: 'ask_approval', credit_limit: null }))
      )
      await page.route('**/api/agent/threads/*/messages', (route) => {
        if (route.request().method() !== 'POST')
          return route.fulfill(jsonRoute([]))
        return route.fulfill({
          status: 202,
          contentType: 'application/json',
          body: JSON.stringify({
            thread_id: THREAD_ID,
            message_id: MESSAGE_ID,
            workflow_id: WORKFLOW_ID
          })
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
        return route.fulfill(
          jsonRoute({
            path,
            modified: Date.now(),
            size: request.postDataBuffer()?.length ?? 0
          })
        )
      })
      await page.route('**/api/workflows?*', (route) =>
        route.fulfill(
          jsonRoute({
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
          })
        )
      )

      const vueNodes = new VueNodeHelpers(page)
      const panel = page.locator('#agent-panel-root')

      await test.step('open the agent panel and target the workflow', async () => {
        await page
          .getByRole('button', { name: enMessages.agent.entryButton })
          .click()
        await expect(panel).toBeVisible()
        await panel
          .getByRole('button', { name: enMessages.agent.switchWorkflow })
          .click()
        await page
          .getByRole('menuitemradio', { name: 'Unsaved Workflow', exact: true })
          .click()
      })

      await test.step('send a turn so the session binds the workflow', async () => {
        const composer = panel.getByRole('textbox', {
          name: /^Describe ideas/
        })
        await composer.fill('hello')
        await panel.getByRole('button', { name: enMessages.agent.send }).click()
        await expect(panel.getByText('hello').first()).toBeVisible()
        socketSend!({
          type: 'agent_message_done',
          data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
        })
        await expect
          .poll(() => subscribedTo, { timeout: 20_000 })
          .toBe(WORKFLOW_ID)
      })

      await expect(vueNodes.getNodeLocator(String(NODE_ID))).toBeVisible()

      await test.step("agent sets mode to 'faithful' over the CRDT doc", async () => {
        const update = host.apply([
          {
            op: 'set_widget',
            node_id: NODE_ID,
            widget: 'mode',
            value: 'faithful'
          }
        ])
        socketSend!(update)
      })

      const widgetNames = () =>
        page.evaluate((id) => {
          const node = window.app!.graph.getNodeById(id)
          return (node?.widgets ?? []).map((widget) => widget.name)
        }, toNodeId(NODE_ID))

      // The document now authoritatively records mode: "faithful" (matching
      // an agent tool call that reports success), so the canvas should grow
      // the `mode.skin_detail` widget the "faithful" option declares in the
      // node's real Python schema — exactly what a human clicking the same
      // dropdown gets.
      await expect.poll(widgetNames).toContain('mode.skin_detail')
    })
  }
)
