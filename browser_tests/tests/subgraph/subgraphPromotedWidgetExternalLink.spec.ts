import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { expect } from '@playwright/test'
import type { Locator, TestInfo } from '@playwright/test'

import { toNodeId } from '@/types/nodeId'

const WORKFLOW = 'subgraphs/subgraph-promoted-int-text-with-primitives'
const HOST_ID = '1'
const PRIMITIVE_INT_ID = '2'
const PRIMITIVE_STRING_ID = '3'
const PLAIN_LATENT_ID = '4'
const PLAIN_TEXT_ENCODE_ID = '5'
const HOST_TEXT_INPUT = 0
const HOST_WIDTH_INPUT = 1
const PLAIN_WIDTH_INPUT = 0
const PLAIN_BATCH_SIZE_INPUT = 2
const PLAIN_TEXT_INPUT = 1
const ENDPOINT_TOLERANCE_PX = 2
/** Canvas pixel below every node in the asset; clicking it also lets the change tracker capture the drag-connect. */
const EMPTY_CANVAS_POSITION = { x: 640, y: 690 }
/** A second empty pixel: clicking the first one again within the double-click window opens node search and swallows the redo shortcut. */
const SECOND_EMPTY_CANVAS_POSITION = { x: 900, y: 690 }

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

/** Vertical gap between where litegraph draws the wire end and the slot dot the row renders. */
async function wireEndpointOffsetFromSlotDot(
  comfyPage: ComfyPage,
  nodeId: string,
  slot: number
) {
  const dot = comfyPage.vueNodes.getInputSlotConnectionDot(nodeId, slot)
  const dotCenter = await centerOf(dot)
  const endpointY = await comfyPage.page.evaluate(
    ([id, slot]) => {
      const node = window.app!.graph.getNodeById(id)!
      const canvasRect = document
        .getElementById('graph-canvas')!
        .getBoundingClientRect()
      const [, y] = window.app!.canvas.ds.convertOffsetToCanvas(
        node.getInputPos(slot)
      )
      return canvasRect.y + y
    },
    [toNodeId(nodeId), slot] as const
  )
  return Math.abs(endpointY - dotCenter.y)
}

async function attachNodeScreenshot(
  testInfo: TestInfo,
  node: Locator,
  name: string
) {
  await testInfo.attach(name, {
    body: await node.screenshot(),
    contentType: 'image/png'
  })
}

test.describe(
  'Subgraph promoted widget with an external link',
  { tag: ['@subgraph', '@vue-nodes', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)
    })

    for (const [label, targetId, targetInput] of [
      ['promoted subgraph host', HOST_ID, HOST_WIDTH_INPUT],
      ['plain EmptyLatentImage', PLAIN_LATENT_ID, PLAIN_WIDTH_INPUT]
    ] as const) {
      test(`keeps the width label visible after an Int is wired into the ${label}`, async ({
        comfyPage
      }, testInfo) => {
        const node = comfyPage.vueNodes.getNodeLocator(targetId)
        const widthLabel = node.getByText('width', { exact: true })
        await expect(widthLabel).toBeVisible()
        await attachNodeScreenshot(testInfo, node, 'before-wire.png')

        await wireFirstOutputInto(
          comfyPage,
          PRIMITIVE_INT_ID,
          targetId,
          targetInput
        )

        await expect(
          comfyPage.vueNodes.getInputSlotConnectionDot(targetId, targetInput),
          'the linked width slot dot keeps anchoring the wire'
        ).toBeVisible()
        await attachNodeScreenshot(testInfo, node, 'after-wire.png')
        await expect(widthLabel).toBeVisible()
      })
    }

    test('keeps the promoted text control visible and disabled after a String is wired into the host', async ({
      comfyPage
    }, testInfo) => {
      const host = comfyPage.vueNodes.getNodeLocator(HOST_ID)
      const textarea = host.getByRole('textbox', { name: 'text', exact: true })
      await expect(textarea).toBeVisible()
      await expect(textarea).toBeEnabled()

      await wireFirstOutputInto(
        comfyPage,
        PRIMITIVE_STRING_ID,
        HOST_ID,
        HOST_TEXT_INPUT
      )

      await attachNodeScreenshot(testInfo, host, 'after-wire.png')
      await expect(textarea).toBeVisible()
      await expect(textarea).toBeDisabled()
      await expect(
        comfyPage.vueNodes.getInputSlotConnectionDot(HOST_ID, HOST_TEXT_INPUT)
      ).toBeVisible()
    })

    test('hides the text control after a String is wired into a plain CLIPTextEncode', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeLocator(PLAIN_TEXT_ENCODE_ID)
      const textarea = node.getByRole('textbox', { name: 'text', exact: true })
      await expect(textarea).toBeVisible()

      await wireFirstOutputInto(
        comfyPage,
        PRIMITIVE_STRING_ID,
        PLAIN_TEXT_ENCODE_ID,
        PLAIN_TEXT_INPUT
      )

      await expect(textarea).toHaveCount(0)
      await expect(
        node.locator('.lg-slot--input[aria-label="text"]')
      ).toBeVisible()
    })

    // Undo and redo reload the whole graph. The reload drops every DOM-measured
    // slot offset while the Vue node stays mounted with identical rows, so
    // litegraph falls back to its own widget layout and draws the wire end on
    // the wrong row. Reproduces on the promoted host AND on a plain node.
    for (const [label, targetId, targetInput, slotName] of [
      ['promoted subgraph host', HOST_ID, HOST_WIDTH_INPUT, 'width'],
      [
        'plain EmptyLatentImage',
        PLAIN_LATENT_ID,
        PLAIN_BATCH_SIZE_INPUT,
        'batch_size'
      ]
    ] as const) {
      test(`keeps the wire on the ${label} slot dot after undo and redo`, async ({
        comfyPage
      }) => {
        await wireFirstOutputInto(
          comfyPage,
          PRIMITIVE_INT_ID,
          targetId,
          targetInput
        )
        await expect
          .poll(() =>
            wireEndpointOffsetFromSlotDot(comfyPage, targetId, targetInput)
          )
          .toBeLessThanOrEqual(ENDPOINT_TOLERANCE_PX)

        await comfyPage.canvas.click({ position: EMPTY_CANVAS_POSITION })
        await comfyPage.keyboard.undo()
        await expect
          .poll(() => isInputConnected(comfyPage, targetId, targetInput))
          .toBe(false)
        await expect(
          comfyPage.vueNodes
            .getNodeLocator(targetId)
            .getByLabel(slotName, { exact: true })
        ).toBeVisible()

        await comfyPage.canvas.click({ position: SECOND_EMPTY_CANVAS_POSITION })
        await comfyPage.keyboard.redo()
        await expect
          .poll(() => isInputConnected(comfyPage, targetId, targetInput))
          .toBe(true)
        await expect
          .poll(
            () =>
              wireEndpointOffsetFromSlotDot(comfyPage, targetId, targetInput),
            { message: `wire end drifted off the ${slotName} slot after redo` }
          )
          .toBeLessThanOrEqual(ENDPOINT_TOLERANCE_PX)
      })
    }
  }
)
