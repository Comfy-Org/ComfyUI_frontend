import { expect } from '@playwright/test'

import type { ComfyApp } from '../../src/scripts/app'
import { NodeBadgeMode } from '../../src/types/nodeSource'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('Node Badge', () => {
  test('@perf Can add badge', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'add-single-badge'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('add-badge-to-nodes', async () => {
      await comfyPage.page.evaluate(() => {
        const LGraphBadge = window['LGraphBadge']
        const app = window['app'] as ComfyApp
        const graph = app.graph
        const nodes = graph.nodes

        for (const node of nodes) {
          node.badges = [new LGraphBadge({ text: 'Test Badge' })]
        }

        graph.setDirtyCanvas(true, true)
      })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('node-badge.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can add multiple badges', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'add-multiple-badges'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation(
      'add-multiple-badges-to-nodes',
      async () => {
        await comfyPage.page.evaluate(() => {
          const LGraphBadge = window['LGraphBadge']
          const app = window['app'] as ComfyApp
          const graph = app.graph
          const nodes = graph.nodes

          for (const node of nodes) {
            node.badges = [
              new LGraphBadge({ text: 'Test Badge 1' }),
              new LGraphBadge({ text: 'Test Badge 2' })
            ]
          }

          graph.setDirtyCanvas(true, true)
        })
      }
    )

    await expect(comfyPage.canvas).toHaveScreenshot('node-badge-multiple.png')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can add badge left-side', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'add-badge-left-position'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('add-badge-with-position', async () => {
      await comfyPage.page.evaluate(() => {
        const LGraphBadge = window['LGraphBadge']
        const app = window['app'] as ComfyApp
        const graph = app.graph
        const nodes = graph.nodes

        for (const node of nodes) {
          node.badges = [new LGraphBadge({ text: 'Test Badge' })]
          // @ts-expect-error - Enum value
          node.badgePosition = 'top-left'
        }

        graph.setDirtyCanvas(true, true)
      })
    })

    await expect(comfyPage.canvas).toHaveScreenshot('node-badge-left.png')

    await perfMonitor.finishMonitoring(testName)
  })
})

test.describe('Node source badge', () => {
  Object.values(NodeBadgeMode).forEach(async (mode) => {
    test(`@perf Shows node badges (${mode})`, async ({ comfyPage }) => {
      const perfMonitor = new PerformanceMonitor(comfyPage.page)
      const testName = `node-source-badge-${mode}`

      await perfMonitor.startMonitoring(testName)

      // Execution error workflow has both custom node and core node.
      await perfMonitor.measureOperation('load-workflow', async () => {
        await comfyPage.loadWorkflow('execution_error')
      })

      await perfMonitor.measureOperation(
        'configure-badge-settings',
        async () => {
          await comfyPage.setSetting(
            'Comfy.NodeBadge.NodeSourceBadgeMode',
            mode
          )
          await comfyPage.setSetting('Comfy.NodeBadge.NodeIdBadgeMode', mode)
        }
      )

      await perfMonitor.measureOperation('render-badges', async () => {
        await comfyPage.nextFrame()
        await comfyPage.resetView()
      })

      await expect(comfyPage.canvas).toHaveScreenshot(`node-badge-${mode}.png`)

      await perfMonitor.finishMonitoring(testName)
    })
  })
})

test.describe('Node badge color', () => {
  test('@perf Can show node badge with unknown color palette', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'node-badge-unknown-color-palette'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation(
      'configure-badge-and-palette',
      async () => {
        await comfyPage.setSetting(
          'Comfy.NodeBadge.NodeIdBadgeMode',
          NodeBadgeMode.ShowAll
        )
        await comfyPage.setSetting('Comfy.ColorPalette', 'unknown')
      }
    )

    await perfMonitor.measureOperation(
      'render-with-unknown-palette',
      async () => {
        await comfyPage.nextFrame()
        // Click empty space to trigger canvas re-render.
        await comfyPage.clickEmptySpace()
      }
    )

    await expect(comfyPage.canvas).toHaveScreenshot(
      'node-badge-unknown-color-palette.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can show node badge with light color palette', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'node-badge-light-color-palette'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation(
      'configure-badge-and-light-palette',
      async () => {
        await comfyPage.setSetting(
          'Comfy.NodeBadge.NodeIdBadgeMode',
          NodeBadgeMode.ShowAll
        )
        await comfyPage.setSetting('Comfy.ColorPalette', 'light')
      }
    )

    await perfMonitor.measureOperation(
      'render-with-light-palette',
      async () => {
        await comfyPage.nextFrame()
        // Click empty space to trigger canvas re-render.
        await comfyPage.clickEmptySpace()
      }
    )

    await expect(comfyPage.canvas).toHaveScreenshot(
      'node-badge-light-color-palette.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })
})
