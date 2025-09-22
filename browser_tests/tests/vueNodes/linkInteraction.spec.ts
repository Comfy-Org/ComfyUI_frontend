import type { Locator, Page } from '@playwright/test'

import type { NodeId } from '../../../src/platform/workflow/validation/schemas/workflowSchema'
import { getSlotKey } from '../../../src/renderer/core/layout/slots/slotIdentifier'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../fixtures/ComfyPage'
import { fitToViewInstant } from '../../helpers/fitToView'

async function getCenter(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Slot bounding box not available')
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  }
}

async function getInputLinkDetails(
  page: Page,
  nodeId: NodeId,
  slotIndex: number
) {
  return await page.evaluate(
    ([targetNodeId, targetSlot]) => {
      const app = window['app']
      const graph = app?.canvas?.graph ?? app?.graph
      if (!graph) return null

      const node = graph.getNodeById(targetNodeId)
      if (!node) return null

      const input = node.inputs?.[targetSlot]
      if (!input) return null

      const linkId = input.link
      if (linkId == null) return null

      const link = graph.getLink?.(linkId)
      if (!link) return null

      return {
        id: link.id,
        originId: link.origin_id,
        originSlot:
          typeof link.origin_slot === 'string'
            ? Number.parseInt(link.origin_slot, 10)
            : link.origin_slot,
        targetId: link.target_id,
        targetSlot:
          typeof link.target_slot === 'string'
            ? Number.parseInt(link.target_slot, 10)
            : link.target_slot,
        parentId: link.parentId ?? null
      }
    },
    [nodeId, slotIndex] as const
  )
}

test.describe('Vue Node Link Interaction', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.loadWorkflow('vueNodes/simple-triple')
    await comfyPage.vueNodes.waitForNodes()
    await fitToViewInstant(comfyPage)
  })

  test('should show a link dragging out from a slot when dragging on a slot', async ({
    comfyPage,
    comfyMouse
  }) => {
    const samplerNodes = await comfyPage.getNodeRefsByType('KSampler')
    expect(samplerNodes.length).toBeGreaterThan(0)

    const samplerNode = samplerNodes[0]
    const outputSlot = await samplerNode.getOutput(0)
    await outputSlot.removeLinks()
    await comfyPage.nextFrame()

    const slotKey = getSlotKey(String(samplerNode.id), 0, false)
    const slotLocator = comfyPage.page.locator(`[data-slot-key="${slotKey}"]`)
    await expect(slotLocator).toBeVisible()

    const start = await getCenter(slotLocator)
    const canvasBox = await comfyPage.canvas.boundingBox()
    if (!canvasBox) throw new Error('Canvas bounding box not available')

    // Arbitrary value
    const dragTarget = {
      x: start.x + 180,
      y: start.y - 140
    }

    await comfyMouse.move(start)
    await comfyMouse.drag(dragTarget)
    await comfyPage.nextFrame()

    try {
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-dragging-link.png'
      )
    } finally {
      await comfyMouse.drop()
    }
  })

  test('should create a link when dropping on a compatible slot', async ({
    comfyPage
  }) => {
    const samplerNodes = await comfyPage.getNodeRefsByType('KSampler')
    expect(samplerNodes.length).toBeGreaterThan(0)
    const samplerNode = samplerNodes[0]

    const vaeNodes = await comfyPage.getNodeRefsByType('VAEDecode')
    expect(vaeNodes.length).toBeGreaterThan(0)
    const vaeNode = vaeNodes[0]

    const samplerOutput = await samplerNode.getOutput(0)
    const vaeInput = await vaeNode.getInput(0)

    const outputSlotKey = getSlotKey(String(samplerNode.id), 0, false)
    const inputSlotKey = getSlotKey(String(vaeNode.id), 0, true)

    const outputSlot = comfyPage.page.locator(
      `[data-slot-key="${outputSlotKey}"]`
    )
    const inputSlot = comfyPage.page.locator(
      `[data-slot-key="${inputSlotKey}"]`
    )

    await expect(outputSlot).toBeVisible()
    await expect(inputSlot).toBeVisible()

    await outputSlot.dragTo(inputSlot)
    await comfyPage.nextFrame()

    expect(await samplerOutput.getLinkCount()).toBe(1)
    expect(await vaeInput.getLinkCount()).toBe(1)

    const linkDetails = await comfyPage.page.evaluate((sourceId) => {
      const app = window['app']
      const graph = app?.canvas?.graph ?? app?.graph
      if (!graph) return null

      const source = graph.getNodeById(sourceId)
      if (!source) return null

      const linkId = source.outputs[0]?.links?.[0]
      if (linkId == null) return null

      const link = graph.links[linkId]
      if (!link) return null

      return {
        originId: link.origin_id,
        originSlot: link.origin_slot,
        targetId: link.target_id,
        targetSlot: link.target_slot
      }
    }, samplerNode.id)

    expect(linkDetails).not.toBeNull()
    expect(linkDetails).toMatchObject({
      originId: samplerNode.id,
      originSlot: 0,
      targetId: vaeNode.id,
      targetSlot: 0
    })
  })

  test('should not create a link when slot types are incompatible', async ({
    comfyPage
  }) => {
    const samplerNodes = await comfyPage.getNodeRefsByType('KSampler')
    expect(samplerNodes.length).toBeGreaterThan(0)
    const samplerNode = samplerNodes[0]

    const clipNodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
    expect(clipNodes.length).toBeGreaterThan(0)
    const clipNode = clipNodes[0]

    const samplerOutput = await samplerNode.getOutput(0)
    const clipInput = await clipNode.getInput(0)

    const outputSlotKey = getSlotKey(String(samplerNode.id), 0, false)
    const inputSlotKey = getSlotKey(String(clipNode.id), 0, true)

    const outputSlot = comfyPage.page.locator(
      `[data-slot-key="${outputSlotKey}"]`
    )
    const inputSlot = comfyPage.page.locator(
      `[data-slot-key="${inputSlotKey}"]`
    )

    await expect(outputSlot).toBeVisible()
    await expect(inputSlot).toBeVisible()

    await outputSlot.dragTo(inputSlot)
    await comfyPage.nextFrame()

    expect(await samplerOutput.getLinkCount()).toBe(0)
    expect(await clipInput.getLinkCount()).toBe(0)

    const graphLinkCount = await comfyPage.page.evaluate((sourceId) => {
      const app = window['app']
      const graph = app?.canvas?.graph ?? app?.graph
      if (!graph) return 0

      const source = graph.getNodeById(sourceId)
      if (!source) return 0

      return source.outputs[0]?.links?.length ?? 0
    }, samplerNode.id)

    expect(graphLinkCount).toBe(0)
  })

  test('should not create a link when dropping onto a slot on the same node', async ({
    comfyPage
  }) => {
    const samplerNodes = await comfyPage.getNodeRefsByType('KSampler')
    expect(samplerNodes.length).toBeGreaterThan(0)
    const samplerNode = samplerNodes[0]

    const samplerOutput = await samplerNode.getOutput(0)
    const samplerInput = await samplerNode.getInput(3)

    const outputSlotKey = getSlotKey(String(samplerNode.id), 0, false)
    const inputSlotKey = getSlotKey(String(samplerNode.id), 3, true)

    const outputSlot = comfyPage.page.locator(
      `[data-slot-key="${outputSlotKey}"]`
    )
    const inputSlot = comfyPage.page.locator(
      `[data-slot-key="${inputSlotKey}"]`
    )

    await expect(outputSlot).toBeVisible()
    await expect(inputSlot).toBeVisible()

    await outputSlot.dragTo(inputSlot)
    await comfyPage.nextFrame()

    expect(await samplerOutput.getLinkCount()).toBe(0)
    expect(await samplerInput.getLinkCount()).toBe(0)

    const graphLinkCount = await comfyPage.page.evaluate((sourceId) => {
      const app = window['app']
      const graph = app?.canvas?.graph ?? app?.graph
      if (!graph) return 0

      const source = graph.getNodeById(sourceId)
      if (!source) return 0

      return source.outputs[0]?.links?.length ?? 0
    }, samplerNode.id)

    expect(graphLinkCount).toBe(0)
  })

  test('should reuse the existing origin when dragging an input link', async ({
    comfyPage,
    comfyMouse
  }) => {
    const samplerNodes = await comfyPage.getNodeRefsByType('KSampler')
    const vaeNodes = await comfyPage.getNodeRefsByType('VAEDecode')

    expect(samplerNodes.length).toBeGreaterThan(0)
    expect(vaeNodes.length).toBeGreaterThan(0)

    const samplerNode = samplerNodes[0]
    const vaeNode = vaeNodes[0]

    const samplerOutputKey = getSlotKey(String(samplerNode.id), 0, false)
    const vaeInputKey = getSlotKey(String(vaeNode.id), 0, true)

    const samplerOutputLocator = comfyPage.page.locator(
      `[data-slot-key="${samplerOutputKey}"]`
    )
    const vaeInputLocator = comfyPage.page.locator(
      `[data-slot-key="${vaeInputKey}"]`
    )

    await expect(samplerOutputLocator).toBeVisible()
    await expect(vaeInputLocator).toBeVisible()

    const samplerOutputCenter = await getCenter(samplerOutputLocator)
    const vaeInputCenter = await getCenter(vaeInputLocator)

    await comfyMouse.move(samplerOutputCenter)
    await comfyMouse.drag(vaeInputCenter)
    await comfyMouse.drop()

    const dragTarget = {
      x: vaeInputCenter.x + 160,
      y: vaeInputCenter.y - 100
    }

    await comfyMouse.move(vaeInputCenter)
    await comfyMouse.drag(dragTarget)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-node-input-drag-reuses-origin.png'
    )
    await comfyMouse.drop()
  })

  test('ctrl+alt drag from an input starts a fresh link', async ({
    comfyPage,
    comfyMouse
  }) => {
    const samplerNodes = await comfyPage.getNodeRefsByType('KSampler')
    const vaeNodes = await comfyPage.getNodeRefsByType('VAEDecode')

    expect(samplerNodes.length).toBeGreaterThan(0)
    expect(vaeNodes.length).toBeGreaterThan(0)

    const samplerNode = samplerNodes[0]
    const vaeNode = vaeNodes[0]

    const samplerOutput = await samplerNode.getOutput(0)
    const vaeInput = await vaeNode.getInput(0)

    const samplerOutputKey = getSlotKey(String(samplerNode.id), 0, false)
    const vaeInputKey = getSlotKey(String(vaeNode.id), 0, true)

    const samplerOutputLocator = comfyPage.page.locator(
      `[data-slot-key="${samplerOutputKey}"]`
    )
    const vaeInputLocator = comfyPage.page.locator(
      `[data-slot-key="${vaeInputKey}"]`
    )

    await expect(samplerOutputLocator).toBeVisible()
    await expect(vaeInputLocator).toBeVisible()

    const samplerOutputCenter = await getCenter(samplerOutputLocator)
    const vaeInputCenter = await getCenter(vaeInputLocator)

    await comfyMouse.move(samplerOutputCenter)
    await comfyMouse.drag(vaeInputCenter)
    await comfyMouse.drop()

    await comfyPage.nextFrame()

    const dragTarget = {
      x: vaeInputCenter.x + 140,
      y: vaeInputCenter.y - 110
    }

    await comfyMouse.move(vaeInputCenter)
    await comfyPage.page.keyboard.down('Control')
    await comfyPage.page.keyboard.down('Alt')

    try {
      await comfyMouse.drag(dragTarget)
      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-input-drag-ctrl-alt.png'
      )
    } finally {
      await comfyMouse.drop().catch(() => {})
      await comfyPage.page.keyboard.up('Alt').catch(() => {})
      await comfyPage.page.keyboard.up('Control').catch(() => {})
    }

    await comfyPage.nextFrame()

    // Tcehnically intended to disconnect existing as well
    expect(await vaeInput.getLinkCount()).toBe(0)
    expect(await samplerOutput.getLinkCount()).toBe(0)
  })

  test('dropping an input link back on its slot restores the original connection', async ({
    comfyPage,
    comfyMouse
  }) => {
    const samplerNodes = await comfyPage.getNodeRefsByType('KSampler')
    const vaeNodes = await comfyPage.getNodeRefsByType('VAEDecode')

    expect(samplerNodes.length).toBeGreaterThan(0)
    expect(vaeNodes.length).toBeGreaterThan(0)

    const samplerNode = samplerNodes[0]
    const vaeNode = vaeNodes[0]

    const samplerOutput = await samplerNode.getOutput(0)
    const vaeInput = await vaeNode.getInput(0)

    const samplerOutputKey = getSlotKey(String(samplerNode.id), 0, false)
    const vaeInputKey = getSlotKey(String(vaeNode.id), 0, true)

    const samplerOutputLocator = comfyPage.page.locator(
      `[data-slot-key="${samplerOutputKey}"]`
    )
    const vaeInputLocator = comfyPage.page.locator(
      `[data-slot-key="${vaeInputKey}"]`
    )

    await expect(samplerOutputLocator).toBeVisible()
    await expect(vaeInputLocator).toBeVisible()

    const samplerOutputCenter = await getCenter(samplerOutputLocator)
    const vaeInputCenter = await getCenter(vaeInputLocator)

    await comfyMouse.move(samplerOutputCenter)
    try {
      await comfyMouse.drag(vaeInputCenter)
    } finally {
      await comfyMouse.drop()
    }

    await comfyPage.nextFrame()

    const originalLink = await getInputLinkDetails(
      comfyPage.page,
      vaeNode.id,
      0
    )
    expect(originalLink).not.toBeNull()

    const dragTarget = {
      x: vaeInputCenter.x + 150,
      y: vaeInputCenter.y - 100
    }

    // To prevent needing a screenshot expectation for whether the link's off
    const inputBox = await vaeInputLocator.boundingBox()
    if (!inputBox) throw new Error('Input slot bounding box not available')
    const isOutsideX =
      dragTarget.x < inputBox.x || dragTarget.x > inputBox.x + inputBox.width
    const isOutsideY =
      dragTarget.y < inputBox.y || dragTarget.y > inputBox.y + inputBox.height
    expect(isOutsideX || isOutsideY).toBe(true)

    await comfyMouse.move(vaeInputCenter)
    await comfyMouse.drag(dragTarget)
    await comfyMouse.move(vaeInputCenter)
    await comfyMouse.drop()

    await comfyPage.nextFrame()

    const restoredLink = await getInputLinkDetails(
      comfyPage.page,
      vaeNode.id,
      0
    )

    expect(restoredLink).not.toBeNull()
    if (!restoredLink || !originalLink) {
      throw new Error('Expected both original and restored links to exist')
    }
    expect(restoredLink).toMatchObject({
      originId: originalLink.originId,
      originSlot: originalLink.originSlot,
      targetId: originalLink.targetId,
      targetSlot: originalLink.targetSlot,
      parentId: originalLink.parentId
    })
    expect(await samplerOutput.getLinkCount()).toBe(1)
    expect(await vaeInput.getLinkCount()).toBe(1)
  })

  test('dragging input to input drags existing link', async ({
    comfyPage,
    comfyMouse
  }) => {
    const clipNodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
    const samplerNodes = await comfyPage.getNodeRefsByType('KSampler')

    expect(clipNodes.length).toBeGreaterThan(0)
    expect(samplerNodes.length).toBeGreaterThan(0)

    const clipNode = clipNodes[0]
    const samplerNode = samplerNodes[0]

    // Step 1: Connect CLIP's only output (index 0) to KSampler's second input (index 1)
    const clipOutputKey = getSlotKey(String(clipNode.id), 0, false)
    const samplerInput2ndKey = getSlotKey(String(samplerNode.id), 1, true)

    const clipOutputLocator = comfyPage.page.locator(
      `[data-slot-key="${clipOutputKey}"]`
    )
    const samplerInput2ndLocator = comfyPage.page.locator(
      `[data-slot-key="${samplerInput2ndKey}"]`
    )

    await expect(clipOutputLocator).toBeVisible()
    await expect(samplerInput2ndLocator).toBeVisible()

    await clipOutputLocator.dragTo(samplerInput2ndLocator)
    await comfyPage.nextFrame()

    // Verify initial link exists between CLIP -> KSampler input[1]
    const initialLink = await getInputLinkDetails(
      comfyPage.page,
      samplerNode.id,
      1
    )
    expect(initialLink).not.toBeNull()
    expect(initialLink).toMatchObject({
      originId: clipNode.id,
      targetId: samplerNode.id,
      targetSlot: 1
    })

    // Step 2: Drag from KSampler's second input to its third input (index 2)
    const samplerInput3rdKey = getSlotKey(String(samplerNode.id), 2, true)
    const samplerInput3rdLocator = comfyPage.page.locator(
      `[data-slot-key="${samplerInput3rdKey}"]`
    )
    await expect(samplerInput3rdLocator).toBeVisible()

    const input2Center = await getCenter(samplerInput2ndLocator)
    const input3Center = await getCenter(samplerInput3rdLocator)

    await comfyMouse.move(input2Center)
    await comfyMouse.drag(input3Center)
    await comfyMouse.drop()
    await comfyPage.nextFrame()

    // Expect old link removed from input[1]
    const afterSecondInput = await getInputLinkDetails(
      comfyPage.page,
      samplerNode.id,
      1
    )
    expect(afterSecondInput).toBeNull()

    // Expect new link exists at input[2] from CLIP
    const afterThirdInput = await getInputLinkDetails(
      comfyPage.page,
      samplerNode.id,
      2
    )
    expect(afterThirdInput).not.toBeNull()
    expect(afterThirdInput).toMatchObject({
      originId: clipNode.id,
      targetId: samplerNode.id,
      targetSlot: 2
    })
  })

  test('shift-dragging an output with multiple links should drag all links', async ({
    comfyPage,
    comfyMouse
  }) => {
    const clipNodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
    const samplerNodes = await comfyPage.getNodeRefsByType('KSampler')

    expect(clipNodes.length).toBeGreaterThan(0)
    expect(samplerNodes.length).toBeGreaterThan(0)

    const clipNode = clipNodes[0]
    const samplerNode = samplerNodes[0]

    const clipOutputKey = getSlotKey(String(clipNode.id), 0, false)
    const samplerInputSecondKey = getSlotKey(String(samplerNode.id), 1, true)
    const samplerInputThirdKey = getSlotKey(String(samplerNode.id), 2, true)

    const clipOutputLocator = comfyPage.page.locator(
      `[data-slot-key="${clipOutputKey}"]`
    )
    const samplerInputSecondLocator = comfyPage.page.locator(
      `[data-slot-key="${samplerInputSecondKey}"]`
    )
    const samplerInputThirdLocator = comfyPage.page.locator(
      `[data-slot-key="${samplerInputThirdKey}"]`
    )

    await expect(clipOutputLocator).toBeVisible()
    await expect(samplerInputSecondLocator).toBeVisible()
    await expect(samplerInputThirdLocator).toBeVisible()

    await clipOutputLocator.dragTo(samplerInputSecondLocator)
    await comfyPage.nextFrame()
    await clipOutputLocator.dragTo(samplerInputThirdLocator)
    await comfyPage.nextFrame()

    const clipOutput = await clipNode.getOutput(0)

    expect(await clipOutput.getLinkCount()).toBe(2)

    const outputCenter = await getCenter(clipOutputLocator)
    const dragTarget = {
      x: outputCenter.x + 40,
      y: outputCenter.y - 140
    }

    let dropPending = false
    let shiftHeld = false
    try {
      await comfyMouse.move(outputCenter)
      await comfyPage.page.keyboard.down('Shift')
      shiftHeld = true
      await comfyMouse.drag(dragTarget)
      dropPending = true

      await expect(comfyPage.canvas).toHaveScreenshot(
        'vue-node-shift-output-multi-link.png'
      )
    } finally {
      if (dropPending) {
        await comfyMouse.drop()
      }
      if (shiftHeld) {
        await comfyPage.page.keyboard.up('Shift')
      }
    }
  })
})
