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
 * A node whose CLASS carries a repeated widget name, driven through the real
 * follower: the document holds one register per occurrence, the frontend can
 * hold only one widget under a name, and the follower must address the
 * register belonging to the widget it kept and refuse the other rather than
 * misaddress it. FE-3036.
 */

const NODE_TYPE = 'TestRepeatedWidgetNameNode'
const NODE_ID = 701
const WIDGET_NAME = 'dup'

const MARKER_TYPE = 'TestDeliveryMarkerNode'
const MARKER_WRITE_NODE_ID = 702
const MARKER_MISSED_NODE_ID = 703

const FIRST_OCCURRENCE_VALUE = 'first occurrence'
const SECOND_OCCURRENCE_VALUE = 'second occurrence'
const SECOND_OCCURRENCE_REWRITE = 'rewritten second occurrence'
const SECOND_OCCURRENCE_MISSED = 'missed second occurrence'
const TYPED_VALUE = 'typed by the user'

const WORKFLOW_ID = '2d9f5a71-4c3b-4e8d-9a06-7b1c2d3e4f50'
const THREAD_ID = '3e0a6b82-5d4c-4f9e-8b17-8c2d3e4f5a61'
const MESSAGE_ID = '4f1b7c93-6e5d-4a0f-9c28-9d3e4f5a6b72'
const SOCKET_SID = '5a2c8d04-7f6e-4b10-8d39-0e4f5a6b7c83'

const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Test Repeated Widget Name Node',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['STRING'],
  output_is_list: [false],
  output_name: ['STRING'],
  input: {
    required: {
      [WIDGET_NAME]: ['STRING', { default: 'definition default' }]
    }
  },
  input_order: { required: [WIDGET_NAME] }
}

const markerDef: ComfyNodeDef = {
  name: MARKER_TYPE,
  display_name: 'Test Delivery Marker Node',
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
    [NODE_TYPE]: { widget_order: [WIDGET_NAME, WIDGET_NAME] },
    [MARKER_TYPE]: { widget_order: [] }
  }
}

/**
 * Rides a batch behind a write the canvas must not show. Frames arrive in
 * order, so once it renders the write ahead of it has been applied.
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

function widgetsUnderTest(host: HostDoc) {
  return host.projection().nodes.find((node) => node.id === NODE_ID)
    ?.widgets_values
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
      outputs: [{ name: 'STRING', type: 'STRING', links: [] }],
      properties: {},
      widgets_values: [FIRST_OCCURRENCE_VALUE, SECOND_OCCURRENCE_VALUE]
    }
  ],
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

/**
 * Redefines `name` on the concrete widget so it cannot be renamed. A frozen
 * object passed to `addWidget` does not work: the widget class's own writable
 * accessor wins. Patched on the TYPE, because the node under test is built by
 * the follower from the document rather than by the test.
 */
async function pinASecondWidgetUnderTheSameName(
  page: Parameters<typeof bootAgentApp>[0]
): Promise<void> {
  await page.waitForFunction(
    (nodeTypeName) =>
      window.LiteGraph?.registered_node_types[nodeTypeName]?.prototype !==
      undefined,
    NODE_TYPE,
    { timeout: 15_000 }
  )
  await page.evaluate(
    ({ nodeTypeName, widgetName }) => {
      const nodeType = window.LiteGraph!.registered_node_types[nodeTypeName]
      const onNodeCreated = nodeType.prototype.onNodeCreated
      nodeType.prototype.onNodeCreated = function (...args) {
        onNodeCreated?.apply(this, args)
        this.serialize_widgets = true
        const second = this.addWidget(
          'string',
          'second',
          'second default',
          () => {}
        )
        Object.defineProperty(second, 'name', {
          value: widgetName,
          writable: false,
          configurable: false
        })
      }
    },
    { nodeTypeName: NODE_TYPE, widgetName: WIDGET_NAME }
  )
}

test.describe(
  'Agent follower on a class whose catalog repeats a widget name',
  { tag: ['@cloud', '@agent', '@vue-nodes', '@widget'] },
  () => {
    test('addresses the occurrence it kept and refuses the one it cannot', async ({
      page
    }) => {
      test.setTimeout(90_000)

      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        SOCKET_SID,
        // The human's own edit must reach the document through the real
        // applier, not be held: the last step asserts what the document kept.
        'apply'
      )
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

      // Patch before the follower builds the node from the document.
      await pinASecondWidgetUnderTheSameName(page)

      // The refusal's own diagnostic, matched as a LITERAL at a word boundary:
      // `reportError` writes the `errorType` to the console in every
      // environment, so this is the product-owned signal that the node really
      // did arrive ambiguous.
      const refusalReports: string[] = []
      page.on('console', (message) => {
        if (
          /\bfailure_renaming_widget_duplicate_name(?!\w)/.test(message.text())
        )
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
      const duplicateInputs = node.getByRole('textbox', { name: WIDGET_NAME })

      await test.step('the node is usable: one widget under the name, not none and not two', async () => {
        await expect(duplicateInputs).toHaveCount(1)
        await expect.poll(() => refusalReports).not.toHaveLength(0)
      })

      await test.step('the kept widget shows ITS OWN occurrence, not the other one', async () => {
        await expect(duplicateInputs).toHaveValue(FIRST_OCCURRENCE_VALUE)
      })

      await test.step('a write aimed at the occurrence the frontend refused is not misaddressed onto the one it kept', async () => {
        hostSocket.send(
          host.apply([
            {
              op: 'set_widget',
              node_id: NODE_ID,
              widget: WIDGET_NAME,
              widget_occurrence: 1,
              value: SECOND_OCCURRENCE_REWRITE
            },
            deliveryBarrierAdd(MARKER_WRITE_NODE_ID)
          ])
        )

        await expect(
          vueNodes.getNodeLocator(String(MARKER_WRITE_NODE_ID))
        ).toBeVisible()
        await expect(duplicateInputs).toHaveValue(FIRST_OCCURRENCE_VALUE)
      })

      await test.step("the user's own edit reaches the document on the register that belongs to it", async () => {
        await duplicateInputs.fill(TYPED_VALUE)
        await duplicateInputs.blur()

        await expect
          .poll(() => hostSocket.humanOpOutcomes(), { timeout: 15_000 })
          .toEqual([expect.objectContaining({ outcome: 'applied' })])

        // Lossless on both of the DOCUMENT's registers: the typed value claims
        // occurrence 0 and the register the frontend cannot address is left
        // intact rather than clobbered.
        await expect
          .poll(() => widgetsUnderTest(host))
          .toEqual([TYPED_VALUE, SECOND_OCCURRENCE_REWRITE])
      })

      await test.step('and a missed delta carrying the unaddressable occurrence does not clobber it on resubscribe', async () => {
        // Applied on the host and not broadcast, so only the resubscribe
        // catch-up can deliver it.
        host.apply([
          {
            op: 'set_widget',
            node_id: NODE_ID,
            widget: WIDGET_NAME,
            widget_occurrence: 1,
            value: SECOND_OCCURRENCE_MISSED
          },
          deliveryBarrierAdd(MARKER_MISSED_NODE_ID)
        ])

        await hostSocket.disconnect()

        await expect(
          vueNodes.getNodeLocator(String(MARKER_MISSED_NODE_ID))
        ).toBeVisible({ timeout: 30_000 })
        await expect
          .poll(() => widgetsUnderTest(host))
          .toEqual([TYPED_VALUE, SECOND_OCCURRENCE_MISSED])
        await expect(duplicateInputs).toHaveValue(TYPED_VALUE)
      })
    })
  }
)
