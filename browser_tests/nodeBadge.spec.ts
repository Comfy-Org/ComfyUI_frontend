import { expect } from '@playwright/test'
import { comfyPageFixture as test } from './ComfyPage'
import type { ComfyApp } from '../src/scripts/app'

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
})
