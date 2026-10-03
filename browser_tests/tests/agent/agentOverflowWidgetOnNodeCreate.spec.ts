import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type {
  AgentThreadListResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'
import type { UserDataFullInfo } from '@/platform/remote/comfyui/types'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { AgentRunModePreference } from '@/workbench/extensions/agent/schemas/agentApiSchema'

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

/**
 * BE-16625, the node-CREATION leg: the host names a `widgets_values` position
 * it has no catalog name for `_extra_N`, and the follower has to deliver that
 * value to the widget the position belongs to — a sub-widget the dynamic
 * combo's own setter mounts, which does not exist when the node is
 * constructed.
 *
 * The sibling spec (`agentDynamicComboSetWidgetSilentlyDropped`) covers the
 * frame leg, injecting the alias after the sub-widget is already on the
 * canvas. This one covers the leg a user reaches by reloading: the node is
 * born from a document that already carries the alias.
 *
 * It also pins what must NOT happen while doing it. The restoration array
 * `configure` reads is positional and is built before any setter runs, so a
 * position past the constructor's widget list can only be looked up as
 * `_extra_N`. Sizing that array by the alias index therefore leaves a hole at
 * every position the document names instead of aliasing, and litegraph
 * delivers a hole as a real `undefined` restoration — which blanks the widget
 * that mounts there rather than leaving its own value alone. Here `mode.a` is
 * such a position: the agent cannot restore 91 into it on this path (that is
 * the named half of the defect, which `widgets_values_named`/FE-3036 closes),
 * but it must still read its own default of 80 and not an empty field.
 *
 * BE-16625: https://linear.app/comfyorg/issue/BE-16625/widget-catalog-arity-mismatch-extra-n-positional-overflow-is-a
 */

const NODE_TYPE = 'TestOverflowSkinEnhancer'
const NODE_ID = 503
const WORKFLOW_ID = '4b2d8f6a-1c3e-4a5b-9d7f-2e8c0a1b3d5f'
const THREAD_ID = 'c7d8e9fa-0b1c-4d2e-8f3a-4b5c6d7e8f90'
const MESSAGE_ID = 'f0e1d2c3-b4a5-4968-8778-9a0b1c2d3e4f'
const SOCKET_SID = '2a3b4c5d-6e7f-4809-9a1b-2c3d4e5f6071'

const intSlider = (value: number) =>
  [
    'INT',
    { default: value, min: 0, max: 100, step: 1, display: 'slider' }
  ] as const

/** `faithful` expands TWO sub-widgets; the catalog only knows the first. */
const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Test Overflow Skin Enhancer',
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
                required: { a: intSlider(80), b: intSlider(70) }
              }
            }
          ]
        }
      ]
    }
  },
  input_order: { required: ['mode'] }
}

// Pinned when the node's selection expanded one sub-widget, so the live
// three-slot array overruns it by exactly one and the host aliases the tail.
const catalog: WidgetCatalog = {
  types: { [NODE_TYPE]: { widget_order: ['mode', 'mode.a'] } }
}

const seed: WorkflowJSON = {
  nodes: [
    {
      id: NODE_ID,
      type: NODE_TYPE,
      pos: [0, 0],
      size: [270, 160],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
      properties: {},
      widgets_values: ['faithful', 91, 71]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

test.describe(
  'Agent document carrying an overflow widget on node creation',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('applies the overflow value and leaves the position before it alone', async ({
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

      // The follower creates the node from the document it just received.
      const node = vueNodes.getNodeLocator(String(NODE_ID))
      await expect(node).toBeVisible()
      await expect(node.getByText('faithful', { exact: true })).toBeVisible()

      // `_extra_2` is the aliased tail: it must reach `mode.b`.
      await expect(
        node.getByRole('spinbutton', { name: 'mode.b' })
      ).toHaveValue('71')

      // `mode.a` is a named position past the constructor's widget list. Its
      // document value cannot be restored on this path, but the field must
      // still show its own default rather than an empty value.
      await expect(
        node.getByRole('spinbutton', { name: 'mode.a' })
      ).toHaveValue('80')
    })
  }
)
