import { expect } from '@playwright/test'
import type { Locator, TestInfo } from '@playwright/test'

import { toNodeId } from '@/types/nodeId'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

const WORKFLOW = 'subgraphs/subgraph-promoted-int-text-with-primitives'
const HOST_ID = '1'
const PRIMITIVE_INT_ID = '2'
const PRIMITIVE_STRING_ID = '3'
const PLAIN_LATENT_ID = '4'
const PLAIN_TEXT_ENCODE_ID = '5'
const HOST_TEXT_INPUT = 0
const HOST_WIDTH_INPUT = 1
const PLAIN_WIDTH_INPUT = 0
const PLAIN_TEXT_INPUT = 1
const ENDPOINT_TOLERANCE_PX = 2
/** Canvas pixel below every node in the asset; clicking it also lets the change tracker capture the drag-connect. */
const EMPTY_CANVAS_POSITION = { x: 640, y: 690 }

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

    // Legacy canvas keeps the row and its name for a connection-suppressed
    // widget (occupiesCanvasRow). The Vue node collapses the row to a bare dot,
    // which reads as the widget vanishing. Reproduces on the promoted host AND
    // on a plain node, so this half of the report is not subgraph-specific.
    for (const [label, targetId, targetInput] of [
      ['promoted subgraph host', HOST_ID, HOST_WIDTH_INPUT],
      ['plain EmptyLatentImage', PLAIN_LATENT_ID, PLAIN_WIDTH_INPUT]
    ] as const) {
      test(`keeps the width label visible after an Int is wired into the ${label}`, async ({
        comfyPage
      }, testInfo) => {
        test.fail(true, 'connection-suppressed width row loses its label')
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

    // Subgraph-specific half of the report: the promoted text host widget is a
    // DOM widget whose connectionSuppressed flag never reaches the store the
    // Vue renderer reads, so the textarea stays editable while the wire lands.
    test('hides the promoted text control after a String is wired into the host', async ({
      comfyPage
    }, testInfo) => {
      test.fail(
        true,
        'promoted textarea stays visible while its input is linked'
      )
      const host = comfyPage.vueNodes.getNodeLocator(HOST_ID)
      const textarea = host.getByRole('textbox', { name: 'text', exact: true })
      await expect(textarea).toBeVisible()

      await wireFirstOutputInto(
        comfyPage,
        PRIMITIVE_STRING_ID,
        HOST_ID,
        HOST_TEXT_INPUT
      )

      await attachNodeScreenshot(testInfo, host, 'after-wire.png')
      await expect(textarea).toHaveCount(0)
      await expect(
        host.locator('.lg-slot--input[aria-label="text"]')
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

    // Redo reloads the graph; afterwards litegraph draws the wire end 38px
    // away from the slot dot the promoted width row renders.
    test('keeps the wire on the promoted width slot dot after undo and redo', async ({
      comfyPage
    }, testInfo) => {
      test.fail(true, 'wire end drifts off the promoted width slot after redo')
      await wireFirstOutputInto(
        comfyPage,
        PRIMITIVE_INT_ID,
        HOST_ID,
        HOST_WIDTH_INPUT
      )
      await expect
        .poll(() =>
          wireEndpointOffsetFromSlotDot(comfyPage, HOST_ID, HOST_WIDTH_INPUT)
        )
        .toBeLessThanOrEqual(ENDPOINT_TOLERANCE_PX)

      await comfyPage.canvas.click({ position: EMPTY_CANVAS_POSITION })
      await comfyPage.keyboard.undo()
      await expect
        .poll(() => isInputConnected(comfyPage, HOST_ID, HOST_WIDTH_INPUT))
        .toBe(false)
      await expect(
        comfyPage.vueNodes
          .getNodeLocator(HOST_ID)
          .getByLabel('width', { exact: true })
      ).toBeVisible()

      await comfyPage.canvas.click({ position: EMPTY_CANVAS_POSITION })
      await comfyPage.keyboard.redo()
      await expect
        .poll(() => isInputConnected(comfyPage, HOST_ID, HOST_WIDTH_INPUT))
        .toBe(true)
      await testInfo.attach('after-redo.png', {
        body: await comfyPage.page.screenshot(),
        contentType: 'image/png'
      })
      await expect
        .poll(
          () =>
            wireEndpointOffsetFromSlotDot(comfyPage, HOST_ID, HOST_WIDTH_INPUT),
          { message: 'wire end drifted off the width slot after redo' }
        )
        .toBeLessThanOrEqual(ENDPOINT_TOLERANCE_PX)
    })
  }
)
