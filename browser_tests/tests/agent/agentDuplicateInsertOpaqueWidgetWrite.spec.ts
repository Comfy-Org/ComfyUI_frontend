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
import { subscribeAgentWorkflow } from '@e2e/fixtures/utils/subscribeAgentWorkflow'
import { nextFrame } from '@e2e/fixtures/utils/timing'
import { VueNodeHelpers } from '@e2e/fixtures/VueNodeHelpers'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(agentTest, webSocketFixture)

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
    actor: 'agent:e2e:turn-1',
    base_version: 1,
    stamp: [1, 'agent:e2e:turn-1'],
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

async function driveThroughDuplicateInsert(
  page: Page,
  getAgentSocket: () => Promise<WebSocketRoute>
): Promise<DuplicateInsertHandles> {
  await page.setViewportSize({ width: 1920, height: 1280 })
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.Agent.CrdtFollower', 'true')
  })
  await bootAgentApp(page, true, {
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

  const agentPanel = new AgentPanel(page)
  await agentPanel.open()
  const socket = await getAgentSocket()
  const outboundFrames = await subscribeAgentWorkflow({
    agentPanel,
    socket,
    workflowId: WORKFLOW_ID,
    prompt: 'Create a z-turbo image workflow'
  })

  const host = new HostDoc(WORKFLOW_ID, { nodes: [], links: [] }, catalog)
  for (const frame of host.initialSync()) socket.send(JSON.stringify(frame))

  await expect
    .poll(() => page.evaluate(() => window.app!.graph.nodes.length))
    .toBe(0)

  socket.send(JSON.stringify(applyInsertWorkflow(host, 'insert-zturbo-op-a')))
  await expect.poll(() => ksamplerNodeIds(page)).toHaveLength(1)
  const [copyANodeId] = await ksamplerNodeIds(page)

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

async function driveThroughRejectedWidgetEdit(
  page: Page,
  getAgentSocket: () => Promise<WebSocketRoute>
): Promise<RejectedWidgetEditHandles> {
  const handles = await driveThroughDuplicateInsert(page, getAgentSocket)
  const { vueNodes, socket, outboundFrames, copyBNodeId } = handles

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

  await nextFrame(page)
  await nextFrame(page)

  return { ...handles, seedInput }
}

test.describe(
  'Agent duplicate insert_workflow + opaque widget-write rejection',
  {
    tag: ['@cloud', '@agent', '@canvas', '@node', '@widget', '@vue-nodes']
  },
  () => {
    test.use({ connectWebSocketToServer: false })
    test.describe.configure({ timeout: 60_000 })

    test('two insert_workflow calls with different op ids leave two copies of the template side by side', async ({
      page,
      getAgentSocket
    }) => {
      const { vueNodes, copyANodeId, copyBNodeId } =
        await driveThroughDuplicateInsert(page, getAgentSocket)

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

      const boxA = await vueNodes.getNodeLocator(copyANodeId).boundingBox()
      const boxB = await vueNodes.getNodeLocator(copyBNodeId).boundingBox()
      expect(boxA).not.toBeNull()
      expect(boxB).not.toBeNull()
      expect(boxB!.width).toBeCloseTo(boxA!.width, 0)
      expect(boxB!.y).toBeCloseTo(boxA!.y, 0)
      expect(boxB!.x).toBeGreaterThan(boxA!.x + boxA!.width)
    })

    test('a rejected widget edit is reported and rolled back to the value the shared document kept', async ({
      page,
      toast,
      getAgentSocket
    }) => {
      const { host, seedInput, copyBNodeId } =
        await driveThroughRejectedWidgetEdit(page, getAgentSocket)

      // The refused register is put back from the document, so the widget
      // the human is looking at and the document a subsequent run would read
      // from agree again.
      await expect(seedInput).toHaveValue(String(SEED_VALUE))

      const projected = host.projection()
      const sampler = projected.nodes.find(
        (node) => String(node.id) === copyBNodeId
      )
      expect(sampler?.widgets_values).toEqual(
        expect.arrayContaining([SEED_VALUE])
      )

      // `toastErrors` is not filtered on `:visible` (only `visibleToasts` is)
      // and `toContainText` passes on any node in the collection, so either
      // alone would accept a message the user never sees. Filter to the text
      // and require it on screen.
      const rejectionToast = toast.toastErrors.filter({
        hasText: 'Widget edit was rejected and was not saved'
      })
      await expect(rejectionToast).toBeVisible({ timeout: 3_000 })
    })
  }
)
