import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { toNodeId } from '@/types/nodeId'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AGENT_SOCKET_URL } from '@e2e/fixtures/agentSocket'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { TestIds } from '@e2e/fixtures/selectors'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * A node with an "autogrow"
 * (dynamic/variadic) input group — e.g. the GPT Image 2.5 node's
 * `model.images.image_1/2/3...` slots — loses its category color and shows
 * the raw internal dotted input name instead of the short friendly label
 * once the tab is switched away and back after the in-app agent has wired
 * something into one of those inputs over the CRDT graph-mutation layer.
 *
 * Root cause: `assignNodeFields` in `src/stores/nodeDataStore.ts` (called
 * from `updateNode`) unconditionally resets `color`/`bgcolor` and replaces
 * `state.inputs` wholesale from the CRDT payload. The CRDT document never
 * carries node color (set client-side only, in `ComfyNode`'s constructor)
 * or the autogrow-computed `localized_name` (computed client-side in
 * `src/core/graph/widgets/dynamicWidgets.ts`), so both survive only as long
 * as nothing re-derives the node from the document. A tab return
 * re-subscribes the CRDT follower (`useAgentCrdtFollower.ts`), which binds a
 * fresh follower session and replays the whole document as one `doc_update`
 * over the live nodes the store already knows about — the first time that
 * happens is harmless (a brand-new node record), but a node the store already
 * holds is reconciled in place, wiping color and the autogrow label with it.
 * See `agentTabSwitchCatchUp.spec.ts` for that same replay mechanism
 * exercised on plain nodes, where the loss isn't visible because they have no
 * client-only color or autogrow label to lose.
 *
 * Fixed in `graphMutations.ts`'s `prepareNode`/`prepareInputSlots`: a
 * reconcile now keeps the live node's color when the payload omits it, and
 * keeps an existing input slot's `localized_name`/`label` when the payload's
 * slot at the same index and name doesn't carry one.
 */

const GPT_IMAGE_NODE_TYPE = 'OpenAIGPTImageNodeV2'
const IMAGE_SOURCE_NODE_TYPE = 'TestImageSource'
const IMAGES_GROUP = 'model.images'
const IMAGE_1_NAME = `${IMAGES_GROUP}.image_1`
const IMAGE_1_FRIENDLY_LABEL = 'image_1'

const SOURCE_NODE_ID = 1
const GPT_NODE_ID = 2
const LINK_ID = 9001

const WORKFLOW_ID = '2f1a9b4e-3c7d-4e9a-9a1e-1c2d3e4f5a6b'
const THREAD_ID = 'b1c9a7d2-5e4f-4a3b-9c1d-6e7f8a9b0c1d'
const MESSAGE_ID = 'd4e5f6a7-8b9c-4d0e-9f1a-2b3c4d5e6f7a'

// API nodes are marked yellow client-side (litegraphService.ts) so users can
// spot them at a glance; the CRDT document carries neither this value.
const API_NODE_COLOR = { color: '#432', bgcolor: '#653' }

// Trimmed `/object_info` entries: a plain IMAGE source, and an API node whose
// only input is a `COMFY_AUTOGROW_V3` group named `model.images` directly (no
// `COMFY_DYNAMICCOMBO_V3` wrapper needed — `addInputSocket` dispatches any
// top-level input of this type to `applyAutogrow` regardless of nesting),
// mirroring the real GPT Image 2.5 node's `model.images.image_N` slots.
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
// image source wired into the GPT Image node's one autogrow slot. Baking the
// wire into the seed (rather than sending a separate `connect` op) puts it
// through the same first-ever materialization every node on a freshly
// subscribed document goes through — the one that correctly preserves color
// and the autogrow label — so the only reconcile this test exercises is the
// tab-switch one under test.
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
  'Agent CRDT autogrow node survives a tab switch',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('keeps the API node color and the autogrow input label after switching tabs away and back', async ({
      page
    }) => {
      test.setTimeout(60_000)

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
      await page.routeWebSocket(AGENT_SOCKET_URL, (socket) => {
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
      // come after it to take over the workflow-save round trip. Picking
      // "Unsaved Workflow" from the switcher silently saves it first, and
      // the workflow list must then report it back under `WORKFLOW_ID` for
      // the agent session to bind to it.
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
        // The CRDT follower subscribes once the turn's ack binds this
        // workflow (`bindWorkflow` in `useAgentSession.ts`).
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

      const readNodeColor = () =>
        page.evaluate((id) => {
          const node = window.app!.graph.getNodeById(id)
          return { color: node?.color, bgcolor: node?.bgcolor }
        }, toNodeId(GPT_NODE_ID))

      await test.step('the wired node renders correctly beforehand', async () => {
        await expect(vueNodes.getNodeLocator(gptNodeId)).toBeVisible()
        await expect(vueNodes.getInputSlotRow(gptNodeId, 0)).toContainText(
          IMAGE_1_FRIENDLY_LABEL
        )
        await expect.poll(() => readNodeColor()).toEqual(API_NODE_COLOR)
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

      await test.step('the node still shows its API-node color and friendly label', async () => {
        await expect.poll(() => readNodeColor()).toEqual(API_NODE_COLOR)
        await expect(vueNodes.getInputSlotRow(gptNodeId, 0)).not.toContainText(
          IMAGE_1_NAME
        )
        await expect(vueNodes.getInputSlotRow(gptNodeId, 0)).toContainText(
          IMAGE_1_FRIENDLY_LABEL
        )
        await page
          .getByRole('button', {
            name: enMessages.agent.entryButton,
            exact: true
          })
          .click()
        await expect(panel).toBeHidden()
        await page.getByTestId(TestIds.canvas.zoomControlsButton).click()
        await page.getByTestId(TestIds.canvas.zoomToFitAction).click()
        await page.keyboard.press('Escape')
        await expect(vueNodes.getNodeLocator(gptNodeId)).toBeInViewport({
          ratio: 1
        })
        await test.info().attach('reconciled-node', {
          body: await page.screenshot(),
          contentType: 'image/png'
        })
      })
    })
  }
)
