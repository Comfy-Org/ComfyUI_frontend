import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { Locator } from '@playwright/test'

import { toNodeId } from '@/types/nodeId'

const WORKFLOW = 'subgraphs/subgraph-promoted-int-text-with-primitives'
const HOST_ID = '1'
const PRIMITIVE_INT_ID = '2'
const PLAIN_LATENT_ID = '4'
const HOST_WIDTH_INPUT = 1
const PLAIN_WIDTH_INPUT = 0

async function centerOf(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected the slot dot to have a bounding box')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function isInputConnected(
  comfyPage: ComfyPage,
  nodeId: string,
  slot: number
) {
  return comfyPage.page.evaluate(
    ([id, slot]) =>
      window.app!.graph.getNodeById(id)?.isInputConnected(slot) ?? false,
    [toNodeId(nodeId), slot] as const
  )
}

test.describe(
  'Connected widget row label',
  { tag: ['@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
    })

    for (const [label, targetId, widthInput] of [
      ['promoted subgraph host', HOST_ID, HOST_WIDTH_INPUT],
      ['plain EmptyLatentImage', PLAIN_LATENT_ID, PLAIN_WIDTH_INPUT]
    ] as const) {
      test(`keeps the width label visible after an Int is wired into the ${label}`, async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator(targetId)
        const widthLabel = node.getByText('width', { exact: true })
        const widthDot = comfyPage.vueNodes.getInputSlotConnectionDot(
          targetId,
          widthInput
        )
        await expect(widthLabel).toBeVisible()

        await comfyPage.canvasOps.dragAndDrop(
          await centerOf(
            comfyPage.vueNodes.getOutputSlotConnectionDot(PRIMITIVE_INT_ID, 0)
          ),
          await centerOf(widthDot)
        )
        await expect
          .poll(() => isInputConnected(comfyPage, targetId, widthInput))
          .toBe(true)

        await expect(widthDot).toBeVisible()
        await expect(widthLabel).toBeVisible()
      })
    }
  }
)
