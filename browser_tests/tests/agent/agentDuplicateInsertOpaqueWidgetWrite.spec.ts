import { expect, mergeTests } from '@playwright/test'
import type { Locator, Page, WebSocketRoute } from '@playwright/test'
import type { Op, WidgetCatalog } from '@comfyorg/comfy-multi-player'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

import {
  BLANK_WORKFLOW,
  agentTest,
  bootAgentApp,
  loadIntoBootWorkflow,
  mockAgentTurnApi,
  mockWorkflowPersistence
} from '@e2e/fixtures/agentPanelFixture'
import { HostDoc } from '@e2e/fixtures/agentConversationHostDoc'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { ToastHelper } from '@e2e/fixtures/helpers/ToastHelper'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

/**
 * Repro for the Memie Osuga / stagingcloud in-app-agent report: asking the
 * agent for "a z-turbo image workflow" made it call `insert_workflow` TWICE
 * with two different op ids, landing two perfectly-overlapping copies of the
 * same template (confirmed via the report's own CRDT debug log: two disjoint
 * `insert:<opId>:root:node:<id>` namespaces sharing the same three local
 * node ids). Duplicate-insert-with-no-dedup is intentional frontend behavior
 * (`agentInsertWorkflow.templates.test.ts`'s "the same template inserted
 * twice produces two independent, fully-wired pipelines"), so this repro
 * does not treat that half as a defect -- it documents the VISUAL overlap
 * that duplication produces on a real canvas, which no test asserted before,
 * and then the FRONTEND-observable half of the actual complaint: a widget
 * write the doc host rejects with an `opaque_widgets`-shaped failure
 * (`<node> is absent from the pinned catalog, so its widgets_values is
 * stored opaquely (schema §1.2) and is not name-addressable`). The follower
 * now puts the refused register back from the document
 * (`AgentCrdtProjection.revertRejected`), so the widget no longer keeps
 * showing a value the shared document never took; what is still missing is
 * any visible indication to the human that the write was refused.
 *
 * `opaque_widgets` itself is a cloud doc-host error code with no frontend
 * equivalent (`docFrameClient.ts`'s `DocOpFailure.code` is opaque wire text,
 * never matched against a fixed vocabulary), so this repro injects the
 * host's raw wire response directly rather than trying to make the real
 * `comfy-multi-player` applier produce it -- exactly what a real doc host
 * running this rejection logic would put on the wire.
 */

const WORKFLOW_ID = 'b3f1c4a2-0000-4000-8000-000000000030'
const MESSAGE_ID = 'b3f1c4a2-0000-4000-8000-000000000031'
const THREAD_ID = 'b3f1c4a2-0000-4000-8000-000000000032'

const PROMPT_TEXT = 'a shiba inu wearing sunglasses, z-image-turbo'
const SEED_VALUE = 111111
const EDITED_SEED_VALUE = 222222

const nodeDefs: Record<string, ComfyNodeDef> = {
  AgentClipSource: {
    name: 'AgentClipSource',
    display_name: 'Agent Clip Source',
    description: '',
    category: 'testing',
    python_module: 'testing',
    output_node: false,
    input: { required: {} },
    output: ['CLIP'],
    output_is_list: [false],
    output_name: ['CLIP']
  },
  CLIPTextEncode: {
    name: 'CLIPTextEncode',
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
  KSampler: {
    name: 'KSampler',
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
        control_after_generate: [
          ['fixed', 'increment', 'decrement', 'randomize'],
          { default: 'fixed' }
        ],
        steps: ['INT', { default: 20, min: 1, max: 10000 }],
        cfg: ['FLOAT', { default: 8, min: 0, max: 100 }],
        sampler_name: [['euler'], { default: 'euler' }],
        scheduler: [['simple'], { default: 'simple' }],
        denoise: ['FLOAT', { default: 1, min: 0, max: 1 }]
      }
    },
    output: ['LATENT'],
    output_is_list: [false],
    output_name: ['LATENT']
  }
}

const catalog: WidgetCatalog = {
  types: {
    AgentClipSource: { widget_order: [] },
    CLIPTextEncode: { widget_order: ['text'] },
    KSampler: {
      widget_order: [
        'seed',
        'control_after_generate',
        'steps',
        'cfg',
        'sampler_name',
        'scheduler',
        'denoise'
      ]
    }
  }
}

// The z-image-turbo-shaped template: a CLIP source, a text-encode node
// carrying the prompt, and a sampler carrying the seed -- three nodes, same
// shape every time `insertOp` mints it, exactly like the same template
// inserted twice in the report.
function templateWorkflow(): Extract<
  Op,
  { op: 'insert_workflow' }
>['workflow'] {
  return {
    nodes: [
      {
        id: 1,
        type: 'AgentClipSource',
        pos: [40, 300],
        size: [180, 80],
        inputs: [],
        outputs: [{ name: 'CLIP', type: 'CLIP', links: [10] }]
      },
      {
        id: 2,
        type: 'CLIPTextEncode',
        pos: [260, 300],
        size: [240, 120],
        inputs: [{ name: 'clip', type: 'CLIP', link: 10 }],
        outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [20] }],
        widgets_values: [PROMPT_TEXT]
      },
      {
        id: 3,
        type: 'KSampler',
        pos: [540, 300],
        size: [260, 260],
        inputs: [
          { name: 'model', type: 'MODEL', link: null },
          { name: 'positive', type: 'CONDITIONING', link: 20 },
          { name: 'negative', type: 'CONDITIONING', link: null },
          { name: 'latent_image', type: 'LATENT', link: null }
        ],
        outputs: [],
        widgets_values: [SEED_VALUE, 'fixed', 20, 8, 'euler', 'simple', 1]
      }
    ],
    links: [
      [10, 1, 0, 2, 0, 'CLIP'],
      [20, 2, 0, 3, 1, 'CONDITIONING']
    ]
  }
}

function insertWorkflowOp(
  opId: string
): Extract<Op, { op: 'insert_workflow' }> {
  return {
    op_id: opId.padEnd(32, '0'),
    actor: 'agent:e2e',
    base_version: 1,
    stamp: [1, 'agent:e2e'],
    op: 'insert_workflow',
    workflow: templateWorkflow()
  }
}

/**
 * Applies one `insert_workflow` op directly to the host's real document (the
 * agent's own broadcast, never a client `doc_ops` batch) and returns the
 * resulting `doc_update` frame. `HostDoc.applyWire` is used only for its
 * looser `WireOpEnvelope[]` parameter typing -- the `doc_ops_result` half of
 * its return is discarded, since a client that never sent this op as
 * `doc_ops` would never receive one for it.
 */
function applyInsertWorkflow(host: HostDoc, opId: string) {
  const { update, outcomes } = host.applyWire([insertWorkflowOp(opId)])
  if (update === null || outcomes[0]?.outcome !== 'applied')
    throw new Error(`insert_workflow op ${opId} did not apply cleanly`)
  return update
}

interface DuplicateInsertHandles {
  vueNodes: VueNodeHelpers
  host: HostDoc
  socket: WebSocketRoute
  outboundFrames: string[]
  /** The `KSampler`-type node id materialized by the FIRST insert. */
  copyANodeId: string
  /** The `KSampler`-type node id materialized by the SECOND insert. */
  copyBNodeId: string
}

async function ksamplerNodeIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    window
      .app!.graph.nodes.filter((node) => node.type === 'KSampler')
      .map((node) => String(node.id))
  )
}

/**
 * Boots the agent-enabled app, sends one turn, and lands two `insert_workflow`
 * ops with different op ids -- each carrying its own fresh copy of the same
 * three-node template, exactly like the two disjoint `insert:<opId>:...`
 * namespaces in the report's CRDT debug log.
 */
async function driveThroughDuplicateInsert(
  page: Page,
  getWebSocket: () => Promise<WebSocketRoute>
): Promise<DuplicateInsertHandles> {
  await page.setViewportSize({ width: 1920, height: 1280 })
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.Agent.CrdtFollower', 'true')
  })
  await bootAgentApp(page, true, {
    settings: { 'Comfy.VueNodes.Enabled': true },
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
  await loadIntoBootWorkflow(page, BLANK_WORKFLOW)
  const socket = await getWebSocket()
  const outboundFrames: string[] = []
  socket.onMessage((message) => outboundFrames.push(String(message)))

  const agentPanel = new AgentPanel(page)
  await agentPanel.open()
  await agentPanel.selectWorkflow()
  await agentPanel.sendMessage('Create a z-turbo image workflow')

  await expect
    .poll(() => outboundFrames, { timeout: 15_000 })
    .toContainEqual(
      expect.stringMatching(
        new RegExp(
          `doc_subscribe.*${WORKFLOW_ID}|${WORKFLOW_ID}.*doc_subscribe`
        )
      )
    )

  const host = new HostDoc(WORKFLOW_ID, { nodes: [], links: [] }, catalog)
  for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))

  await expect
    .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
    .toBe(0)

  // First `insert_workflow`: the agent's own first (unnecessary) tool call.
  socket.send(JSON.stringify(applyInsertWorkflow(host, 'insert-zturbo-op-a')))
  await expect.poll(() => ksamplerNodeIds(page)).toHaveLength(1)
  const [copyANodeId] = await ksamplerNodeIds(page)

  // Second `insert_workflow`, a DIFFERENT op id, the SAME template -- the
  // duplicate call the report's debug log caught (two disjoint
  // `insert:<opId>:root:node:<id>` namespaces holding the same 3 node ids).
  socket.send(JSON.stringify(applyInsertWorkflow(host, 'insert-zturbo-op-b')))
  await expect.poll(() => ksamplerNodeIds(page)).toHaveLength(2)
  const copyBNodeId = (await ksamplerNodeIds(page)).find(
    (id) => id !== copyANodeId
  )!

  return {
    vueNodes: new VueNodeHelpers(page),
    host,
    socket,
    outboundFrames,
    copyANodeId,
    copyBNodeId
  }
}

interface RejectedWidgetEditHandles extends DuplicateInsertHandles {
  seedInput: Locator
}

/**
 * Extends {@link driveThroughDuplicateInsert} with a human edit of copy B's
 * `seed` widget, then answers the client's `doc_ops` batch with a raw
 * `doc_ops_result` the way a real doc host would for a node whose class is
 * absent from its pinned catalog -- `ok: false`, a `failed` entry naming the
 * rejected op, and (per the applier's contract) no accompanying `doc_update`,
 * since nothing landed.
 */
async function driveThroughRejectedWidgetEdit(
  page: Page,
  getWebSocket: () => Promise<WebSocketRoute>
): Promise<RejectedWidgetEditHandles> {
  const handles = await driveThroughDuplicateInsert(page, getWebSocket)
  const { vueNodes, socket, outboundFrames, copyBNodeId } = handles

  // The two copies sit at IDENTICAL canvas coordinates (the overlap under
  // test in the other spec), which a real human could not click through
  // either -- move copy B's node clear of copy A's before driving a normal,
  // pointer-based edit, so this edit deterministically lands on the specific
  // node id under test rather than whichever copy happens to render on top.
  await page.evaluate(
    ({ nodeId, dy }) => {
      const node = window.app!.graph.nodes.find(
        (candidate) => String(candidate.id) === nodeId
      )
      if (!node) throw new Error(`node ${nodeId} not found`)
      node.pos = [node.pos[0], node.pos[1] + dy]
      window.app!.graph.setDirtyCanvas(true, true)
    },
    { nodeId: copyBNodeId, dy: 600 }
  )
  await page.getByRole('button', { name: 'Fit View (.)', exact: true }).click()
  const seedInput = vueNodes
    .getNodeLocator(copyBNodeId)
    .getByLabel('seed', { exact: true })
    .getByRole('spinbutton')

  const framesBeforeEdit = outboundFrames.length
  await seedInput.fill(String(EDITED_SEED_VALUE))
  await seedInput.blur()

  await expect
    .poll(() => outboundFrames.slice(framesBeforeEdit))
    .toContainEqual(expect.stringContaining('"op":"set_widget"'))
  const opsFrame = outboundFrames
    .slice(framesBeforeEdit)
    .map(
      (frame) =>
        JSON.parse(frame) as {
          type: string
          data: { ops: Array<{ op_id: string }> }
        }
    )
    .find((frame) => frame.type === 'doc_ops')
  if (!opsFrame) throw new Error('expected a doc_ops frame for the widget edit')
  const rejectedOpId = opsFrame.data.ops[0].op_id

  socket.send(
    JSON.stringify({
      type: 'doc_ops_result',
      data: {
        v: 1,
        workflow_id: WORKFLOW_ID,
        ok: false,
        applied: [],
        skipped: [],
        failed: {
          index: 0,
          op_id: rejectedOpId,
          code: 'opaque_widgets',
          message: `${copyBNodeId} is absent from the pinned catalog, so its widgets_values is stored opaquely (schema §1.2) and is not name-addressable`
        }
      }
    })
  )

  // Give the browser's own event loop a couple of turns to run the
  // `doc_ops_result` listener the injected WS message wakes -- it is a
  // synchronous handler (`useAgentCrdtFollower.ts`'s `onOpsResult`), so by
  // the time these resolve it has already run, without an arbitrary sleep.
  await nextFrame(page)
  await nextFrame(page)

  return { ...handles, seedInput }
}

test.describe(
  'Agent duplicate insert_workflow + opaque widget-write silent failure',
  { tag: ['@cloud', '@agent', '@canvas', '@node', '@widget'] },
  () => {
    test.use({ connectWebSocketToServer: false })
    test.describe.configure({ timeout: 60_000 })

    test('two insert_workflow calls with different op ids leave two fully overlapping, visually indistinguishable copies of the template', async ({
      page,
      getWebSocket
    }) => {
      const { vueNodes, copyANodeId, copyBNodeId } =
        await driveThroughDuplicateInsert(page, getWebSocket)

      expect(
        await page.evaluate(
          () =>
            window.app!.graph.nodes.filter((n) => n.type === 'AgentClipSource')
              .length
        )
      ).toBe(2)
      expect(
        await page.evaluate(
          () =>
            window.app!.graph.nodes.filter((n) => n.type === 'CLIPTextEncode')
              .length
        )
      ).toBe(2)

      await page
        .getByRole('button', { name: 'Fit View (.)', exact: true })
        .click()

      // `Fit View` pans/zooms with a brief transition; wait for copy A's box
      // to stop moving (two consecutive identical reads) before comparing it
      // to copy B's, or the comparison below races the animation instead of
      // measuring the settled overlap.
      let previousBoxA: Awaited<ReturnType<Locator['boundingBox']>> = null
      await expect
        .poll(async () => {
          const box = await vueNodes.getNodeLocator(copyANodeId).boundingBox()
          const settled =
            previousBoxA !== null &&
            box !== null &&
            JSON.stringify(box) === JSON.stringify(previousBoxA)
          previousBoxA = box
          return settled
        })
        .toBe(true)

      // Nobody previously asserted the resulting VISUAL overlap: the same
      // template inserted twice renders both copies at pixel-identical
      // positions, so a human cannot tell them apart on canvas.
      const boxA = await vueNodes.getNodeLocator(copyANodeId).boundingBox()
      const boxB = await vueNodes.getNodeLocator(copyBNodeId).boundingBox()
      expect(boxA).not.toBeNull()
      expect(boxB).toEqual(boxA)
    })

    test('a widget edit the host rejects as opaque is rolled back to the value the shared document kept', async ({
      page,
      getWebSocket
    }) => {
      const { host, seedInput, copyBNodeId } =
        await driveThroughRejectedWidgetEdit(page, getWebSocket)

      // The refused register is put back from the document, so the widget
      // the human is looking at and the document a subsequent run would read
      // from agree again. Nothing yet marks the write as failed.
      await expect(seedInput).toHaveValue(String(SEED_VALUE))
      await expect(new ToastHelper(page).toastErrors).toHaveCount(0)
      await expect(page.getByRole('alert')).toHaveCount(0)

      const projected = host.projection()
      const sampler = projected.nodes.find(
        (node) => String(node.id) === copyBNodeId
      )
      expect(sampler?.widgets_values).toEqual(
        expect.arrayContaining([SEED_VALUE])
      )
    })

    test('defect: a rejected widget write ought to surface visibly to the human, but currently does not', async ({
      page,
      getWebSocket
    }) => {
      await driveThroughRejectedWidgetEdit(page, getWebSocket)

      // The known gap: nothing in the ordinary product UI (no toast, no
      // inline alert on the widget or the panel) tells the human this write
      // never reached the shared document.
      test.fail()
      await expect(new ToastHelper(page).toastErrors).toBeVisible({
        timeout: 3_000
      })
    })
  }
)
