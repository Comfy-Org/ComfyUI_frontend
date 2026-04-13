import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Curve Widget', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('widgets/curve_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  function getCurveWidgetLocators(comfyPage: ComfyPage) {
    const node = comfyPage.vueNodes.getNodeLocator('1')
    const svg = node.locator('svg')
    const curvePath = node.getByTestId('curve-path')
    const controlPoints = svg.locator('circle')
    return { node, svg, curvePath, controlPoints }
  }

  test(
    'Renders SVG editor with default control points and curve path',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const { node, svg, curvePath, controlPoints } =
        getCurveWidgetLocators(comfyPage)

      await expect(node).toBeVisible()
      await expect(svg).toBeVisible()
      await expect(curvePath).toBeVisible()
      await expect(controlPoints).toHaveCount(2)
    }
  )

  test(
    'Clicking on SVG adds a new control point',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const { svg, controlPoints } = getCurveWidgetLocators(comfyPage)
      await expect(controlPoints).toHaveCount(2)

      const box = await svg.boundingBox()
      if (!box) throw new Error('SVG bounding box not found')

      await comfyPage.page.mouse.click(
        box.x + box.width * 0.5,
        box.y + box.height * 0.5
      )
      await comfyPage.nextFrame()

      await expect(controlPoints).toHaveCount(3)
    }
  )

  test(
    'Dragging a control point reshapes the curve',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const { svg, curvePath } = getCurveWidgetLocators(comfyPage)

      const pathBefore = await curvePath.getAttribute('d')

      const box = await svg.boundingBox()
      if (!box) throw new Error('SVG bounding box not found')

      await comfyPage.page.mouse.click(
        box.x + box.width * 0.5,
        box.y + box.height * 0.5
      )
      await comfyPage.nextFrame()

      const newPoint = svg.locator('circle').nth(1)
      const pointBox = await newPoint.boundingBox()
      if (!pointBox) throw new Error('Control point bounding box not found')

      const startX = pointBox.x + pointBox.width / 2
      const startY = pointBox.y + pointBox.height / 2

      await comfyPage.page.mouse.move(startX, startY)
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(startX, startY - 40, { steps: 5 })
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await expect.poll(() => curvePath.getAttribute('d')).not.toBe(pathBefore)
    }
  )

  test(
    'Ctrl+clicking a control point removes it',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const { svg, controlPoints } = getCurveWidgetLocators(comfyPage)

      const box = await svg.boundingBox()
      if (!box) throw new Error('SVG bounding box not found')

      await comfyPage.page.mouse.click(
        box.x + box.width * 0.5,
        box.y + box.height * 0.5
      )
      await comfyPage.nextFrame()
      await expect(controlPoints).toHaveCount(3)

      const middlePoint = controlPoints.nth(1)
      const pointBox = await middlePoint.boundingBox()
      if (!pointBox) throw new Error('Control point bounding box not found')

      await comfyPage.page.keyboard.down('Control')
      await comfyPage.page.mouse.click(
        pointBox.x + pointBox.width / 2,
        pointBox.y + pointBox.height / 2
      )
      await comfyPage.page.keyboard.up('Control')
      await comfyPage.nextFrame()

      await expect(controlPoints).toHaveCount(2)
    }
  )

  test(
    'Switching interpolation mode changes curve path',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const { svg, curvePath, controlPoints } =
        getCurveWidgetLocators(comfyPage)

      const box = await svg.boundingBox()
      if (!box) throw new Error('SVG bounding box not found')
      await comfyPage.page.mouse.click(
        box.x + box.width * 0.5,
        box.y + box.height * 0.5
      )
      await comfyPage.nextFrame()
      await expect(controlPoints).toHaveCount(3)

      const pathBefore = await curvePath.getAttribute('d')

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const select = node.getByRole('combobox')
      await select.click()
      await comfyPage.page.getByRole('option', { name: /linear/i }).click()
      await comfyPage.nextFrame()

      await expect.poll(() => curvePath.getAttribute('d')).not.toBe(pathBefore)
    }
  )

  test(
    'Cannot remove points below minimum of two',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const { controlPoints } = getCurveWidgetLocators(comfyPage)
      await expect(controlPoints).toHaveCount(2)

      const firstPoint = controlPoints.first()
      const pointBox = await firstPoint.boundingBox()
      if (!pointBox) throw new Error('Control point bounding box not found')

      await comfyPage.page.keyboard.down('Control')
      await comfyPage.page.mouse.click(
        pointBox.x + pointBox.width / 2,
        pointBox.y + pointBox.height / 2
      )
      await comfyPage.page.keyboard.up('Control')
      await comfyPage.nextFrame()

      await expect(controlPoints).toHaveCount(2)
    }
  )
})
