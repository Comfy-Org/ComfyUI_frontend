import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Vue Nodes - LOD', () => {
  test.beforeEach(async ({ comfyPage }) => {
    // Enable Vue nodes rendering
    await comfyPage.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.setup()
    await comfyPage.loadWorkflow('default')
  })

  test('should toggle LOD based on zoom threshold', async ({ comfyPage }) => {
    // Wait for Vue nodes to be rendered
    await comfyPage.vueNodes.waitForNodes()

    // Verify initial state (not in LOD mode at normal zoom)
    const initialNodeCount = await comfyPage.vueNodes.getNodeCount()
    expect(initialNodeCount).toBeGreaterThan(0)

    // Zoom out below threshold (0.86 is default threshold with minFontSize=12)
    await comfyPage.zoom(120, 10) // Zoom out significantly
    await comfyPage.nextFrame()

    // Take screenshot with LOD active (low detail)
    await expect(comfyPage.canvas).toHaveScreenshot('vue-nodes-lod-active.png')

    // Verify LOD is active by checking for the isLOD class
    const lodActiveState = await comfyPage.page.evaluate(() => {
      // Check if any element has the isLOD class
      return document.querySelector('.isLOD') !== null
    })
    expect(lodActiveState).toBe(true)

    // Zoom back in above threshold
    await comfyPage.zoom(-120, 10) // Zoom in to restore normal view
    await comfyPage.nextFrame()

    // Take screenshot with LOD inactive (full detail)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'vue-nodes-lod-inactive.png'
    )

    // Verify LOD is inactive
    const lodInactiveState = await comfyPage.page.evaluate(() => {
      // Check if any element has the isLOD class
      return document.querySelector('.isLOD') !== null
    })
    expect(lodInactiveState).toBe(false)
  })
})