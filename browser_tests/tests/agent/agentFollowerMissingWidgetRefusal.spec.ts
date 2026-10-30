import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

/**
 * The refusal path for a widget the DOCUMENT addresses and the LIVE node does
 * not have, driven through the real follower. Production reaches it two ways
 * and both are covered here: a dotted name the node never carries, and a
 * positional `_extra_N` alias on a class with no dynamic-combo input.
 *
 * What the user must see is that nothing moves: the refusal leaves every
 * visible widget on its own value rather than writing the value onto whatever
 * widget happens to sit at that name's position, and the node stays usable —
 * a later legitimate write still lands on it.
 *
 * PM-2356: https://linear.app/comfyorg/issue/PM-2356/sentry-alert-on-cloud-frontend-prod-node-39-bytedance2referencenodev2
 * Carrier: https://github.com/Comfy-Org/ComfyUI_frontend/pull/22327
 */

const NODE_TYPE = 'TestMissingWidgetAddress'
const NODE_ID = 811
const KEPT_WIDGET = 'kept'
const OTHER_WIDGET = 'other'

const MARKER_TYPE = 'TestRefusalDeliveryMarker'
const DOTTED_MARKER_ID = 812
const OVERFLOW_MARKER_ID = 813

/** The production shape: a dotted address the live node never carries. */
const ABSENT_DOTTED_WIDGET = 'reference.image'
/** `_extra_1` resolves to nothing on a class with no dynamic-combo input. */
const ABSENT_OVERFLOW_ALIAS = '_extra_1'

const KEPT_VALUE = 'kept by the canvas'
/**
 * `other` is deliberately OUTSIDE the catalog's `widget_order`, so the
 * document never names it: that is what makes `_extra_1` a live misaddressing
 * risk rather than one the superseded-alias rule already covers. It therefore
 * shows its definition default, and must keep showing it.
 */
const OTHER_DEFAULT = 'left on its definition default'
const REFUSED_VALUE = 'must never be shown'
const LATER_VALUE = 'applied after the refusal'

const WORKFLOW_ID = '6b2d8e14-3f7a-4c95-8d20-5e6f7a8b9c01'
const THREAD_ID = '7c3e9f25-4a8b-4d06-9e31-6f708192a3b4'
const MESSAGE_ID = '8d4fa036-5b9c-4e17-8f42-70819203b4c5'

const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Test Missing Widget Address',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING'],
  input: {
    required: {
      [KEPT_WIDGET]: ['STRING', { default: 'definition default' }],
      [OTHER_WIDGET]: ['STRING', { default: OTHER_DEFAULT }]
    }
  },
  input_order: { required: [KEPT_WIDGET, OTHER_WIDGET] }
}

const markerDef: ComfyNodeDef = {
  name: MARKER_TYPE,
  display_name: 'Test Refusal Delivery Marker',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING'],
  input: {},
  input_order: {}
}

const catalog: WidgetCatalog = {
  types: {
    [NODE_TYPE]: { widget_order: [KEPT_WIDGET] },
    [MARKER_TYPE]: { widget_order: [] }
  }
}

/**
 * Follows a frame the canvas must not show. Frames arrive in order, so once
 * this renders the refused write ahead of it has already been handled.
 */
function deliveryBarrierAdd(nodeId: number): RecordedGraphOperation {
  return {
    op: 'add_node',
    node_id: nodeId,
    class_type: MARKER_TYPE,
    pos: [400, 0],
    node: {
      id: nodeId,
      type: MARKER_TYPE,
      pos: [400, 0],
      size: [200, 60],
      mode: 0,
      flags: {},
      order: 1,
      inputs: [],
      outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
      properties: {},
      widgets_values: []
    }
  }
}

const seed: WorkflowJSON = {
  nodes: [
    {
      id: NODE_ID,
      type: NODE_TYPE,
      pos: [0, 0],
      size: [270, 140],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
      properties: {},
      widgets_values: [KEPT_VALUE]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

test.describe(
  'Agent follower on a widget address the live node does not have',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test('refuses the write, leaves the visible values alone, and stays usable', async ({
      page
    }) => {
      test.setTimeout(90_000)

      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      const hostSocket = new AgentFollowerHostSocket(page, WORKFLOW_ID, host)
      await hostSocket.install()

      await bootAgentApp(page, true, {
        objectInfo: { [NODE_TYPE]: nodeDef, [MARKER_TYPE]: markerDef },
        settings: { 'Comfy.Graph.CanvasInfo': false },
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            thread_id: THREAD_ID,
            message_id: MESSAGE_ID,
            workflow_id: WORKFLOW_ID
          })
          await mockWorkflowPersistence(page, WORKFLOW_ID)
        }
      })

      // The refusal's own diagnostic, matched as a LITERAL at a word boundary:
      // `reportError` writes the `errorType` to the console in every
      // environment, so this is the product-owned signal that the frontend
      // really did refuse rather than quietly finding something to write to.
      const refusalReports: string[] = []
      page.on('console', (message) => {
        if (/\bagent_graph_widget_missing(?!\w)/.test(message.text()))
          refusalReports.push(message.text())
      })

      const vueNodes = new VueNodeHelpers(page)
      const agentPanel = new AgentPanel(page)

      await test.step('bind the workflow so the follower subscribes', async () => {
        await agentPanel.open()
        await agentPanel.selectWorkflow()
        await agentPanel.sendMessage('hello')
        await expect(agentPanel.root.getByText('hello').first()).toBeVisible()
        hostSocket.send({
          type: 'agent_message_done',
          data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
        })
        await hostSocket.waitForSubscribe()
      })

      const node = vueNodes.getNodeLocator(String(NODE_ID))
      await expect(node).toBeVisible()
      const keptInput = node.getByRole('textbox', { name: KEPT_WIDGET })
      const otherInput = node.getByRole('textbox', { name: OTHER_WIDGET })

      await test.step('the node starts on its own values', async () => {
        await expect(keptInput).toHaveValue(KEPT_VALUE)
        await expect(otherInput).toHaveValue(OTHER_DEFAULT)
        expect(refusalReports).toHaveLength(0)
      })

      await test.step('a dotted address the node does not carry changes nothing on the canvas', async () => {
        hostSocket.send(
          host.setDocumentWidget(NODE_ID, ABSENT_DOTTED_WIDGET, REFUSED_VALUE)
        )
        hostSocket.send(host.apply([deliveryBarrierAdd(DOTTED_MARKER_ID)]))

        await expect(
          vueNodes.getNodeLocator(String(DOTTED_MARKER_ID))
        ).toBeVisible()
        await expect(keptInput).toHaveValue(KEPT_VALUE)
        await expect(otherInput).toHaveValue(OTHER_DEFAULT)
        await expect(node.getByText(REFUSED_VALUE)).toHaveCount(0)
        await expect.poll(() => refusalReports).not.toHaveLength(0)
      })

      await test.step('and the refusal does not jam the node: a later legitimate write still lands', async () => {
        hostSocket.send(
          host.apply([
            {
              op: 'set_widget',
              node_id: NODE_ID,
              widget: KEPT_WIDGET,
              value: LATER_VALUE
            }
          ])
        )

        await expect(keptInput).toHaveValue(LATER_VALUE)
        await expect(otherInput).toHaveValue(OTHER_DEFAULT)
      })

      await test.step('a positional alias on a class with no dynamic combo is refused the same way', async () => {
        hostSocket.send(
          host.setDocumentWidget(NODE_ID, ABSENT_OVERFLOW_ALIAS, REFUSED_VALUE)
        )
        hostSocket.send(host.apply([deliveryBarrierAdd(OVERFLOW_MARKER_ID)]))

        await expect(
          vueNodes.getNodeLocator(String(OVERFLOW_MARKER_ID))
        ).toBeVisible()
        // `_extra_1` would address `other` if the class supported overflow. It
        // does not, so the alias must not be written onto that widget.
        await expect(otherInput).toHaveValue(OTHER_DEFAULT)
        await expect(keptInput).toHaveValue(LATER_VALUE)
        await expect(node.getByText(REFUSED_VALUE)).toHaveCount(0)
        await expect.poll(() => refusalReports.length).toBeGreaterThan(1)
      })
    })
  }
)
