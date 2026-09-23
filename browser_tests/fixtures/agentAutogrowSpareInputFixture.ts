import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest as test,
  bootAgentApp,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { toNodeId } from '@/types/nodeId'

/**
 * A node with an "autogrow" (dynamic/variadic) input group — e.g. the GPT
 * Image 2.5 node's `model.images.image_1/2/3...` slots — loses the spare,
 * unconnected slot at the tail of that group once the tab is switched away
 * and back after the in-app agent has wired something into the group over
 * the CRDT graph-mutation layer. The user is left with a node whose only
 * image slot is already taken and no visible way to add a second image; the
 * reported symptom (PM-1155) is a wire that appears to land on the wrong
 * widget, because the slot the user expected to be free is gone.
 *
 * Root cause: the spare slot is computed client-side by
 * `src/core/graph/widgets/dynamicWidgets.ts` when an autogrow input is
 * connected, and the CRDT document never carries it. A tab return
 * re-subscribes the follower and replays the document over the live nodes,
 * and `reconcile()` in `agentNodeMaterializer.ts` used to `continue` past
 * any live node the agent scope already owns — so the payload's input list
 * won, and the client-only spare was dropped.
 *
 * Fixed in #18127 (`3c202143e2`): `reconcile()` now calls
 * `reconcileAutogrowInputs(live)` for exactly those already-owned live
 * nodes, which re-runs the existing growth path for each autogrow group
 * whose last connected slot has no spare behind it. That fix shipped with
 * unit cover only.
 *
 * Sibling case: `agentAutogrowTabSwitchReconcile.spec.ts` drives the same
 * seed and the same tab switch, and asserts the surviving slot's color and
 * friendly label (#18081). This one asserts the slot that has to be there
 * *next to* it.
 */

const GPT_IMAGE_NODE_TYPE = 'OpenAIGPTImageNodeV2'
const IMAGE_SOURCE_NODE_TYPE = 'TestImageSource'
const IMAGES_GROUP = 'model.images'
const IMAGE_1_NAME = `${IMAGES_GROUP}.image_1`
const IMAGE_2_NAME = `${IMAGES_GROUP}.image_2`
const IMAGE_2_FRIENDLY_LABEL = 'image_2'
const MARKER_WIDGET = 'marker'
const CATCH_UP_MARKER = 'tab return catch-up landed'

const SOURCE_NODE_ID = 1
const GPT_NODE_ID = 2
const LINK_ID = 9001

const WORKFLOW_ID = '2f1a9b4e-3c7d-4e9a-9a1e-1c2d3e4f5a6b'
const THREAD_ID = 'b1c9a7d2-5e4f-4a3b-9c1d-6e7f8a9b0c1d'
const MESSAGE_ID = 'd4e5f6a7-8b9c-4d0e-9f1a-2b3c4d5e6f7a'

// Trimmed `/object_info` entries: a plain IMAGE source, and an API node whose
// only input is a `COMFY_AUTOGROW_V3` group named `model.images`, mirroring
// the real GPT Image 2.5 node's `model.images.image_N` slots.
const imageSourceNodeDef: ComfyNodeDef = {
  name: IMAGE_SOURCE_NODE_TYPE,
  display_name: 'Test Image Source',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['IMAGE'],
  output_is_list: [false],
  output_name: ['IMAGE'],
  input: {
    required: { [MARKER_WIDGET]: ['STRING', { default: 'before tab switch' }] }
  },
  input_order: { required: [MARKER_WIDGET] }
}

const gptImageNodeDef: ComfyNodeDef = {
  name: GPT_IMAGE_NODE_TYPE,
  display_name: 'GPT Image 2.5',
  description: '',
  category: 'api node/image/OpenAI',
  python_module: 'comfy_api_nodes.nodes_openai',
  output_node: false,
  api_node: true,
  output: ['IMAGE'],
  output_is_list: [false],
  output_name: ['IMAGE'],
  input: {
    required: {
      [IMAGES_GROUP]: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: { required: { image: ['IMAGE', {}] } },
            names: ['image_1', 'image_2', 'image_3', 'image_4'],
            min: 0
          }
        }
      ]
    }
  },
  input_order: { required: [IMAGES_GROUP] }
}

const catalog: WidgetCatalog = {
  types: {
    [IMAGE_SOURCE_NODE_TYPE]: { widget_order: [MARKER_WIDGET] },
    [GPT_IMAGE_NODE_TYPE]: { widget_order: [] }
  }
}

// The graph an in-app agent conversation already left on the canvas: an
// image source wired into the GPT Image node's one autogrow slot. The
// document carries that one slot only — the spare is the client's, which is
// the whole point of the case.
const seed: WorkflowJSON = {
  nodes: [
    {
      id: SOURCE_NODE_ID,
      type: IMAGE_SOURCE_NODE_TYPE,
      pos: [0, 0],
      size: [210, 60],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [LINK_ID] }],
      properties: {},
      widgets_values: ['before tab switch']
    },
    {
      id: GPT_NODE_ID,
      type: GPT_IMAGE_NODE_TYPE,
      pos: [400, 0],
      size: [300, 200],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [{ name: IMAGE_1_NAME, type: 'IMAGE', link: LINK_ID }],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
      properties: {},
      widgets_values: []
    }
  ],
  links: [[LINK_ID, SOURCE_NODE_ID, 0, GPT_NODE_ID, 0, 'IMAGE']],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

async function wireAutogrowNodeAndSwitchTabs(page: Page) {
  // `objectInfo: 'server'` (passed to `bootAgentApp` below) stops
  // `mockCloudBootRoutes` from also registering an (empty) handler for
  // this route — Playwright runs the most-recently-registered handler
  // first, so a route added here after that call would never fire.
  await page.route('**/api/object_info', (route) =>
    route.fulfill(
      jsonRoute({
        [IMAGE_SOURCE_NODE_TYPE]: imageSourceNodeDef,
        [GPT_IMAGE_NODE_TYPE]: gptImageNodeDef
      })
    )
  )

  const host = new HostDoc(WORKFLOW_ID, seed, catalog)
  const hostSocket = new AgentFollowerHostSocket(
    page,
    WORKFLOW_ID,
    host,
    'autogrow-e2e'
  )
  await hostSocket.install()

  await bootAgentApp(page, true, {
    objectInfo: 'server',
    settings: {
      'Comfy.Graph.CanvasInfo': false
    },
    beforeNavigate: async (page) => {
      // Selecting the target does not itself bind the follower, so the
      // mocked acknowledgement supplies the seeded workflow id.
      await mockAgentTurnApi(page, {
        thread_id: THREAD_ID,
        message_id: MESSAGE_ID,
        workflow_id: WORKFLOW_ID
      })
      await mockWorkflowPersistence(page, WORKFLOW_ID)
    }
  })

  const topbar = new Topbar(page)
  const vueNodes = new VueNodeHelpers(page)
  const agentPanel = new AgentPanel(page)
  const gptNodeId = String(GPT_NODE_ID)
  const panel = agentPanel.root

  // The user-facing question this whole case asks: "can I still wire a
  // second image into this node?" — which is a free slot in the
  // `model.images` group, named and unconnected.
  const readImageSlots = () =>
    page.evaluate((id) => {
      const node = window.app!.graph.getNodeById(id)
      return (node?.inputs ?? [])
        .filter((input) => input.name.startsWith('model.images.'))
        .map((input, index) => ({
          name: input.name,
          connected: node!.getInputLink(index) !== null
        }))
    }, toNodeId(GPT_NODE_ID))
  const readNodeColor = () =>
    page.evaluate((id) => {
      const node = window.app!.graph.getNodeById(id)
      return { color: node?.color, bgcolor: node?.bgcolor }
    }, toNodeId(GPT_NODE_ID))
  const readMarker = () =>
    page.evaluate(
      ({ id, widget }) =>
        window
          .app!.graph.getNodeById(id)
          ?.widgets?.find(({ name }) => name === widget)?.value,
      { id: toNodeId(SOURCE_NODE_ID), widget: MARKER_WIDGET }
    )

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
    await hostSocket.waitForSubscribe()
    hostSocket.send({
      type: 'agent_message_done',
      data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
    })
    await expect(
      panel.getByRole('button', { name: enMessages.agent.stop })
    ).toHaveCount(0)
  })

  await test.step('the wired node offers a free image slot beforehand', async () => {
    await expect(vueNodes.getNodeLocator(gptNodeId)).toBeVisible()
    await expect.poll(readImageSlots).toEqual([
      { name: IMAGE_1_NAME, connected: true },
      { name: IMAGE_2_NAME, connected: false }
    ])
    await expect(vueNodes.getInputSlotRow(gptNodeId, 1)).toContainText(
      IMAGE_2_FRIENDLY_LABEL
    )
  })

  await test.step('user switches to a new tab and back', async () => {
    await expect(topbar.workflowTabs.locator('.p-togglebutton')).toHaveCount(1)
    await topbar.newWorkflowButton.click()
    await expect(topbar.workflowTabs.locator('.p-togglebutton')).toHaveCount(2)
    const subscribes = hostSocket.subscribeCount()
    await topbar.getTab(0).click()
    await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
    await expect.poll(() => hostSocket.subscribeCount()).toBe(subscribes + 1)
    hostSocket.send(
      host.apply([
        {
          op: 'set_widget',
          node_id: SOURCE_NODE_ID,
          widget: MARKER_WIDGET,
          value: CATCH_UP_MARKER
        }
      ])
    )
    await expect.poll(readMarker).toBe(CATCH_UP_MARKER)
    await expect.poll(readImageSlots).toEqual([
      { name: IMAGE_1_NAME, connected: true },
      { name: IMAGE_2_NAME, connected: false }
    ])
  })

  await page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)!
    const canvas = window.app!.canvas
    canvas.ds.fitToBounds(node.boundingRect, { zoom: 0.5 })
    canvas.setDirty(true, true)
  }, toNodeId(GPT_NODE_ID))
  await nextFrame(page)
  await expect(vueNodes.getNodeLocator(gptNodeId)).toBeInViewport({
    ratio: 1
  })
  await test.info().attach('after-tab-switch', {
    body: await vueNodes.getNodeLocator(gptNodeId).screenshot(),
    contentType: 'image/png'
  })
  return { page, panel, vueNodes, gptNodeId, readImageSlots, readNodeColor }
}

export const autogrowTest = test.extend<{
  autogrow: Awaited<ReturnType<typeof wireAutogrowNodeAndSwitchTabs>>
}>({
  autogrow: async ({ page }, use) => {
    await use(await wireAutogrowNodeAndSwitchTabs(page))
  }
})
