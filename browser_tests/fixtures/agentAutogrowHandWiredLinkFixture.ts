import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { toNodeId } from '@/types/nodeId'

import {
  agentTest as test,
  bootAgentApp,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { loadSeedIntoActiveTab } from '@e2e/fixtures/utils/seedActiveTab'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * A hand-wired link on an autogrow node's spare slot survives a later agent
 * turn that reconnects a different slot in the same group.
 *
 * An autogrow group's spare slot is grown client-side
 * (`src/core/graph/widgets/dynamicWidgets.ts`) and the doc never hears about
 * it until something wires a link into it. A slot's link is tracked by array
 * INDEX in `linkStore` (`src/lib/litegraph/src/node/slotLinks.ts`), so any
 * remote apply that rewrites the node's `inputs` array from the doc's view
 * alone renames whichever slot the hand-wired link's index lands on. The
 * follower must therefore apply an agent `connect` through the node's own
 * graph API and leave slots the doc does not mention untouched.
 */

const GPT_IMAGE_NODE_TYPE = 'OpenAIGPTImageNodeV2'
const IMAGE_SOURCE_NODE_TYPE = 'TestImageSource'
const IMAGES_GROUP = 'model.images'
const IMAGE_1_NAME = `${IMAGES_GROUP}.image_1`
const IMAGE_2_NAME = `${IMAGES_GROUP}.image_2`
const IMAGE_3_NAME = `${IMAGES_GROUP}.image_3`

const SOURCE_A_ID = 1
const GPT_NODE_ID = 2
const SOURCE_HAND_ID = 3
const SOURCE_AGENT_ID = 4
const SEED_LINK_ID = 9001
const AGENT_RECONNECT_LINK_ID = 9004

const WORKFLOW_ID = '6a1c9f3e-4d2b-4a7c-8e1f-3b5d7c9a1f6b'
const THREAD_ID = 'c3d4e5f6-1a2b-4c3d-8e4f-5a6b7c8d9e0f'
const MESSAGE_ID = 'a1b2c3d4-5e6f-4a1b-8c2d-3e4f5a6b7c8d'
const SOCKET_SID = 'f1e2d3c4-b5a6-4978-8a9b-0c1d2e3f4a5b'

// Trimmed `/object_info` entries: a plain IMAGE source, and an API node whose
// only input is a `COMFY_AUTOGROW_V3` group named `model.images`, mirroring
// the real GPT Image 2.5 node's `model.images.image_N` slots (same shape as
// `agentAutogrowSpareInputFixture.ts`).
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
  input: { required: {} },
  input_order: { required: [] }
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
    [IMAGE_SOURCE_NODE_TYPE]: { widget_order: [] },
    [GPT_IMAGE_NODE_TYPE]: { widget_order: [] }
  }
}

// The doc's starting graph: one source wired into the autogrow node's first
// slot (mirroring an earlier agent turn), plus two more sources the test
// wires up later — one by hand on the live canvas, one by a second agent
// turn — both present from the start so a `connect` op can reference them
// without an `add_node` round trip.
const seed: WorkflowJSON = {
  nodes: [
    {
      id: SOURCE_A_ID,
      type: IMAGE_SOURCE_NODE_TYPE,
      pos: [0, 0],
      size: [210, 60],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [SEED_LINK_ID] }],
      properties: {},
      widgets_values: []
    },
    {
      id: GPT_NODE_ID,
      type: GPT_IMAGE_NODE_TYPE,
      pos: [400, 0],
      size: [300, 240],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [{ name: IMAGE_1_NAME, type: 'IMAGE', link: SEED_LINK_ID }],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
      properties: {},
      widgets_values: []
    },
    {
      id: SOURCE_HAND_ID,
      type: IMAGE_SOURCE_NODE_TYPE,
      pos: [0, 200],
      size: [210, 60],
      flags: {},
      order: 2,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
      properties: {},
      widgets_values: []
    },
    {
      id: SOURCE_AGENT_ID,
      type: IMAGE_SOURCE_NODE_TYPE,
      pos: [0, 400],
      size: [210, 60],
      flags: {},
      order: 3,
      mode: 0,
      inputs: [],
      outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [] }],
      properties: {},
      widgets_values: []
    }
  ],
  links: [[SEED_LINK_ID, SOURCE_A_ID, 0, GPT_NODE_ID, 0, 'IMAGE']],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

/** Autogrow input slots on the GPT node, in array order, with link origins. */
async function readImageInputs(page: Page) {
  return page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)
    if (!node) return []
    // `getInputLink` indexes the node's FULL `inputs` array, so the index
    // paired with it here must be that same unfiltered position, not the
    // position within the `model.images.`-only slice (`getConnectedInputs`
    // in `nodeInputLinks.ts` follows the same rule).
    return node.inputs.flatMap((input, index) => {
      if (!input.name.startsWith('model.images.')) return []
      const link = node.getInputLink(index)
      return [
        { name: input.name, originNodeId: link ? String(link.origin_id) : null }
      ]
    })
  }, toNodeId(GPT_NODE_ID))
}

async function setUpFixture(page: Page) {
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
  // 'apply' because the hand-wire step below mints a real `doc_ops` batch
  // over this socket (any `registerLinkTopology` placement does, canvas or
  // agent alike) — the host has to answer it like the relay does instead of
  // leaving the batch unacked.
  const hostSocket = new AgentFollowerHostSocket(
    page,
    WORKFLOW_ID,
    host,
    SOCKET_SID,
    'apply'
  )
  await hostSocket.install()
  await page.route('**/api/agent/threads', (route) =>
    route.fulfill(jsonRoute({ threads: [] }))
  )
  await page.route('**/api/agent/run-mode', (route) =>
    route.fulfill(jsonRoute({ mode: 'ask_approval', credit_limit: null }))
  )
  // The CRDT follower only binds a workflow once a real turn's ack
  // names one (`bindWorkflow(ack.workflow_id)` in `useAgentSession.ts`)
  // — picking a target from the switcher alone does not bind it.
  await page.route('**/api/agent/threads/*/messages', (route) => {
    if (route.request().method() !== 'POST') return route.fulfill(jsonRoute([]))
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
    // Only the Vue node renderer projects follower edits onto the
    // canvas as DOM nodes this test can query.
    settings: {
      'Comfy.VueNodes.Enabled': true,
      'Comfy.Graph.CanvasInfo': false
    }
  })

  // Registered only now, same as `AgentConversationHarness.
  // selectWorkflowTarget`: `bootAgentApp`'s own mocks blanket-match
  // `**/api/userdata**` for every method, and Playwright runs the
  // most-recently-registered matching route first, so this has to
  // come after it to take over the workflow-save round trip.
  await mockWorkflowPersistence(page, WORKFLOW_ID)

  const topbar = new Topbar(page)
  const vueNodes = new VueNodeHelpers(page)
  const gptNodeId = String(GPT_NODE_ID)
  const panel = page.locator('#agent-panel-root')

  await test.step('open the agent panel and target the workflow', async () => {
    await loadSeedIntoActiveTab(page, seed)
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

  await test.step('first agent turn binds the workflow and materializes the graph', async () => {
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

  await test.step('the autogrow group offers a free slot after the first connect', async () => {
    await expect(vueNodes.getNodeLocator(gptNodeId)).toBeVisible()
    await expect
      .poll(() => readImageInputs(page))
      .toEqual([
        { name: IMAGE_1_NAME, originNodeId: String(SOURCE_A_ID) },
        { name: IMAGE_2_NAME, originNodeId: null }
      ])
  })

  await test.step('the user hand-wires a source into the free slot on the live canvas', async () => {
    const freeIndex = await page.evaluate((id) => {
      const node = window.app!.graph.getNodeById(id)!
      return node.inputs.findIndex(
        (input, index) =>
          input.name.startsWith('model.images.') &&
          !node.isInputConnected(index)
      )
    }, toNodeId(GPT_NODE_ID))
    expect(freeIndex).toBeGreaterThanOrEqual(0)

    // The same runtime path a UI drag-connect takes (`LGraphNode.connect`
    // dispatches through `registerLinkTopology`, which the link mint port
    // listens to for every connect regardless of how it was made) — this is
    // the user wiring a source into the node without any agent involvement.
    await page.evaluate(
      ({ sourceId, targetId, targetSlot }) => {
        const graph = window.app!.graph
        const source = graph.getNodeById(sourceId)!
        const target = graph.getNodeById(targetId)!
        source.connect(0, target, targetSlot)
      },
      {
        sourceId: toNodeId(SOURCE_HAND_ID),
        targetId: toNodeId(GPT_NODE_ID),
        targetSlot: freeIndex
      }
    )
    // Settles only once the CRDT round trip (now acked by the host, per
    // `humanOpsHost: 'apply'` above) and autogrow's own client-side growth
    // have both landed on this freshly booted page — the same CI slowness
    // the subscribe wait above budgets for.
    await expect
      .poll(() => readImageInputs(page), { timeout: 20_000 })
      .toEqual([
        { name: IMAGE_1_NAME, originNodeId: String(SOURCE_A_ID) },
        { name: IMAGE_2_NAME, originNodeId: String(SOURCE_HAND_ID) },
        { name: IMAGE_3_NAME, originNodeId: null }
      ])
  })

  return {
    page,
    panel,
    vueNodes,
    topbar,
    gptNodeId,
    host,
    hostSocket,
    readImageInputs: () => readImageInputs(page)
  }
}

export type AutogrowHandWiredLinkContext = Awaited<
  ReturnType<typeof setUpFixture>
>

/**
 * Sends a second real chat message and, as that turn's response, reconnects
 * the group's first slot from a second source — an agent turn that touches
 * the same node again after the user's hand-wire, over the real composer's
 * Send button. Reconnecting the always-present first slot (rather than
 * growing a new one) keeps the group's shape ordinary — connected slots
 * first, one free spare at the tail — so the case under test is the plain
 * array merge, not autogrow's own reshaping of an unusual layout.
 */
async function sendSecondTurnAndReconnectFirstSlot(
  ctx: AutogrowHandWiredLinkContext
): Promise<void> {
  const { panel, hostSocket, host } = ctx
  const composer = panel.getByRole('textbox', { name: /^Describe ideas/ })
  await composer.fill('use a different reference image')
  await panel.getByRole('button', { name: enMessages.agent.send }).click()
  await expect(
    panel.getByText('use a different reference image').first()
  ).toBeVisible()

  hostSocket.send(
    host.apply([
      {
        op: 'connect',
        link_id: AGENT_RECONNECT_LINK_ID,
        from_node: SOURCE_AGENT_ID,
        from_slot: 0,
        to_node: GPT_NODE_ID,
        to_slot: 0,
        link_type: 'IMAGE'
      }
    ])
  )
  hostSocket.send({
    type: 'agent_message_done',
    data: { message_id: MESSAGE_ID, thread_id: THREAD_ID }
  })
  await expect(
    panel.getByRole('button', { name: enMessages.agent.stop })
  ).toHaveCount(0)
}

export const autogrowHandWiredLinkTest = test.extend<{
  autogrowHandWiredLink: AutogrowHandWiredLinkContext
}>({
  autogrowHandWiredLink: async ({ page }, use) => {
    await use(await setUpFixture(page))
  }
})

export {
  GPT_NODE_ID,
  IMAGE_1_NAME,
  IMAGE_2_NAME,
  IMAGE_3_NAME,
  SEED_LINK_ID,
  SOURCE_AGENT_ID,
  SOURCE_HAND_ID,
  sendSecondTurnAndReconnectFirstSlot
}
