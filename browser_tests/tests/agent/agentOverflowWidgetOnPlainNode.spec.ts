import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
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
import { emptyAgentThreadList } from '@e2e/fixtures/data/agent/agentThreadList'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * PM-2354: a node with NO dynamic combo whose live widget list is longer than
 * the pinned catalog's `widget_order`.
 *
 * The host mints a positional `_extra_N` alias for any `widgets_values` entry
 * past the end of the order, and it does so without asking whether the class
 * declares a dynamic combo — the catalog it decomposes against cannot say.
 * Resolution on this side used to ask, so every such value was dropped and
 * reported as `agent_graph_widget_missing`. In production that fired on
 * `JoinStringMulti`, `ImageCropV2`, `SAM3Segment`, `LoadImageOutput` and a
 * dozen more classes — none of them dynamic combos.
 *
 * The sibling spec `agentOverflowWidgetOnNodeCreate` covers the same alias on a
 * node that IS a dynamic combo, which is the case BE-16625 / FE #19979 fixed.
 *
 * PM-2354: https://linear.app/comfyorg/issue/PM-2354/sentry-alert-on-cloud-frontend-prod-node-2647-joinstringmulti-has-no
 * Sentry: https://comfy-org.sentry.io/issues/7813604885/
 */

const NODE_TYPE = 'TestCatalogShortPlainNode'
const NODE_ID = 2647
const WORKFLOW_ID = '6c1e9b7d-3a4f-4e2b-8c5d-9f0a1b2c3d4e'
const THREAD_ID = 'd8e9fa0b-1c2d-4e3f-9a4b-5c6d7e8f9a0b'
const MESSAGE_ID = 'a1b2c3d4-e5f6-4789-8a9b-0c1d2e3f4a5b'

function intSlider(value: number): InputSpec {
  return [
    'INT',
    { default: value, min: 0, max: 100, step: 1, display: 'slider' }
  ]
}

/**
 * Two ordinary widgets and no `COMFY_DYNAMICCOMBO_V3` input anywhere — the
 * shape of every class in the production family.
 */
const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
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

/**
 * The catalog names only the first widget, so the host stores the second
 * value under the positional alias `_extra_1`. This is what a pin that
 * predates the node's current widget list looks like.
 */
const catalog: WidgetCatalog = {
  types: { [NODE_TYPE]: { widget_order: ['known'] } }
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
      widgets_values: [11, 99]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

test.describe(
  'Agent document carrying an overflow widget on a node without a dynamic combo',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test('applies the overflow value the pinned catalog cannot name', async ({
      page
    }) => {
      test.setTimeout(60_000)

      await page.route('**/api/object_info', (route) =>
        route.fulfill(jsonRoute({ [NODE_TYPE]: nodeDef }))
      )

      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)
      await hostSocket.install()

      const threadList = emptyAgentThreadList()
      await page.route('**/api/agent/threads?*', (route) =>
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
        const composer = agentPanel.composer
        await composer.fill('hello')
        await panel.getByRole('button', { name: enMessages.agent.send }).click()
        await expect(panel.getByText('hello').first()).toBeVisible()
        hostSocket.send({
          type: 'agent_message_done',
          data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
        })
        await hostSocket.waitForSubscribe()
      })

      const node = vueNodes.getNodeLocator(String(NODE_ID))
      await expect(node).toBeVisible()

      await test.step('the catalog-named widget applies, as it always did', async () => {
        await expect(
          node.getByRole('spinbutton', { name: 'known' })
        ).toHaveValue('11')
      })

      await test.step('the aliased widget applies instead of being dropped', async () => {
        // Before the fix this showed the constructor default `20`: the alias
        // resolved to nothing and the value was reported as a missing widget.
        await expect(
          node.getByRole('spinbutton', { name: 'added_after_catalog' })
        ).toHaveValue('99')
      })

      await test.step('a later document frame updates it too', async () => {
        hostSocket.send(
          host.replaceDocumentWidgets(NODE_ID, [
            ['known', 12],
            ['_extra_1', 77]
          ])
        )
        await expect(
          node.getByRole('spinbutton', { name: 'known' })
        ).toHaveValue('12')
        await expect(
          node.getByRole('spinbutton', { name: 'added_after_catalog' })
        ).toHaveValue('77')
      })
    })
  }
)
