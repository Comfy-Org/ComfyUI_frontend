import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { toNodeId } from '@/types/nodeId'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

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
      widgets_values: []
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

test.describe(
  'Agent CRDT autogrow node keeps a free slot across a tab switch',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    // Everything up to and including the tab switch, shared by both cases
    // below: they differ only in where they look for the free slot
    // afterwards - the graph, or the node the user is actually looking at.
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
      // The CRDT follower only binds a workflow once a real turn's ack
      // names one (`bindWorkflow(ack.workflow_id)` in `useAgentSession.ts`)
      // — picking a target from the switcher alone does not bind it.
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
      // most-recently-registered matching route first, so these have to
      // come after it to take over the workflow-save round trip.
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

      const topbar = new Topbar(page)
      const vueNodes = new VueNodeHelpers(page)
      const gptNodeId = String(GPT_NODE_ID)
      const panel = page.locator('#agent-panel-root')

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
        await expect
          .poll(() => subscribedTo, { timeout: 20_000 })
          .toBe(WORKFLOW_ID)
        socketSend!({
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
        await expect(
          topbar.workflowTabs.locator('.p-togglebutton')
        ).toHaveCount(1)
        await topbar.newWorkflowButton.click()
        await expect(
          topbar.workflowTabs.locator('.p-togglebutton')
        ).toHaveCount(2)
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
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
      return { vueNodes, gptNodeId, readImageSlots }
    }

    test('keeps a free autogrow input on the graph after the switch', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const { readImageSlots } = await wireAutogrowNodeAndSwitchTabs(page)
      await expect.poll(readImageSlots).toEqual([
        { name: IMAGE_1_NAME, connected: true },
        { name: IMAGE_2_NAME, connected: false }
      ])
    })

    test('still draws the free autogrow slot on the node after the switch', async ({
      page
    }) => {
      test.setTimeout(60_000)
      const { vueNodes, gptNodeId } = await wireAutogrowNodeAndSwitchTabs(page)
      await expect(vueNodes.getInputSlotRow(gptNodeId, 1)).toContainText(
        IMAGE_2_FRIENDLY_LABEL
      )
    })
  }
)
