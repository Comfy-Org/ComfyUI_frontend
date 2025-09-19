import type { Locator } from '@playwright/test'

import { getSlotKey } from '../../../src/renderer/core/layout/slots/slotIdentifier'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../fixtures/ComfyPage'

async function getCenter(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Slot bounding box not available')
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2
  }
}

test.describe('Vue Node Link Interaction', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.loadWorkflow('vueNodes/simple-triple')
    await comfyPage.vueNodes.waitForNodes()
    await comfyPage.fitToView()
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
    comfyPage,
    comfyMouse
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

    const start = await getCenter(outputSlot)
    const target = await getCenter(inputSlot)

    await comfyMouse.move(start)

    try {
      await comfyMouse.drag(target)
    } finally {
      await comfyMouse.drop()
    }

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
    comfyPage,
    comfyMouse
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

    const start = await getCenter(outputSlot)
    const target = await getCenter(inputSlot)

    await comfyMouse.move(start)

    try {
      await comfyMouse.drag(target)
    } finally {
      await comfyMouse.drop()
    }

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
    comfyPage,
    comfyMouse
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

    const start = await getCenter(outputSlot)
    const target = await getCenter(inputSlot)

    await comfyMouse.move(start)

    try {
      await comfyMouse.drag(target)
    } finally {
      await comfyMouse.drop()
    }

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
})
