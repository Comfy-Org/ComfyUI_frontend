import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'
import type { ComfyApp } from '../src/scripts/app'
import { NodeSourceBadgeMode } from '../src/types/nodeSource'

test.describe('Node Badge', () => {
  test('Can add badge', async ({ comfyPage }) => {
    await comfyPage.page.evaluate(() => {
      const LGraphBadge = window['LGraphBadge']
      const app = window['app'] as ComfyApp
      const graph = app.graph
      // @ts-expect-error - accessing private property
      const nodes = graph._nodes

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
      // @ts-expect-error - accessing private property
      const nodes = graph._nodes

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
      // @ts-expect-error - accessing private property
      const nodes = graph._nodes

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
  Object.values(NodeSourceBadgeMode).forEach(async (mode) => {
    test(`Shows node source name (${mode})`, async ({ comfyPage }) => {
      // Execution error workflow has both custom node and core node.
      await comfyPage.loadWorkflow('execution_error')
      await comfyPage.setSetting('Comfy.Node.NodeSourceBadgeMode', mode)
      await comfyPage.nextFrame()
      await comfyPage.resetView()
      await expect(comfyPage.canvas).toHaveScreenshot(
        `node-source-badge-${mode}.png`
      )
    })
  })
})
