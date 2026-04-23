import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Curve Widget', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('widgets/curve_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  test(
    'Renders default diagonal curve with two control points',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      const svg = node.locator('svg[viewBox="-0.04 -0.04 1.08 1.08"]')
      await expect(svg).toBeVisible()

      const curvePath = svg.locator('[data-testid="curve-path"]')
      await expect(curvePath).toBeVisible()
      await expect(curvePath).toHaveAttribute('d', /.+/)

      await expect(svg.locator('circle')).toHaveCount(2)

      await expect(node).toHaveScreenshot('curve-default-diagonal.png')
    }
  )

  test(
    'Interpolation selector shows Smooth by default',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      await expect(node.getByText('Smooth')).toBeVisible()
    }
  )

  test(
    'Click on SVG canvas adds a control point',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const svg = node.locator('svg[viewBox="-0.04 -0.04 1.08 1.08"]')
      await expect(svg).toBeVisible()
      await expect(svg.locator('circle')).toHaveCount(2)

      const box = await svg.boundingBox()
      if (!box) throw new Error('SVG bounding box not found')

      // Click at ~(0.5, 0.8) in curve space.
      // ViewBox is -0.04..1.04, so pad fraction = 0.04/1.08.
      // Y is inverted: curveY=0.8 → svgY=0.2 → near top of SVG.
      const padFrac = 0.04 / 1.08
      const scale = 1 / 1.08
      const screenX = box.x + box.width * padFrac + 0.5 * box.width * scale
      const screenY =
        box.y + box.height * padFrac + (1 - 0.8) * box.height * scale

      await comfyPage.page.mouse.click(screenX, screenY)
      await comfyPage.nextFrame()

      await expect(svg.locator('circle')).toHaveCount(3)

      await expect(node).toHaveScreenshot('curve-after-add-point.png')
    }
  )
})
