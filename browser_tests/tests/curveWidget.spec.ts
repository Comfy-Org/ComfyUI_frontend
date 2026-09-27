import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Curve Widget', { tag: ['@widget', '@vue-nodes'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('widgets/curve_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  test(
    'Loads control points and interpolation from workflow',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      const svg = node.getByTestId('curve-editor')
      await expect(svg).toBeVisible()

      const points = svg.getByTestId('curve-point')
      await expect(points).toHaveCount(2)

      const [cxs, cys] = await Promise.all([
        points.evaluateAll((els) =>
          els.map((e) => Number(e.getAttribute('cx')))
        ),
        points.evaluateAll((els) =>
          els.map((e) => Number(e.getAttribute('cy')))
        )
      ])
      expect(cxs[0]).toBeCloseTo(0.2, 5)
      expect(cxs[1]).toBeCloseTo(0.8, 5)
      expect(cys[0]).toBeCloseTo(0.3, 5)
      expect(cys[1]).toBeCloseTo(0.7, 5)
    }
  )

  test(
    'Interpolation selector reflects loaded value (Linear)',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      await expect(node.getByText('Linear', { exact: true })).toBeVisible()
      await expect(node.getByText('Smooth', { exact: true })).toHaveCount(0)
    }
  )

  test(
    'Click on SVG canvas adds a control point',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      const svg = node.getByTestId('curve-editor')
      await expect(svg).toBeVisible()
      await expect(svg.getByTestId('curve-point')).toHaveCount(2)

      const position = await svg.evaluate((el) => {
        const svgEl = el as SVGSVGElement
        const ctm = svgEl.getScreenCTM()
        if (!ctm) throw new Error('SVG has no screen CTM')
        const pt = svgEl.createSVGPoint()
        pt.x = 0.5
        pt.y = 1 - 0.5 // curve-Y is inverted vs SVG-Y
        const screen = pt.matrixTransform(ctm)
        const rect = svgEl.getBoundingClientRect()
        return { x: screen.x - rect.left, y: screen.y - rect.top }
      })

      await svg.click({ position })

      await expect(svg.getByTestId('curve-point')).toHaveCount(3)
    }
  )
})
