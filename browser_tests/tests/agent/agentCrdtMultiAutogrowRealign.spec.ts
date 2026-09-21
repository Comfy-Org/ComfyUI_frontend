import { expect } from '@playwright/test'

import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { toLinkId } from '@/types/linkId'

import {
  agentTest as test,
  bootAgentApp
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

/**
 * A node with two independent COMFY_AUTOGROW_V3 groups (reduced from
 * MiniMaxH3ReferenceToVideo's `ref_images`/`ref_videos` shape) had its links
 * silently re-target to the wrong input once both groups had already grown
 * on a saved graph -- e.g. a MiniMax-style template reaching disk with two
 * live groups whose growth interleaved as they were wired up.
 *
 * Root cause: the CRDT follower materialized an agent-authored node by
 * building link adapters against the saved DOCUMENT's input positions.
 * `node.configure()` and COMFY_AUTOGROW_V3 growth reorder LIVE inputs as
 * the node is built, so with two or more autogrow groups sharing a node,
 * the adapters kept pointing at stale indexes: a link painted on the wrong
 * socket, and the value read at submit time was wrong for the same reason.
 *
 * Fixed in `graphMutations.ts`'s `mergeInputSlotsByName`/`prepareNode`: a
 * reconcile now resolves each saved link's destination by the input's NAME
 * against the live node, not by the document's position, so live order wins
 * regardless of how many autogrow groups reordered it.
 *
 * Mirrors the Vitest regression in
 * `agentNodeMaterializer.multiAutogrow.test.ts` (same interleaved shape),
 * but drives the real CRDT follower over a mocked `/ws` socket and reads the
 * painted result off the live canvas, the way a user would see it -- once
 * right after the workflow is subscribed, and again after a tab switch
 * forces the follower to resubscribe and reconcile the same node in place
 * (see `agentAutogrowTabSwitchReconcile.spec.ts` for that same replay
 * mechanism, and its note that a node the store already holds -- unlike a
 * brand new one -- is reconciled rather than freshly added).
 */

const NODE_TYPE = 'TestMultiAutogrowRealign'
const SOURCE_NODE_TYPE = 'TestMultiAutogrowRealignSource'

const SOURCE_NODE_ID = 1
const TARGET_NODE_ID = 2
const TARGET_ID = String(TARGET_NODE_ID)

const WORKFLOW_ID = '4c1e9f2a-6b3d-4a7e-8f01-2c3d4e5f6a7b'
const THREAD_ID = 'a2b3c4d5-6e7f-4a8b-9c0d-1e2f3a4b5c6d'
const MESSAGE_ID = 'f1e2d3c4-b5a6-4978-8c6d-5e4f3a2b1c0d'

// Link ids, one per wire in the saved graph below.
const IMG0_LINK = 201
const IMG1_LINK = 202
const VID0_LINK = 203
const VID1_LINK = 204
const PROMPT_LINK = 205
const WIDTH_LINK = 206
const HEIGHT_LINK = 207

const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Test Multi Autogrow Realign',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: [],
  output_is_list: [],
  output_name: [],
  input: {
    required: {
      prompt: ['STRING', { multiline: true }],
      width: ['INT', { default: 640 }],
      height: ['INT', { default: 480 }]
    },
    optional: {
      ref_images: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: { required: { ref_image: ['IMAGE', {}] } },
            prefix: 'ref_image_',
            min: 0,
            max: 4
          }
        }
      ],
      ref_videos: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: { required: { ref_video: ['VIDEO', {}] } },
            prefix: 'ref_video_',
            min: 0,
            max: 4
          }
        }
      ]
    }
  },
  input_order: {
    required: ['prompt', 'width', 'height'],
    optional: ['ref_images', 'ref_videos']
  }
}

const sourceNodeDef: ComfyNodeDef = {
  name: SOURCE_NODE_TYPE,
  display_name: 'Test Multi Autogrow Realign Source',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['IMAGE', 'IMAGE', 'VIDEO', 'VIDEO', 'STRING', 'INT', 'INT'],
  output_is_list: [false, false, false, false, false, false, false],
  output_name: [
    'ref_image_0',
    'ref_image_1',
    'ref_video_0',
    'ref_video_1',
    'prompt',
    'width',
    'height'
  ],
  input: { required: {} },
  input_order: { required: [] }
}

const catalog: WidgetCatalog = {
  types: {
    [SOURCE_NODE_TYPE]: { widget_order: [] },
    [NODE_TYPE]: { widget_order: ['prompt', 'width', 'height'] }
  }
}

// The shape a saved MiniMax-style template reaches disk in: two autogrow
// groups (ref_images, ref_videos) both already grown to two slots -- the
// last of each still spare -- interleaved with the scalar widgets that come
// after them. Every named link below must survive materialization landing
// on the input it names, not on whichever input the document happens to
// have at that position.
const seed: WorkflowJSON = {
  nodes: [
    {
      id: SOURCE_NODE_ID,
      type: SOURCE_NODE_TYPE,
      pos: [0, 0],
      size: [220, 260],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [
        { name: 'ref_image_0', type: 'IMAGE', links: [IMG0_LINK] },
        { name: 'ref_image_1', type: 'IMAGE', links: [IMG1_LINK] },
        { name: 'ref_video_0', type: 'VIDEO', links: [VID0_LINK] },
        { name: 'ref_video_1', type: 'VIDEO', links: [VID1_LINK] },
        { name: 'prompt', type: 'STRING', links: [PROMPT_LINK] },
        { name: 'width', type: 'INT', links: [WIDTH_LINK] },
        { name: 'height', type: 'INT', links: [HEIGHT_LINK] }
      ],
      properties: {},
      widgets_values: []
    },
    {
      id: TARGET_NODE_ID,
      type: NODE_TYPE,
      pos: [400, 0],
      size: [320, 320],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [
        { name: 'ref_images.ref_image_0', type: 'IMAGE', link: IMG0_LINK },
        { name: 'ref_images.ref_image_1', type: 'IMAGE', link: IMG1_LINK },
        { name: 'ref_images.ref_image_2', type: 'IMAGE', link: null },
        { name: 'ref_videos.ref_video_0', type: 'VIDEO', link: VID0_LINK },
        { name: 'ref_videos.ref_video_1', type: 'VIDEO', link: VID1_LINK },
        { name: 'ref_videos.ref_video_2', type: 'VIDEO', link: null },
        {
          name: 'prompt',
          type: 'STRING',
          widget: { name: 'prompt' },
          link: PROMPT_LINK
        },
        {
          name: 'width',
          type: 'INT',
          widget: { name: 'width' },
          link: WIDTH_LINK
        },
        {
          name: 'height',
          type: 'INT',
          widget: { name: 'height' },
          link: HEIGHT_LINK
        }
      ],
      outputs: [],
      properties: {},
      widgets_values: ['', 640, 480]
    }
  ],
  links: [
    [IMG0_LINK, SOURCE_NODE_ID, 0, TARGET_NODE_ID, 0, 'IMAGE'],
    [IMG1_LINK, SOURCE_NODE_ID, 1, TARGET_NODE_ID, 1, 'IMAGE'],
    [VID0_LINK, SOURCE_NODE_ID, 2, TARGET_NODE_ID, 3, 'VIDEO'],
    [VID1_LINK, SOURCE_NODE_ID, 3, TARGET_NODE_ID, 4, 'VIDEO'],
    [PROMPT_LINK, SOURCE_NODE_ID, 4, TARGET_NODE_ID, 6, 'STRING'],
    [WIDTH_LINK, SOURCE_NODE_ID, 5, TARGET_NODE_ID, 7, 'INT'],
    [HEIGHT_LINK, SOURCE_NODE_ID, 6, TARGET_NODE_ID, 8, 'INT']
  ],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

// Every saved link, and the input name it must still terminate on -- the
// two interleaved autogrow groups' grown-and-linked slots, plus the scalar
// widgets that follow them.
const EXPECTED_TARGETS: readonly { linkId: number; name: string }[] = [
  { linkId: IMG0_LINK, name: 'ref_images.ref_image_0' },
  { linkId: IMG1_LINK, name: 'ref_images.ref_image_1' },
  { linkId: VID0_LINK, name: 'ref_videos.ref_video_0' },
  { linkId: VID1_LINK, name: 'ref_videos.ref_video_1' },
  { linkId: PROMPT_LINK, name: 'prompt' },
  { linkId: WIDTH_LINK, name: 'width' },
  { linkId: HEIGHT_LINK, name: 'height' }
]

// The two socket-only slots each group keeps spare after its grown, linked
// ones -- these render a real `.lg-slot--input` row this test can check is
// NOT connected, unlike the widget-backed scalars.
const SPARE_SLOTS: readonly { index: number; name: string }[] = [
  { index: 2, name: 'ref_images.ref_image_2' },
  { index: 5, name: 'ref_videos.ref_video_2' }
]

// Socket-only slots (the autogrow groups), by their live index, so the test
// can check the connected DOM class a widget-backed scalar never renders.
const CONNECTED_SOCKET_SLOTS: readonly { index: number; linkId: number }[] = [
  { index: 0, linkId: IMG0_LINK },
  { index: 1, linkId: IMG1_LINK },
  { index: 3, linkId: VID0_LINK },
  { index: 4, linkId: VID1_LINK }
]

test.describe(
  'Agent CRDT multi-autogrow link realignment',
  { tag: ['@cloud', '@agent'] },
  () => {
    test('keeps every link on its named slot across two interleaved autogrow groups, before and after a reconcile', async ({
      page
    }) => {
      test.setTimeout(60_000)

      // Registered before `bootAgentApp` (with `objectInfo: 'server'` below)
      // so it wins over the empty handler `mockCloudBootRoutes` would
      // otherwise register afterward for the same route -- Playwright runs
      // the most-recently-registered matching handler first.
      await page.route('**/api/object_info', (route) =>
        route.fulfill(
          jsonRoute({
            [SOURCE_NODE_TYPE]: sourceNodeDef,
            [NODE_TYPE]: nodeDef
          })
        )
      )

      const host = new HostDoc(WORKFLOW_ID, seed, catalog)
      let socketSend: ((frame: unknown) => void) | null = null
      let subscribeCount = 0
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
          subscribeCount += 1
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
        // Only the Vue node renderer projects follower edits onto the
        // canvas as DOM this test can query.
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
      const panel = page.locator('#agent-panel-root')

      const readLinkTargets = () =>
        page.evaluate(
          (linkIds) => {
            const graph = window.app!.graph
            return linkIds.map((id) => {
              const link = graph.links.get(id)
              if (!link) return undefined
              return graph.getNodeById(link.target_id)?.inputs[link.target_slot]
                ?.name
            })
          },
          EXPECTED_TARGETS.map(({ linkId }) => toLinkId(linkId))
        )

      // Verified independently below (the graph read above is the same
      // canonical link map litegraph paints wires from), the DOM check
      // additionally confirms the socket rows this test cares about are
      // actually rendered and marked connected on the canvas.
      async function assertVisiblyCorrect(): Promise<void> {
        await expect
          .poll(readLinkTargets)
          .toEqual(EXPECTED_TARGETS.map(({ name }) => name))
        for (const { index } of CONNECTED_SOCKET_SLOTS) {
          await expect(vueNodes.getInputSlotRow(TARGET_ID, index)).toHaveClass(
            /lg-slot--connected/
          )
        }
        for (const { index } of SPARE_SLOTS) {
          await expect(
            vueNodes.getInputSlotRow(TARGET_ID, index)
          ).not.toHaveClass(/lg-slot--connected/)
        }
      }

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
        await expect(
          panel.getByRole('button', { name: enMessages.agent.stop })
        ).toHaveCount(0)
        // The CRDT follower subscribes once the turn's ack binds this
        // workflow (`bindWorkflow` in `useAgentSession.ts`).
        await expect.poll(() => subscribeCount, { timeout: 20_000 }).toBe(1)
      })

      await test.step('every link lands on its named slot right after materialization', async () => {
        await expect(vueNodes.getNodeLocator(TARGET_ID)).toBeVisible()
        await assertVisiblyCorrect()
      })

      await test.step('a tab switch forces a reconcile of the same node, and every link is still correct', async () => {
        // A brand-new node materialized for the first time is trivially
        // correct (there is no live node yet to disagree with the
        // document); a tab switch re-subscribes the follower and replays
        // the whole document over the node record the store already holds,
        // which is the reconcile this fix actually changed. See
        // `agentAutogrowTabSwitchReconcile.spec.ts`.
        await expect(
          topbar.workflowTabs.locator('.p-togglebutton')
        ).toHaveCount(1)
        await topbar.newWorkflowButton.click()
        await expect(
          topbar.workflowTabs.locator('.p-togglebutton')
        ).toHaveCount(2)
        await topbar.getTab(0).click()
        await expect(topbar.getTab(0)).toHaveClass(/p-togglebutton-checked/)
        await expect.poll(() => subscribeCount).toBe(2)

        await expect(vueNodes.getNodeLocator(TARGET_ID)).toBeVisible()
        await assertVisiblyCorrect()
      })
    })
  }
)
