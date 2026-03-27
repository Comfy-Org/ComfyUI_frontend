import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Painter', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('widgets/painter_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  test(
    'Renders canvas and controls',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      const painterWidget = node.locator('.widget-expands')
      await expect(painterWidget).toBeVisible()

      await expect(painterWidget.locator('canvas')).toBeVisible()
      await expect(painterWidget.getByText('Brush')).toBeVisible()
      await expect(painterWidget.getByText('Eraser')).toBeVisible()
      await expect(painterWidget.getByText('Clear')).toBeVisible()
      await expect(
        painterWidget.locator('input[type="color"]').first()
      ).toBeVisible()

      await expect(node).toHaveScreenshot('painter-default-state.png')
    }
  )

  test(
    'Drawing a stroke changes the canvas',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const canvas = node.locator('.widget-expands canvas')
      await expect(canvas).toBeVisible()

      const isEmptyBefore = await canvas.evaluate((el) => {
        const ctx = (el as HTMLCanvasElement).getContext('2d')
        if (!ctx) return true
        const data = ctx.getImageData(
          0,
          0,
          (el as HTMLCanvasElement).width,
          (el as HTMLCanvasElement).height
        )
        return data.data.every((v, i) => (i % 4 === 3 ? v === 0 : true))
      })
      expect(isEmptyBefore).toBe(true)

      const box = await canvas.boundingBox()
      if (!box) throw new Error('Canvas bounding box not found')

      await comfyPage.page.mouse.move(
        box.x + box.width * 0.3,
        box.y + box.height * 0.5
      )
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        box.x + box.width * 0.7,
        box.y + box.height * 0.5,
        { steps: 10 }
      )
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await expect(async () => {
        const hasContent = await canvas.evaluate((el) => {
          const ctx = (el as HTMLCanvasElement).getContext('2d')
          if (!ctx) return false
          const data = ctx.getImageData(
            0,
            0,
            (el as HTMLCanvasElement).width,
            (el as HTMLCanvasElement).height
          )
          for (let i = 3; i < data.data.length; i += 4) {
            if (data.data[i] > 0) return true
          }
          return false
        })
        expect(hasContent).toBe(true)
      }).toPass()

      await expect(node).toHaveScreenshot('painter-after-stroke.png')
    }
  )
})
