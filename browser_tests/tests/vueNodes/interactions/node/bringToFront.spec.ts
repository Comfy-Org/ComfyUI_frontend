import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { fitToViewInstant } from '@e2e/fixtures/utils/fitToView'

test.describe(
  'Vue Node Bring to Front',
  { tag: ['@screenshot', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.workflow.loadWorkflow('vueNodes/simple-triple')
      await fitToViewInstant(comfyPage)
    })

    test('should bring overlapped node to front when clicking on it', async ({
      comfyPage
    }) => {
      // Get initial positions
      const clipCenter =
        await comfyPage.vueNodes.getNodeCenter('CLIP Text Encode')
      const ksamplerHeader = await comfyPage.page
        .getByText('KSampler')
        .boundingBox()
      if (!ksamplerHeader) throw new Error('KSampler header not found')

      // Drag KSampler on top of CLIP Text Encode
      await comfyPage.canvasOps.dragAndDrop(
        { x: ksamplerHeader.x + 50, y: ksamplerHeader.y + 10 },
        clipCenter
      )
      await comfyPage.nextFrame()

      // Screenshot showing KSampler on top of CLIP
      await expect(comfyPage.canvas).toHaveScreenshot(
        'bring-to-front-overlapped-before.png'
      )

      // KSampler should be on top after being dragged
      await expect
        .poll(async () => {
          const ksamplerOrder =
            await comfyPage.vueNodes.getNodePaintOrder('KSampler')
          const clipOrder =
            await comfyPage.vueNodes.getNodePaintOrder('CLIP Text Encode')
          return ksamplerOrder - clipOrder
        })
        .toBeGreaterThan(0)

      // Click on CLIP Text Encode (underneath) - need to click on a visible part
      // Since KSampler is on top, we click on the edge of CLIP that should still be visible
      const clipNode = comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode')
      const clipBox = await clipNode.boundingBox()
      if (!clipBox) throw new Error('CLIP node not found')

      // Click on a visible edge of CLIP
      await comfyPage.page.mouse.click(clipBox.x + 30, clipBox.y + 10)
      await comfyPage.nextFrame()

      // CLIP should now be on top
      await expect
        .poll(async () => {
          const clipOrder =
            await comfyPage.vueNodes.getNodePaintOrder('CLIP Text Encode')
          const ksamplerOrder =
            await comfyPage.vueNodes.getNodePaintOrder('KSampler')
          return clipOrder - ksamplerOrder
        })
        .toBeGreaterThan(0)

      // Screenshot showing CLIP now on top
      await expect(comfyPage.canvas).toHaveScreenshot(
        'bring-to-front-overlapped-after.png'
      )
    })

    test('should bring overlapped node to front when clicking on its widget', async ({
      comfyPage
    }) => {
      // Get CLIP Text Encode position (it has a text widget)
      const clipCenter =
        await comfyPage.vueNodes.getNodeCenter('CLIP Text Encode')

      // Get VAE Decode position and drag it on top of CLIP
      const vaeHeader = await comfyPage.page
        .getByText('VAE Decode')
        .boundingBox()
      if (!vaeHeader) throw new Error('VAE Decode header not found')

      await comfyPage.canvasOps.dragAndDrop(
        { x: vaeHeader.x + 50, y: vaeHeader.y + 10 },
        { x: clipCenter.x - 50, y: clipCenter.y }
      )
      await comfyPage.nextFrame()

      // VAE should be on top after drag
      await expect
        .poll(async () => {
          const vaeOrder =
            await comfyPage.vueNodes.getNodePaintOrder('VAE Decode')
          const clipOrder =
            await comfyPage.vueNodes.getNodePaintOrder('CLIP Text Encode')
          return vaeOrder - clipOrder
        })
        .toBeGreaterThan(0)

      // Screenshot showing VAE on top
      await expect(comfyPage.canvas).toHaveScreenshot(
        'bring-to-front-widget-overlapped-before.png'
      )

      // Click on the text widget of CLIP Text Encode
      const clipNode = comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode')
      const clipBox = await clipNode.boundingBox()
      if (!clipBox) throw new Error('CLIP node not found')
      await comfyPage.page.mouse.click(clipBox.x + 170, clipBox.y + 80)
      await comfyPage.nextFrame()

      // CLIP should now be on top
      await expect
        .poll(async () => {
          const clipOrder =
            await comfyPage.vueNodes.getNodePaintOrder('CLIP Text Encode')
          const vaeOrder =
            await comfyPage.vueNodes.getNodePaintOrder('VAE Decode')
          return clipOrder - vaeOrder
        })
        .toBeGreaterThan(0)

      // Screenshot showing CLIP now on top after widget click
      await expect(comfyPage.canvas).toHaveScreenshot(
        'bring-to-front-widget-overlapped-after.png'
      )
    })
  }
)
