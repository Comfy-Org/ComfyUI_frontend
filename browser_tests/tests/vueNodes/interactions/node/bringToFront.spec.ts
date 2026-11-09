import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'
import { screenshotRegion } from '@e2e/fixtures/utils/screenshotRegion'

test.describe(
  'Vue Node Bring to Front',
  { tag: ['@screenshot', '@vue-nodes'] },
  () => {
    test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/simple-triple')
      await fitToViewInstant(comfyPage)
    })

    /**
     * Helper to get the z-index of a node by its title
     */
    async function getNodeZIndex(
      comfyPage: ComfyPage,
      title: string
    ): Promise<number> {
      const node = comfyPage.vueNodes.getNodeByTitle(title)
      const style = await node.getAttribute('style')
      const match = style?.match(/z-index:\s*(\d+)/)
      return match ? parseInt(match[1], 10) : Number.NaN
    }

    /**
     * Helper to get the bounding box center of a node
     */
    async function getNodeCenter(
      comfyPage: ComfyPage,
      title: string
    ): Promise<{ x: number; y: number }> {
      const node = comfyPage.vueNodes.getNodeByTitle(title)
      const box = await node.boundingBox()
      if (!box) throw new Error(`Node "${title}" not found`)
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }

    test('should bring overlapped node to front when clicking on it', async ({
      comfyPage
    }) => {
      const clipCenter = await getNodeCenter(comfyPage, 'CLIP Text Encode')
      const ksamplerHeader = await comfyPage.page
        .getByText('KSampler')
        .boundingBox()
      if (!ksamplerHeader) throw new Error('KSampler header not found')

      await comfyPage.canvasOps.dragAndDrop(
        { x: ksamplerHeader.x + 50, y: ksamplerHeader.y + 10 },
        clipCenter
      )
      await comfyPage.nextFrame()

      const region = await screenshotRegion(comfyPage.page, [
        comfyPage.vueNodes.getNodeByTitle('KSampler'),
        comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode')
      ])
      await region.expectScreenshot('bring-to-front-overlapped-before.png')

      await expect
        .poll(async () => {
          const ksamplerZ = await getNodeZIndex(comfyPage, 'KSampler')
          const clipZ = await getNodeZIndex(comfyPage, 'CLIP Text Encode')
          return ksamplerZ - clipZ
        })
        .toBeGreaterThan(0)

      const clipNode = comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode')
      const clipBox = await clipNode.boundingBox()
      if (!clipBox) throw new Error('CLIP node not found')

      await comfyPage.page.mouse.click(clipBox.x + 30, clipBox.y + 10)
      await comfyPage.nextFrame()

      await expect
        .poll(async () => {
          const clipZ = await getNodeZIndex(comfyPage, 'CLIP Text Encode')
          const ksamplerZ = await getNodeZIndex(comfyPage, 'KSampler')
          return clipZ - ksamplerZ
        })
        .toBeGreaterThan(0)

      const clipZ = await getNodeZIndex(comfyPage, 'CLIP Text Encode')
      const allZIndexes = await comfyPage.vueNodes.nodes.evaluateAll((nodes) =>
        nodes.map((node) => Number(getComputedStyle(node).zIndex))
      )
      expect(clipZ).toBe(Math.max(...allZIndexes))

      await region.expectScreenshot('bring-to-front-overlapped-after.png')
    })

    test('should bring overlapped node to front when clicking on its widget', async ({
      comfyPage
    }) => {
      const clipCenter = await getNodeCenter(comfyPage, 'CLIP Text Encode')

      const vaeHeader = await comfyPage.page
        .getByText('VAE Decode')
        .boundingBox()
      if (!vaeHeader) throw new Error('VAE Decode header not found')

      await comfyPage.canvasOps.dragAndDrop(
        { x: vaeHeader.x + 50, y: vaeHeader.y + 10 },
        { x: clipCenter.x - 50, y: clipCenter.y }
      )
      await comfyPage.nextFrame()

      await expect
        .poll(async () => {
          const vaeZ = await getNodeZIndex(comfyPage, 'VAE Decode')
          const clipZ = await getNodeZIndex(comfyPage, 'CLIP Text Encode')
          return vaeZ - clipZ
        })
        .toBeGreaterThan(0)

      const region = await screenshotRegion(comfyPage.page, [
        comfyPage.vueNodes.getNodeByTitle('VAE Decode'),
        comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode')
      ])
      await region.expectScreenshot(
        'bring-to-front-widget-overlapped-before.png'
      )

      const clipNode = comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode')
      const clipBox = await clipNode.boundingBox()
      if (!clipBox) throw new Error('CLIP node not found')
      await comfyPage.page.mouse.click(clipBox.x + 170, clipBox.y + 80)
      await comfyPage.nextFrame()

      await expect
        .poll(async () => {
          const clipZ = await getNodeZIndex(comfyPage, 'CLIP Text Encode')
          const vaeZ = await getNodeZIndex(comfyPage, 'VAE Decode')
          return clipZ - vaeZ
        })
        .toBeGreaterThan(0)

      await region.expectScreenshot(
        'bring-to-front-widget-overlapped-after.png'
      )
    })
  }
)
