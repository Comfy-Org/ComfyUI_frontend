import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'
import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentFollowerHostSocket } from '@e2e/fixtures/agentFollowerHostSocket'
import {
  agentTest as test,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { ToastHelper } from '@e2e/fixtures/helpers/ToastHelper'
import { TestIds } from '@e2e/fixtures/selectors'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'

/**
 * Extracted from the superseded frontend #18210 (`claude/pending-op-tracker-
 * survives-tab-switch`), which the graph-API rewrite (#18700) closed: its
 * implementation was the pending-ledger / full-reconcile design that rewrite
 * deleted, but one user story in it had no black-box owner on `main` and
 * survives the pivot unchanged — a human node add the doc host REFUSES must
 * leave the canvas and tell the person it was refused. The disposition that
 * named this the single durable extraction is
 * `reports/jobs/op399-fe18210-disposition.md` in the program repo.
 *
 * What exists on `main` today covers the two halves separately and only below
 * the UI: `useAgentCrdtFollower.rejectedHumanAdd.test.ts` asserts the
 * telemetry report for a refused `add_node`, and
 * `agentCrdtProjection.localEdits.test.ts` asserts `revertRejected` goes
 * through the graph API. `agentDuplicateInsertOpaqueWidgetWrite.spec.ts` is
 * the only black-box rejection case, and it covers a refused `set_widget`
 * (widget-write copy, value rollback) — a different op, a different notice
 * string, and no node removal. Nothing asserted that the person watching the
 * canvas sees the node go away.
 *
 * Nothing here reconstructs #18210's machinery: no `pendingOpTracker`, no
 * `pendingOpRevert`, no layout-actor suppression, no reconcile pass. The
 * rejection is produced by the REAL applier the doc host runs, and the
 * revert is whatever the landed graph-API follower does with it.
 */

const WORKFLOW_ID = 'f18210000-0000-4000-8000-000000000001'
const SOCKET_SID = 'f18210000-0000-4000-8000-000000000002'
const MESSAGE_ID = 'f18210000-0000-4000-8000-000000000003'
const THREAD_ID = 'f18210000-0000-4000-8000-000000000004'

/**
 * Fixes the canvas at 1:1 with a small origin offset, so the seed node sits in
 * the top-left corner and there is empty canvas below it to open the node
 * search box over. Pinning it is not optional: `loadIntoBootWorkflow` runs
 * `FitView`, whose zoom depends on how much graph there is, and a single seed
 * node fits by filling the viewport — a hard-coded screen point then lands on
 * the seed node's own `seed` widget instead of empty canvas. Related, and
 * worth reading before trusting any coordinate here:
 * `docs/env-and-harness-traps.md` on the default-graph viewport.
 */
async function pinCanvasTransform(page: Page): Promise<void> {
  await page.evaluate(() => {
    const canvas = window.app!.canvas
    canvas.ds.scale = 1
    canvas.ds.offset = [40, 40]
    canvas.setDirty(true, true)
  })
  await nextFrame(page)
}

/**
 * A screen point that is empty canvas: directly below the seed node, which the
 * pinned transform parks in the top-left corner. Measured rather than
 * hard-coded, and checked against the node's own box, so this fails loudly
 * instead of silently double-clicking a widget.
 */
async function emptyCanvasPointBelow(
  page: Page,
  node: Locator
): Promise<{ x: number; y: number }> {
  const box = await node.boundingBox()
  if (!box) throw new Error('the seed node is not on screen')
  const point = { x: box.x + box.width / 2, y: box.y + box.height + 160 }
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('this spec needs a sized viewport')
  if (point.y > viewport.height - 80)
    throw new Error(
      `no empty canvas below the seed node: it ends at y=${box.y + box.height} in a ${viewport.height}px viewport`
    )
  return point
}

/**
 * `CLIPTextEncode` is the class the person adds and the host refuses;
 * `KSampler` seeds both the canvas and the document so the refusal can be
 * shown to remove the added node and nothing else.
 */
const ADDED_CLASS = 'CLIPTextEncode'
const SEED_CLASS = 'KSampler'
const SEED_NODE_ID = '1'

const nodeDefs: Record<string, ComfyNodeDef> = {
  [ADDED_CLASS]: {
    name: ADDED_CLASS,
    display_name: 'CLIP Text Encode',
    description: '',
    category: 'conditioning',
    python_module: 'nodes',
    output_node: false,
    input: {
      required: {
        clip: ['CLIP', { forceInput: true }],
        text: ['STRING', { default: '', multiline: true }]
      }
    },
    output: ['CONDITIONING'],
    output_is_list: [false],
    output_name: ['CONDITIONING']
  },
  [SEED_CLASS]: {
    name: SEED_CLASS,
    display_name: 'KSampler',
    description: '',
    category: 'sampling',
    python_module: 'nodes',
    output_node: false,
    input: {
      required: {
        model: ['MODEL', { forceInput: true }],
        positive: ['CONDITIONING', { forceInput: true }],
        negative: ['CONDITIONING', { forceInput: true }],
        latent_image: ['LATENT', { forceInput: true }],
        seed: ['INT', { default: 0, min: 0, max: 2147483647 }],
        steps: ['INT', { default: 20, min: 1, max: 10000 }]
      }
    },
    output: ['LATENT'],
    output_is_list: [false],
    output_name: ['LATENT']
  }
}

/**
 * The host's catalog describes `KSampler` and NOT `CLIPTextEncode`. That is
 * not a contrived gap: the widget catalog is a sha256-pinned projection of
 * one `object_info` (KEEP-ALIVE 12, pinned at mint via `meta.catalog_version`),
 * so a browser talking to a newer server can create a class the pinned catalog
 * has never described. `wireNodeSnapshot` mints NAME-KEYED `widgets_values`
 * for any non-virtual class, and the real applier refuses a name-keyed payload
 * it cannot project — `uncatalogued_widget_write`, raised by
 * `rejectUnprojectableWidgets`, because accepting it would make the whole
 * document unprojectable on every later read. No wire frame is fabricated
 * here; the verdict below is the applier's own.
 */
const catalog: WidgetCatalog = {
  types: { [SEED_CLASS]: { widget_order: ['seed', 'steps'] } }
}

/** The document seed, in the applier's own workflow shape. */
const hostSeed: WorkflowJSON = {
  nodes: [
    {
      id: Number(SEED_NODE_ID),
      type: SEED_CLASS,
      pos: [120, 120],
      size: [260, 140],
      inputs: [
        { name: 'model', type: 'MODEL', link: null },
        { name: 'positive', type: 'CONDITIONING', link: null },
        { name: 'negative', type: 'CONDITIONING', link: null },
        { name: 'latent_image', type: 'LATENT', link: null }
      ],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
      widgets_values: [0, 20]
    }
  ],
  links: []
}

/** The same seed as the canvas holds it; the follower merges into this graph. */
const canvasSeed: ComfyWorkflowJSON = {
  last_node_id: Number(SEED_NODE_ID),
  last_link_id: 0,
  nodes: [
    {
      id: Number(SEED_NODE_ID),
      type: SEED_CLASS,
      pos: [120, 120],
      size: [260, 140],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [
        { name: 'model', type: 'MODEL', link: null },
        { name: 'positive', type: 'CONDITIONING', link: null },
        { name: 'negative', type: 'CONDITIONING', link: null },
        { name: 'latent_image', type: 'LATENT', link: null }
      ],
      outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
      properties: {},
      widgets_values: [0, 20]
    }
  ],
  links: [],
  version: 0.4
}

function nodeIdsOfType(page: Page, type: string): Promise<string[]> {
  return page.evaluate(
    (nodeType) =>
      window
        .app!.graph.nodes.filter((node) => node.type === nodeType)
        .map((node) => String(node.id)),
    type
  )
}

/**
 * Adds a node the way a person does: double-click the canvas, type the class
 * into the node search box, Enter, then click to place it. Returns the id the
 * add produced.
 */
async function addThroughSearchBox(
  page: Page,
  type: string,
  at: { x: number; y: number }
): Promise<string> {
  await page.mouse.dblclick(at.x, at.y, { delay: 5 })
  const dialog = page.getByRole('search')
  // Named explicitly: a widget-select trigger on the seed node is also
  // role="combobox", so an unnamed query resolves to more than one match.
  const input = dialog.getByRole('combobox', { name: enMessages.g.addNode })
  await input.waitFor({ state: 'visible' })
  await input.fill(type)
  const results = dialog.getByTestId(TestIds.searchBoxV2.resultItem)
  await expect(results.first()).toContainText('CLIP Text Encode')
  await page.keyboard.press('Enter')
  await expect(dialog).toBeHidden()
  await page.mouse.click(at.x, at.y)

  const added = await nodeIdsOfType(page, type)
  if (added.length !== 1)
    throw new Error(
      `the search box add produced ${added.length} ${type} nodes, expected 1`
    )
  return added[0]
}

test.describe(
  'a human node add the agent doc host refuses',
  { tag: ['@cloud', '@agent', '@canvas', '@node', '@vue-nodes'] },
  () => {
    test.describe.configure({ timeout: 90_000 })

    test('leaves the canvas and tells the person it was refused', async ({
      page,
      agentFlagEnabled
    }) => {
      const host = new HostDoc(WORKFLOW_ID, hostSeed, catalog)
      // `hold` parks the page's own `doc_ops` batch instead of judging it on
      // arrival, so the added node is OBSERVABLE on the canvas before the
      // verdict lands. Judging it at send time is what made #18210's version
      // of this case race its own assertion ("the synchronous rejection can
      // remove the node before it is observable"); releasing the held batch
      // takes the identical path - relay gate, real applier, verdict frame -
      // so nothing about the rejection itself is weakened by waiting.
      const hostSocket = new AgentFollowerHostSocket(
        page,
        WORKFLOW_ID,
        host,
        SOCKET_SID,
        'hold'
      )
      await hostSocket.install()

      await page.setViewportSize({ width: 1920, height: 1280 })
      await bootAgentApp(page, agentFlagEnabled, {
        settings: {
          'Comfy.Graph.CanvasInfo': false,
          'Comfy.NodeSearchBoxImpl': 'default',
          'Comfy.NodeSearchBoxImpl.FollowCursor': true
        },
        objectInfo: nodeDefs,
        beforeNavigate: async (page) => {
          await mockAgentTurnApi(page, {
            message_id: MESSAGE_ID,
            thread_id: THREAD_ID,
            workflow_id: WORKFLOW_ID
          })
          await mockWorkflowPersistence(page, WORKFLOW_ID)
        }
      })
      await loadIntoBootWorkflow(page, canvasSeed)

      const vueNodes = new VueNodeHelpers(page)
      const agentPanel = new AgentPanel(page)
      await agentPanel.open()
      await agentPanel.selectWorkflow()
      // The session binds the workflow when a turn is ACCEPTED
      // (`useAgentSession`'s `boundAtAck`), and the follower subscribes to the
      // bound workflow — so a person only has the Agent watching this canvas
      // after they have said something to it. One turn is what puts the
      // follower in the state the rest of this case is about.
      await agentPanel.sendMessage('Have a look at this workflow')
      await hostSocket.waitForSubscribe()
      const seedNode = vueNodes.getNodeLocator(SEED_NODE_ID)
      await expect(seedNode).toBeVisible()
      // After the panel has taken its side of the window, so the pinned
      // transform is the one the add is aimed at.
      await pinCanvasTransform(page)
      const addAt = await emptyCanvasPointBelow(page, seedNode)

      const addedNodeId =
        await test.step('the person adds a node and sees it on the canvas', async () => {
          const addedNodeId = await addThroughSearchBox(
            page,
            ADDED_CLASS,
            addAt
          )
          await expect(vueNodes.getNodeLocator(addedNodeId)).toBeVisible()
          await expect
            .poll(() =>
              hostSocket
                .heldClientOps()
                .map((op) => op.op)
                .filter((op) => op === 'add_node')
            )
            .toEqual(['add_node'])
          return addedNodeId
        })

      await test.step('the host refuses the add', async () => {
        expect(hostSocket.releaseHeldClientOps()).not.toEqual([])
        await expect
          .poll(() => hostSocket.humanOpOutcomes())
          .toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                outcome: 'rejected',
                reason: expect.objectContaining({
                  code: 'uncatalogued_widget_write'
                })
              })
            ])
          )
      })

      await test.step('the refused node is gone from the canvas and the seed node is not', async () => {
        await expect(vueNodes.getNodeLocator(addedNodeId)).toBeHidden()
        await expect.poll(() => nodeIdsOfType(page, ADDED_CLASS)).toEqual([])
        await expect(vueNodes.getNodeLocator(SEED_NODE_ID)).toBeVisible()
        // The canvas agrees with the document again: a later run reads the
        // same graph the person is looking at.
        expect(host.projection().nodes.map((node) => String(node.id))).toEqual([
          SEED_NODE_ID
        ])
      })

      await test.step('the person is told the edit was refused', async () => {
        // `toastErrors` is not filtered on `:visible` and `toContainText`
        // passes on any node in the collection, so either alone would accept
        // a message nobody saw. Filter to the copy and require it on screen.
        // The graph-edit copy, not the widget-write copy: the op the host
        // named is an `add_node`, and `rejectedOpNotice` reserves the
        // widget-write wording for a refused `set_widget`.
        const rejectionToast = new ToastHelper(page).toastErrors.filter({
          hasText: enMessages.agent.editRejected.generic
        })
        await expect(rejectionToast).toBeVisible({ timeout: 10_000 })
      })
    })
  }
)
