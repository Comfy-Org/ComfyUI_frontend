import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

async function getDraggingLinkCount(page: Page): Promise<number> {
  return await page.evaluate(
    () => window.app?.canvas?.linkConnector?.renderLinks.length ?? 0
  )
}

async function addNode(cpage: ComfyPage, name: string, x: number, y: number) {
  return await cpage.searchBoxV2.addNode(name, { position: { x, y } })
}

test.describe(
  'Multi-node fan-out link connections',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test('forward: dragging one selected image output onto an input batches all selected outputs', async ({
      comfyPage
    }) => {
      const loadImage1 = await addNode(comfyPage, 'Load Image', 100, 100)
      const loadImage2 = await addNode(comfyPage, 'Load Image', 400, 100)
      const loadImage3 = await addNode(comfyPage, 'Load Image', 100, 500)
      const preview = await addNode(comfyPage, 'Preview Image', 900, 300)
      await fitToViewInstant(comfyPage)

      await loadImage1.select()
      await comfyPage.page.keyboard.down('Shift')
      await loadImage2.select()
      await loadImage3.select()
      await comfyPage.page.keyboard.up('Shift')

      await loadImage1.getSlot(/IMAGE/).dragTo(preview.getSlot())

      const batchNode =
        await comfyPage.vueNodes.getFixtureByTitle('Batch Images')
      await expect(batchNode.root).toBeVisible()

      expect(await batchNode.isConnectedTo(preview)).toBe(true)
      expect(await loadImage1.isConnectedTo(batchNode)).toBe(true)
      expect(await loadImage2.isConnectedTo(batchNode)).toBe(true)
      expect(await loadImage3.isConnectedTo(batchNode)).toBe(true)
    })

    test('reverse: dragging one selected input onto an upstream output connects every selected input', async ({
      comfyPage
    }) => {
      const loadImage = await addNode(comfyPage, 'Load Image', 100, 100)
      const preview1 = await addNode(comfyPage, 'Preview Image', 600, 100)
      const preview2 = await addNode(comfyPage, 'Preview Image', 900, 100)
      const preview3 = await addNode(comfyPage, 'Preview Image', 900, 500)
      await fitToViewInstant(comfyPage)

      await preview1.select()
      await comfyPage.page.keyboard.down('Shift')
      await preview2.select()
      await preview3.select()
      await comfyPage.page.keyboard.up('Shift')

      await preview1.getSlot().dragTo(loadImage.getSlot(/IMAGE/))
      await expect.poll(() => loadImage.isConnectedTo(preview1)).toBe(true)
      expect(await loadImage.isConnectedTo(preview2)).toBe(true)
      expect(await loadImage.isConnectedTo(preview3)).toBe(true)
      await expect(comfyPage.vueNodes.nodes).toHaveCount(4)
    })

    test('does not fan the drag UI when dragging a non-image output', async ({
      comfyPage,
      comfyMouse
    }) => {
      const clip1 = await addNode(comfyPage, 'CLIP Text Encode', 100, 100)
      const clip2 = await addNode(comfyPage, 'CLIP Text Encode', 100, 500)
      await fitToViewInstant(comfyPage)

      await clip1.select()
      await comfyPage.page.keyboard.down('Shift')
      await clip2.select()
      await comfyPage.page.keyboard.up('Shift')

      const start = await comfyPage.centerPoint(clip1.getSlot('CONDITIONING'))
      await comfyMouse.move(start)
      await comfyMouse.drag({ x: start.x + 200, y: start.y + 80 })
      await comfyPage.nextFrame()

      await expect.poll(() => getDraggingLinkCount(comfyPage.page)).toBe(1)
    })

    test('forward: connects directly into a dynamic input instead of creating a batch node', async ({
      comfyPage
    }) => {
      const batch = await addNode(comfyPage, 'Batch Images', 900, 300)
      const loadImage1 = await addNode(comfyPage, 'Load Image', 100, 100)
      const loadImage2 = await addNode(comfyPage, 'Load Image', 400, 100)
      const loadImage3 = await addNode(comfyPage, 'Load Image', 100, 500)

      await comfyPage.vueNodes.waitForNodes(4)
      await fitToViewInstant(comfyPage)

      await loadImage1.select()
      await comfyPage.page.keyboard.down('Shift')
      await loadImage2.select()
      await loadImage3.select()
      await comfyPage.page.keyboard.up('Shift')

      await loadImage1.getSlot(/IMAGE/).dragTo(batch.getSlot('image0'))

      const batchNode = comfyPage.vueNodes.getNodeByTitle('Batch Images')
      await expect(batchNode).toBeVisible()
      await expect.poll(() => loadImage1.isConnectedTo(batch)).toBe(true)
      expect(await loadImage2.isConnectedTo(batch)).toBe(true)
      expect(await loadImage3.isConnectedTo(batch)).toBe(true)
    })
  }
)
