import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '../../../../fixtures/ComfyPage'
import type { TestGraphAccess } from '../../../../types/globals'

test.describe('Curve Widget', { tag: ['@widget', '@smoke'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.workflow.loadWorkflow('vueNodes/widgets/curve_widget')
    await comfyPage.page.waitForFunction(() => {
      const g = window.graph as unknown as TestGraphAccess
      return g?._nodes_by_id?.['1'] !== undefined
    })

    await comfyPage.page.evaluate(() => {
      const g = window.app!.graph as unknown as TestGraphAccess
      const node = g._nodes_by_id['1']
      if (!node.widgets?.some((w) => w.type === 'curve')) {
        node.addWidget(
          'curve',
          'tone_curve',
          {
            points: [
              [0, 0],
              [1, 1]
            ],
            interpolation: 'monotone_cubic'
          },
          () => {}
        )
      }
    })
    await comfyPage.vueNodes.waitForNodes()
    await expect(
      comfyPage.vueNodes
        .getNodeByTitle('Curve')
        .locator('svg')
        .filter({
          has: comfyPage.page.locator('path[data-testid="curve-path"]')
        })
    ).toBeVisible()
  })

  test.describe('Rendering', () => {
    test('renders with default diagonal', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Curve')
      const svg = node.locator('svg').filter({
        has: comfyPage.page.locator('path[data-testid="curve-path"]')
      })
      await expect(svg).toBeVisible()
      await expect(svg.locator('[data-testid="curve-path"]')).toHaveAttribute(
        'd',
        /\S+/
      )
      await expect(svg.locator('circle')).toHaveCount(2)
    })

    test('interpolation selector shows Smooth by default', async ({
      comfyPage
    }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Curve')
      await expect(node.getByRole('combobox')).toContainText('Smooth')
    })
  })

  test.describe('Adding control points', () => {
    test('click adds a new control point', async ({ curveWidget }) => {
      const helper = curveWidget('Curve')
      await expect(helper.svgLocator.locator('circle')).toHaveCount(2)
      await helper.clickAt(0.5, 0.8)
      await expect(helper.svgLocator.locator('circle')).toHaveCount(3)
    })

    test('multiple clicks add multiple points', async ({ curveWidget }) => {
      const helper = curveWidget('Curve')
      await helper.clickAt(0.25, 0.3)
      await helper.clickAt(0.5, 0.6)
      await helper.clickAt(0.75, 0.4)
      await expect(helper.svgLocator.locator('circle')).toHaveCount(5)
    })

    test('Ctrl+click does not add points', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Curve')
      const svg = node.locator('svg').filter({
        has: comfyPage.page.locator('path[data-testid="curve-path"]')
      })
      const box = await svg.boundingBox()
      const viewBoxExtent = 1.08
      const pad = 0.04 / viewBoxExtent
      const usable = box!.width / viewBoxExtent
      const x = box!.x + box!.width * pad + 0.5 * usable
      const y = box!.y + box!.height * pad + 0.5 * usable
      await comfyPage.page.keyboard.down('Control')
      await comfyPage.page.mouse.click(x, y)
      await comfyPage.page.keyboard.up('Control')
      await expect(svg.locator('circle')).toHaveCount(2)
    })
  })

  test.describe('Dragging control points', () => {
    test('dragging a point updates curve', async ({ curveWidget }) => {
      const helper = curveWidget('Curve')
      const path = helper.svgLocator.locator('[data-testid="curve-path"]')
      await helper.clickAt(0.5, 0.5)
      const d1 = await path.getAttribute('d')
      await helper.dragPoint(1, 0.5, 0.8)
      await expect.poll(() => path.getAttribute('d')).not.toBe(d1)
    })

    test('no points when disabled @widget @smoke', async ({
      comfyPage,
      curveWidget
    }) => {
      const helper = curveWidget('Curve')
      await comfyPage.page.evaluate((title) => {
        interface TestNode {
          widgets: Array<{
            options?: {
              disabled?: boolean
            }
          }>
        }
        interface TestGraph {
          findNodesByTitle: (t: string) => TestNode[]
        }

        const graph = window.graph as unknown as TestGraph
        const node = graph.findNodesByTitle(title)[0]
        if (node) {
          const widget = node.widgets[0]
          if (widget) {
            if (!widget.options) widget.options = {}
            widget.options.disabled = true
          }
        }
      }, 'Curve')
      await expect(helper.svgLocator.locator('circle')).toHaveCount(0)
    })

    test('drag clamps to [0, 1]', async ({ curveWidget }) => {
      const helper = curveWidget('Curve')
      await helper.dragPoint(0, -0.5, 1.5)
      const data = await helper.getCurveData()
      expect(data?.points[0][0]).toBeGreaterThanOrEqual(-0.001)
      expect(data?.points[0][0]).toBeLessThanOrEqual(1.001)
      expect(data?.points[0][1]).toBeGreaterThanOrEqual(-0.001)
      expect(data?.points[0][1]).toBeLessThanOrEqual(1.001)
    })

    test('drag maintains x-order', async ({ curveWidget }) => {
      const helper = curveWidget('Curve')
      await helper.clickAt(0.5, 0.5)
      await helper.dragPoint(1, 0.1, 0.5)
      await expect(helper.svgLocator.locator('circle')).toHaveCount(3)
    })
  })

  test.describe('Deleting control points', () => {
    test('right-click deletes point', async ({ curveWidget }) => {
      const helper = curveWidget('Curve')
      await helper.clickAt(0.5, 0.5)
      await expect(helper.svgLocator.locator('circle')).toHaveCount(3)
      await helper.rightClickPoint(1)
      await expect(helper.svgLocator.locator('circle')).toHaveCount(2)
    })

    test('Ctrl+click deletes point', async ({ comfyPage, curveWidget }) => {
      const helper = curveWidget('Curve')
      await helper.clickAt(0.5, 0.5)
      const circle = helper.svgLocator.locator('circle').nth(1)
      const cbox = await circle.boundingBox()
      await comfyPage.page.keyboard.down('Control')
      await comfyPage.page.mouse.click(
        cbox!.x + cbox!.width / 2,
        cbox!.y + cbox!.height / 2
      )
      await comfyPage.page.keyboard.up('Control')
      await expect(helper.svgLocator.locator('circle')).toHaveCount(2)
    })

    test('minimum 2 points limit', async ({ curveWidget }) => {
      const helper = curveWidget('Curve')
      await helper.rightClickPoint(0)
      await expect(helper.svgLocator.locator('circle')).toHaveCount(2)
    })
  })

  test.describe('Interpolation', () => {
    test('Smooth to Linear changes path', async ({
      comfyPage,
      curveWidget
    }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Curve')
      const helper = curveWidget('Curve')
      const path = helper.svgLocator.locator('[data-testid="curve-path"]')
      await helper.clickAt(0.5, 0.8)
      const d1 = await path.getAttribute('d')
      await node.getByRole('combobox').click()
      await comfyPage.page.getByRole('option', { name: 'Linear' }).click()
      await expect.poll(() => path.getAttribute('d')).not.toBe(d1)
    })
  })

  test.describe('Histogram', () => {
    test('absent before execution', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Curve')
      await expect(
        node.locator('[data-testid="histogram-path"]')
      ).not.toBeAttached()
    })
  })

  test.describe('Disabled state', () => {
    test('no points when disabled', async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find((n) => n.title === 'Curve')!
        node.widgets![0].disabled = true
      })
      const node = comfyPage.vueNodes.getNodeByTitle('Curve')
      await expect(node.locator('circle')).toHaveCount(0)
    })
  })

  test.describe('Screenshots', { tag: '@screenshot' }, () => {
    test('default curve matches baseline', async ({ comfyPage }) => {
      await expect(comfyPage.canvas).toHaveScreenshot('curve-default.png', {
        maxDiffPixelRatio: 0.01
      })
    })

    test('linear curve matches baseline', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeByTitle('Curve')
      await node.getByRole('combobox').click()
      await comfyPage.page.getByRole('option', { name: 'Linear' }).click()
      await expect(comfyPage.canvas).toHaveScreenshot('curve-linear.png', {
        maxDiffPixelRatio: 0.01
      })
    })
  })

  test.describe('Persistence', { tag: '@workflow' }, () => {
    test('data persists after save/reload', async ({
      comfyPage,
      curveWidget
    }) => {
      await curveWidget('Curve').clickAt(0.5, 0.8)
      await comfyPage.workflow.loadWorkflow('vueNodes/widgets/curve_widget')
      await comfyPage.page.evaluate(() => {
        const graph = window.graph as TestGraphAccess
        const node = graph._nodes_by_id['1']
        node.addWidget(
          'curve',
          'tone_curve',
          {
            points: [
              [0, 0],
              [0.5, 0.8],
              [1, 1]
            ],
            interpolation: 'monotone_cubic'
          },
          () => {}
        )
      })
      await expect(
        comfyPage.vueNodes.getNodeByTitle('Curve').locator('circle')
      ).toHaveCount(3)
    })
  })

  test.describe('Edge cases', () => {
    test('20 points', async ({ comfyPage }) => {
      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find((n) => n.title === 'Curve')!
        const w = node.widgets!.find((w) => w.type === 'curve')!
        ;(w.value as { points: [number, number][] }).points = Array.from(
          { length: 20 },
          (_, i) => [i / 19, i / 19]
        )
      })
      await expect(
        comfyPage.vueNodes.getNodeByTitle('Curve').locator('circle')
      ).toHaveCount(20)
    })
  })
})
