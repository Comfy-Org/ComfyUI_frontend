import type { Locator } from '@playwright/test'

import { toNodeId } from '@/types/nodeId'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

const WORKFLOW = 'subgraphs/subgraph-promoted-int-text-with-primitives'
const HOST_ID = '1'
const PRIMITIVE_STRING_ID = '3'
const PLAIN_TEXT_ENCODE_ID = '5'
const HOST_TEXT_INPUT = 0
const PLAIN_TEXT_INPUT = 1

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

async function wireFirstOutputInto(
  comfyPage: ComfyPage,
  sourceId: string,
  targetId: string,
  targetInput: number
) {
  const from = comfyPage.vueNodes.getOutputSlotConnectionDot(sourceId, 0)
  const to = comfyPage.vueNodes.getInputSlotConnectionDot(targetId, targetInput)
  await comfyPage.canvasOps.dragAndDrop(
    await centerOf(from),
    await centerOf(to)
  )
  await expect
    .poll(() => isInputConnected(comfyPage, targetId, targetInput))
    .toBe(true)
}

test.describe(
  'Subgraph promoted widget with an external link',
  { tag: ['@subgraph', '@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
    })

    for (const [label, targetId, textInput] of [
      ['promoted subgraph host', HOST_ID, HOST_TEXT_INPUT],
      ['plain CLIPTextEncode', PLAIN_TEXT_ENCODE_ID, PLAIN_TEXT_INPUT]
    ] as const) {
      test(`hides the text control after a String is wired into the ${label}`, async ({
        comfyPage
      }) => {
        const node = comfyPage.vueNodes.getNodeLocator(targetId)
        const textarea = node.getByRole('textbox', {
          name: 'text',
          exact: true
        })
        await expect(textarea).toBeVisible()

        await wireFirstOutputInto(
          comfyPage,
          PRIMITIVE_STRING_ID,
          targetId,
          textInput
        )

        await expect(textarea).toHaveCount(0)
        await expect(node.getByLabel('text', { exact: true })).toBeVisible()
      })
    }
  }
)
