import { expect } from '@playwright/test'

import type { ComfyApp } from '../../src/scripts/app'
import { NodeBadgeMode } from '../../src/types/nodeSource'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Node Badge', () => {
  test('Can add badge', async ({ comfyPage }) => {
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

    await expect(comfyPage.canvas).toHaveScreenshot('node-badge.png')
  })

  test('Can add multiple badges', async ({ comfyPage }) => {
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

    await expect(comfyPage.canvas).toHaveScreenshot('node-badge-multiple.png')
  })

  test('Can add badge left-side', async ({ comfyPage }) => {
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

    await expect(comfyPage.canvas).toHaveScreenshot('node-badge-left.png')
  })
})

test.describe('Node source badge', () => {
  Object.values(NodeBadgeMode).forEach(async (mode) => {
    test(`Shows node badges (${mode})`, async ({ comfyPage }) => {
      // Execution error workflow has both custom node and core node.
      await comfyPage.loadWorkflow('execution_error')
      await comfyPage.setSetting('Comfy.NodeBadge.NodeSourceBadgeMode', mode)
      await comfyPage.setSetting('Comfy.NodeBadge.NodeIdBadgeMode', mode)
      await comfyPage.nextFrame()
      await comfyPage.resetView()
      await expect(comfyPage.canvas).toHaveScreenshot(`node-badge-${mode}.png`)
    })
  })
})

test.describe('Node badge color', () => {
  test('Can show node badge with unknown color palette', async ({
    comfyPage
  }) => {
    await comfyPage.setSetting(
      'Comfy.NodeBadge.NodeIdBadgeMode',
      NodeBadgeMode.ShowAll
    )
    await comfyPage.setSetting('Comfy.ColorPalette', 'unknown')
    await comfyPage.nextFrame()
    // Click empty space to trigger canvas re-render.
    await comfyPage.clickEmptySpace()
    await expect(comfyPage.canvas).toHaveScreenshot(
      'node-badge-unknown-color-palette.png'
    )
  })
})
