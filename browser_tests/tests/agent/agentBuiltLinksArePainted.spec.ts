import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  ADDITIVE_CANVAS_CASE,
  ADDITIVE_READINESS_NODE_ID,
  ADDITIVE_READINESS_WIDGET
} from '@e2e/fixtures/data/agent/agentCanvasAdditive'
import { agentConversationTest as test } from '@e2e/fixtures/agentConversationFixture'
import type { RecordedGraphOperation } from '@e2e/fixtures/data/agent/agentConversation'
import { waitForCanvasViewToSettle } from '@e2e/fixtures/helpers/CanvasHelper'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

const CASE = 'agent-rec-refiner-between'

const PROMPT_ENCODER_ID = '6'
const PROMPT_ENCODER_CONDITIONING_OUTPUT = 0

const REFINER_ID = '2092962753103866'
const REFINER_FREE_INPUT_NAME = 'negative'

const LINKED_INSERT: RecordedGraphOperation = {
  op: 'insert_workflow',
  workflow: {
    nodes: [
      {
        id: 870001,
        type: 'CheckpointLoaderSimple',
        pos: [1900, 900],
        size: [315, 98],
        mode: 0,
        flags: {},
        order: 0,
        inputs: [],
        outputs: [
          { name: 'MODEL', type: 'MODEL', links: [] },
          { name: 'CLIP', type: 'CLIP', links: [870010] },
          { name: 'VAE', type: 'VAE', links: [] }
        ],
        properties: {},
        widgets_values: ['sd_xl_base_1.0.safetensors']
      },
      {
        id: 870002,
        type: 'CLIPTextEncode',
        pos: [2300, 900],
        size: [400, 200],
        mode: 0,
        flags: {},
        order: 1,
        inputs: [{ name: 'clip', type: 'CLIP', link: 870010 }],
        outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [] }],
        properties: {},
        widgets_values: ['a painted link']
      }
    ],
    links: [[870010, 870001, 1, 870002, 0, 'CLIP']]
  }
}

async function paintedLinkIds(page: Page): Promise<number[]> {
  const ids = await page.evaluate(() => {
    const canvas = window.app?.canvas
    if (!canvas?.renderedPaths) return []
    return [...window.app!.graph.links.values()]
      .filter((link) => canvas.renderedPaths.has(link))
      .map((link) => Number(link.id))
  })
  return ids.sort((a, b) => a - b)
}

async function graphLinkIds(page: Page): Promise<number[]> {
  const ids = await page.evaluate(() =>
    [...window.app!.graph.links.keys()].map(Number)
  )
  return ids.sort((a, b) => a - b)
}

async function inputSlotIndex(
  page: Page,
  nodeId: string,
  name: string
): Promise<number> {
  const index = await page.evaluate(
    ([id, slotName]) => {
      const node = window.app?.graph.getNodeById(id)
      return (node?.inputs ?? []).findIndex((input) => input.name === slotName)
    },
    [toNodeId(nodeId), name] as const
  )
  expect(
    index,
    `node ${nodeId} has no input slot named ${name}`
  ).toBeGreaterThanOrEqual(0)
  return index
}

test.describe(
  'Links on the canvas are painted, not just present in the graph',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: CASE })

    test('PM-1495: every link the agent wires is drawn, and so is one the user then draws by hand', async ({
      agentConversation,
      comfyPage,
      page
    }) => {
      test.setTimeout(120_000)

      await test.step('replay the recorded turn that wires the refiner in', () =>
        agentConversation.runTurns({
          beforeFirstGraphOps: () => agentConversation.fitCanvasToGraph()
        }))

      const agentLinkIds =
        await test.step('half 1: the agent-built links are drawn on the canvas', async () => {
          await comfyPage.nextFrame()
          const expected = await graphLinkIds(page)
          expect(expected.length).toBeGreaterThanOrEqual(4)
          await expect
            .poll(() => paintedLinkIds(page), { timeout: 15_000 })
            .toEqual(expected)
          return expected
        })

      await test.step('half 2: a link the user draws by hand is drawn too', async () => {
        await waitForCanvasViewToSettle(page)

        const encoder =
          await comfyPage.nodeOps.getNodeRefById(PROMPT_ENCODER_ID)
        const refiner = await comfyPage.nodeOps.getNodeRefById(REFINER_ID)
        const negative = await inputSlotIndex(
          page,
          REFINER_ID,
          REFINER_FREE_INPUT_NAME
        )

        await comfyPage.canvasOps.dragAndDrop(
          await (
            await encoder.getOutput(PROMPT_ENCODER_CONDITIONING_OUTPUT)
          ).getPosition(),
          await (await refiner.getInput(negative)).getPosition()
        )

        await expect
          .poll(
            () => graphLinkIds(page),
            'the hand drag did not create a link, so this spec never reached the rendering question'
          )
          .toHaveLength(agentLinkIds.length + 1)
        const withHandDrawn = await graphLinkIds(page)

        await expect
          .poll(() => paintedLinkIds(page), { timeout: 15_000 })
          .toEqual(withHandDrawn)

        const handDrawnId = withHandDrawn.find(
          (id) => !agentLinkIds.includes(id)
        )!
        const endpoints = await page.evaluate((id) => {
          const link = window.app!.graph.links.get(id)!
          return {
            fromNode: String(link.origin_id),
            fromSlot: link.origin_slot,
            toNode: String(link.target_id),
            toSlot: link.target_slot
          }
        }, toLinkId(handDrawnId))
        expect(endpoints).toEqual({
          fromNode: PROMPT_ENCODER_ID,
          fromSlot: PROMPT_ENCODER_CONDITIONING_OUTPUT,
          toNode: REFINER_ID,
          toSlot: negative
        })
        await expect(
          agentConversation.vueNodes.getOutputSlotRow(
            endpoints.fromNode,
            endpoints.fromSlot
          )
        ).toHaveClass(/lg-slot--connected/)
        await expect(
          agentConversation.vueNodes.getInputSlotRow(
            endpoints.toNode,
            endpoints.toSlot
          )
        ).toHaveClass(/lg-slot--connected/)
      })
    })
  }
)

test.describe(
  'A workflow the agent loads arrives with its links drawn',
  { tag: ['@cloud', '@agent', '@vue-nodes'] },
  () => {
    test.use({ conversationCase: ADDITIVE_CANVAS_CASE, humanOpsHost: 'apply' })

    test('PM-1495: an inserted workflow does not arrive drawn unconnected', async ({
      agentConversation,
      comfyPage,
      page
    }) => {
      test.setTimeout(120_000)

      await test.step('replay the recorded turn so the follower is bound', () =>
        agentConversation.runTurns())

      const before = await graphLinkIds(page)

      await comfyPage.canvasOps.setScale(0.5)
      await comfyPage.canvasOps.setOffset([-1500, -600])

      await test.step('the agent loads a two-node workflow with a link in it', () =>
        agentConversation.pushHostOps([LINKED_INSERT]))

      await test.step('let the insert land', () =>
        agentConversation.waitForPendingFrames(
          ADDITIVE_READINESS_NODE_ID,
          ADDITIVE_READINESS_WIDGET,
          'linked insert landed'
        ))

      await comfyPage.nextFrame()

      const after = await graphLinkIds(page)
      expect(
        after,
        'the insert put no link on the graph, so this spec never reached the rendering question'
      ).toHaveLength(before.length + 1)
      const insertedLinkId = after.find((id) => !before.includes(id))
      expect(insertedLinkId).toBeDefined()

      await expect
        .poll(() => paintedLinkIds(page), { timeout: 15_000 })
        .toContain(insertedLinkId)
      const insertedEndpoints = await page.evaluate((id) => {
        const graph = window.app!.graph
        const link = graph.links.get(id)!
        return {
          fromNode: String(link.origin_id),
          fromSlot: link.origin_slot,
          fromType: graph.getNodeById(link.origin_id)?.type,
          toNode: String(link.target_id),
          toSlot: link.target_slot,
          toType: graph.getNodeById(link.target_id)?.type
        }
      }, toLinkId(insertedLinkId!))
      expect(insertedEndpoints).toEqual({
        fromNode: expect.any(String),
        fromSlot: 1,
        fromType: 'CheckpointLoaderSimple',
        toNode: expect.any(String),
        toSlot: 0,
        toType: 'CLIPTextEncode'
      })
      await expect(
        agentConversation.vueNodes.getOutputSlotRow(
          insertedEndpoints.fromNode,
          insertedEndpoints.fromSlot
        )
      ).toHaveClass(/lg-slot--connected/)
      await expect(
        agentConversation.vueNodes.getInputSlotRow(
          insertedEndpoints.toNode,
          insertedEndpoints.toSlot
        )
      ).toHaveClass(/lg-slot--connected/)
    })
  }
)
