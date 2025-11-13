import { test as base } from '@playwright/test'

import { NodeBadgeMode } from '../../src/types/nodeSource'
import type { ComfyPage } from './ComfyPage'
import { ComfyMouse } from './ComfyMouse'
import { testComfySnapToGridGridSize } from './constants'
import { LocalhostComfyPage } from './LocalhostComfyPage'

/**
 * Localhost fixture for ComfyPage.
 * Creates a test user and sets up default settings for stable testing.
 */
export const comfyPageFixture = base.extend<{
  comfyPage: ComfyPage
  comfyMouse: ComfyMouse
}>({
  comfyPage: async ({ page, request }, use, testInfo) => {
    const { parallelIndex } = testInfo
    const comfyPage = new LocalhostComfyPage(page, request, parallelIndex)

    const username = `playwright-test-${parallelIndex}`
    const userId = await comfyPage.setupUser(username)
    if (userId) {
      comfyPage.userIds[parallelIndex] = userId
    }

    try {
      await comfyPage.setupSettings({
        'Comfy.UseNewMenu': 'Top',
        // Hide canvas menu/info/selection toolbox by default.
        'Comfy.Graph.CanvasInfo': false,
        'Comfy.Graph.CanvasMenu': false,
        'Comfy.Canvas.SelectionToolbox': false,
        // Hide all badges by default.
        'Comfy.NodeBadge.NodeIdBadgeMode': NodeBadgeMode.None,
        'Comfy.NodeBadge.NodeSourceBadgeMode': NodeBadgeMode.None,
        // Disable tooltips by default to avoid flakiness.
        'Comfy.EnableTooltips': false,
        'Comfy.userId': userId,
        // Set tutorial completed to true to avoid loading the tutorial workflow.
        'Comfy.TutorialCompleted': true,
        'Comfy.SnapToGrid.GridSize': testComfySnapToGridGridSize,
        'Comfy.VueNodes.AutoScaleLayout': false
      })
    } catch (e) {
      console.error(e)
    }

    await comfyPage.setup()
    await use(comfyPage)
  },
  comfyMouse: async ({ comfyPage }, use) => {
    const comfyMouse = new ComfyMouse(comfyPage)
    await use(comfyMouse)
  }
})
