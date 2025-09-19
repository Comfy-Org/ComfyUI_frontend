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
})
