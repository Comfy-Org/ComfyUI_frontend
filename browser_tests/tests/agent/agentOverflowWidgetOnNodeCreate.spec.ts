import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { AgentThreadListResponse } from '@comfyorg/ingest-types'
import type { ComfyNodeDef, InputSpec } from '@/schemas/nodeDefSchema'
import type { AgentRunModePreference } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import {
  agentTest as test,
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * BE-16625 on node creation: the initial document already carries the
 * `_extra_2` alias for a sub-widget the dynamic combo mounts during
 * `configure`. The sibling spec `agentDynamicComboSetWidgetSilentlyDropped`
 * covers an alias delivered after the sub-widget exists.
 *
 * BE-16625: https://linear.app/comfyorg/issue/BE-16625/widget-catalog-arity-mismatch-extra-n-positional-overflow-is-a
 */

const NODE_TYPE = 'TestOverflowSkinEnhancer'
const NODE_ID = 503
const WORKFLOW_ID = '4b2d8f6a-1c3e-4a5b-9d7f-2e8c0a1b3d5f'
const THREAD_ID = 'c7d8e9fa-0b1c-4d2e-8f3a-4b5c6d7e8f90'
const MESSAGE_ID = 'f0e1d2c3-b4a5-4968-8778-9a0b1c2d3e4f'
const SOCKET_SID = '2a3b4c5d-6e7f-4809-9a1b-2c3d4e5f6071'

function intSlider(value: number): InputSpec {
  return [
    'INT',
    { default: value, min: 0, max: 100, step: 1, display: 'slider' }
  ]
}

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
            },
            {
              key: 'second',
              inputs: {
                required: { a: intSlider(40), b: intSlider(30) }
              }
            }
          ]
        }
      ]
    }
  },
  input_order: { required: ['mode'] }
}

// The catalog names `mode.a` but not `mode.b`, so the host stores the last
// value under the positional alias `_extra_2`.
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

      await mockWorkflowPersistence(page, WORKFLOW_ID)

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

      // `mode.a` is catalogued, so its named value is applied after `configure`.
      await expect(
        node.getByRole('spinbutton', { name: 'mode.a' })
      ).toHaveValue('91')

      // A later frame can carry a child before the selector that rebuilds
      // the group. The selector must run first so neither saved child value
      // is overwritten by the newly selected option's defaults.
      hostSocket.send(
        host.replaceDocumentWidgets(NODE_ID, [
          ['mode.a', 92],
          ['_extra_2', 72],
          ['mode', 'second']
        ])
      )
      await expect(node.getByText('second', { exact: true })).toBeVisible()
      await expect(
        node.getByRole('spinbutton', { name: 'mode.a' })
      ).toHaveValue('92')
      await expect(
        node.getByRole('spinbutton', { name: 'mode.b' })
      ).toHaveValue('72')
    })
  }
)
