import type { Page } from '@playwright/test'

import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

function addNodeAt(comfyPage: ComfyPage, type: string, x: number, y: number) {
  return comfyPage.nodeOps.addNode(type, undefined, { x, y })
}

function slotLocator(
  page: Page,
  nodeId: NodeId,
  slotIndex: number,
  isInput: boolean
) {
  const key = getSlotKey(String(nodeId), slotIndex, isInput)
  return page.locator(`[data-slot-key="${key}"]`)
}

async function dragSlotToSlot(
  page: Page,
  from: { nodeId: NodeId; index: number; isInput: boolean },
  to: { nodeId: NodeId; index: number; isInput: boolean },
  nextFrame: () => Promise<void>
) {
  const fromLoc = slotLocator(page, from.nodeId, from.index, from.isInput)
  const toLoc = slotLocator(page, to.nodeId, to.index, to.isInput)
  await expect(fromLoc).toBeVisible()
  await expect(toLoc).toBeVisible()
  // oxlint-disable-next-line playwright/no-force-option -- slot dot's parent wrapper intercepts actionability checks on the inner dot
  await fromLoc.dragTo(toLoc, { force: true })
  await nextFrame()
}

async function slotCenter(
  page: Page,
  nodeId: NodeId,
  slotIndex: number,
  isInput: boolean
) {
  const locator = slotLocator(page, nodeId, slotIndex, isInput)
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  if (!box) throw new Error('Slot bounding box not available')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function getDraggingLinkCount(page: Page): Promise<number> {
  return await page.evaluate(
    () => window.app?.canvas?.linkConnector?.renderLinks.length ?? 0
  )
}

async function countNodesByType(page: Page, type: string): Promise<number> {
  return await page.evaluate((nodeType) => {
    const graph = window.app?.canvas?.graph ?? window.app?.graph
    return graph?.nodes.filter((node) => node.type === nodeType).length ?? 0
  }, type)
}

async function getInputOriginId(
  page: Page,
  nodeId: NodeId,
  slotIndex: number
): Promise<NodeId | null> {
  return await page.evaluate(
    ([targetNodeId, targetSlot]) => {
      const graph = window.app?.canvas?.graph ?? window.app?.graph
      const node = graph?.getNodeById(targetNodeId)
      const linkId = node?.inputs?.[targetSlot]?.link
      if (linkId == null) return null
      return graph?.getLink?.(linkId)?.origin_id ?? null
    },
    [nodeId, slotIndex] as const
  )
}

async function getConnectedInputOriginIds(
  page: Page,
  nodeId: NodeId
): Promise<NodeId[]> {
  return await page.evaluate((targetNodeId) => {
    const graph = window.app?.canvas?.graph ?? window.app?.graph
    const node = graph?.getNodeById(targetNodeId)
    if (!node) return []
    const origins: NodeId[] = []
    for (const input of node.inputs ?? []) {
      const linkId = input.link
      if (linkId == null) continue
      const link = graph?.getLink?.(linkId)
      if (link) origins.push(link.origin_id)
    }
    return origins
  }, nodeId)
}

function sortedNumbers(ids: NodeId[]): number[] {
  return ids.map(Number).sort((a, b) => a - b)
}

test.describe(
  'Multi-node fan-out link connections',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('forward: dragging one selected image output onto an input batches all selected outputs', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      const loadImage1 = await addNodeAt(comfyPage, 'LoadImage', 0, 0)
      const loadImage2 = await addNodeAt(comfyPage, 'LoadImage', 0, 450)
      const loadImage3 = await addNodeAt(comfyPage, 'LoadImage', 0, 900)
      const preview = await addNodeAt(comfyPage, 'PreviewImage', 600, 300)

      await comfyPage.vueNodes.waitForNodes(4)
      await fitToViewInstant(comfyPage)

      await comfyPage.vueNodes.selectNodes([
        String(loadImage1.id),
        String(loadImage2.id),
        String(loadImage3.id)
      ])

      await dragSlotToSlot(
        page,
        { nodeId: loadImage1.id, index: 0, isInput: false },
        { nodeId: preview.id, index: 0, isInput: true },
        () => comfyPage.nextFrame()
      )

      await expect.poll(() => countNodesByType(page, 'BatchImagesNode')).toBe(1)

      const batchNode = (
        await comfyPage.nodeOps.getNodeRefsByType('BatchImagesNode')
      )[0]

      await expect
        .poll(() => getInputOriginId(page, preview.id, 0))
        .toBe(batchNode.id)

      await expect
        .poll(() =>
          getConnectedInputOriginIds(page, batchNode.id).then(sortedNumbers)
        )
        .toEqual(sortedNumbers([loadImage1.id, loadImage2.id, loadImage3.id]))
    })

    test('reverse: dragging one selected input onto an upstream output connects every selected input', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      const loadImage = await addNodeAt(comfyPage, 'LoadImage', 0, 450)
      const preview1 = await addNodeAt(comfyPage, 'PreviewImage', 600, 0)
      const preview2 = await addNodeAt(comfyPage, 'PreviewImage', 600, 450)
      const preview3 = await addNodeAt(comfyPage, 'PreviewImage', 600, 900)

      await comfyPage.vueNodes.waitForNodes(4)
      await fitToViewInstant(comfyPage)

      await comfyPage.vueNodes.selectNodes([
        String(preview1.id),
        String(preview2.id),
        String(preview3.id)
      ])

      await dragSlotToSlot(
        page,
        { nodeId: preview1.id, index: 0, isInput: true },
        { nodeId: loadImage.id, index: 0, isInput: false },
        () => comfyPage.nextFrame()
      )

      const loadOutput = await loadImage.getOutput(0)
      await expect.poll(() => loadOutput.getLinkCount()).toBe(3)

      for (const preview of [preview1, preview2, preview3]) {
        await expect
          .poll(() => getInputOriginId(page, preview.id, 0))
          .toBe(loadImage.id)
      }
    })

    test('does not fan the drag UI when dragging a non-image output', async ({
      comfyPage,
      comfyMouse
    }) => {
      const page = comfyPage.page
      const clip1 = await addNodeAt(comfyPage, 'CLIPTextEncode', 0, 0)
      const clip2 = await addNodeAt(comfyPage, 'CLIPTextEncode', 0, 450)

      await comfyPage.vueNodes.waitForNodes(2)
      await fitToViewInstant(comfyPage)

      await comfyPage.vueNodes.selectNodes([String(clip1.id), String(clip2.id)])

      const start = await slotCenter(page, clip1.id, 0, false)
      await comfyMouse.move(start)
      await comfyMouse.drag({ x: start.x + 200, y: start.y + 80 })
      await comfyPage.nextFrame()

      try {
        await expect.poll(() => getDraggingLinkCount(page)).toBe(1)
      } finally {
        await comfyMouse.drop()
      }
    })

    test('forward: connects directly into a dynamic input instead of creating a batch node', async ({
      comfyPage
    }) => {
      const page = comfyPage.page
      const batch = await addNodeAt(comfyPage, 'BatchImagesNode', 600, 200)
      const loadImage1 = await addNodeAt(comfyPage, 'LoadImage', 0, 0)
      const loadImage2 = await addNodeAt(comfyPage, 'LoadImage', 0, 450)
      const loadImage3 = await addNodeAt(comfyPage, 'LoadImage', 0, 900)

      await comfyPage.vueNodes.waitForNodes(4)
      await fitToViewInstant(comfyPage)

      await comfyPage.vueNodes.selectNodes([
        String(loadImage1.id),
        String(loadImage2.id),
        String(loadImage3.id)
      ])

      await dragSlotToSlot(
        page,
        { nodeId: loadImage1.id, index: 0, isInput: false },
        { nodeId: batch.id, index: 0, isInput: true },
        () => comfyPage.nextFrame()
      )

      await expect.poll(() => countNodesByType(page, 'BatchImagesNode')).toBe(1)
      await expect
        .poll(() =>
          getConnectedInputOriginIds(page, batch.id).then(sortedNumbers)
        )
        .toEqual(sortedNumbers([loadImage1.id, loadImage2.id, loadImage3.id]))
    })
  }
)
