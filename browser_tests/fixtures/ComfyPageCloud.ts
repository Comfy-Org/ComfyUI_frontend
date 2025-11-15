import { test as base } from '@playwright/test'

import { CloudComfyPage } from './CloudComfyPage'
import { ComfyMouse } from './ComfyMouse'
import type { ComfyPage } from './ComfyPage'

/**
 * Cloud-specific fixture for ComfyPage.
 * Uses Firebase auth persisted from globalSetupCloud.ts.
 */
export const comfyPageCloudFixture = base.extend<{
  comfyPage: ComfyPage
  comfyMouse: ComfyMouse
}>({
  // Use the storageState saved by globalSetupCloud
  storageState: 'browser_tests/.auth/cloudUser.json',

  comfyPage: async ({ page, request }, use) => {
    const comfyPage = new CloudComfyPage(page, request)

    // Note: No setupUser needed - Firebase auth persisted via storageState
    // Setup cloud-specific settings (optional - can customize per test)
    try {
      await comfyPage.setupSettings({
        'Comfy.UseNewMenu': 'Top',
        // Hide canvas menu/info/selection toolbox by default.
        'Comfy.Graph.CanvasInfo': false,
        'Comfy.Graph.CanvasMenu': false,
        'Comfy.Canvas.SelectionToolbox': false,
        // Disable tooltips by default to avoid flakiness.
        'Comfy.EnableTooltips': false,
        // Set tutorial completed to true to avoid loading the tutorial workflow.
        'Comfy.TutorialCompleted': true
      })
    } catch (e) {
      console.error('Failed to setup cloud settings:', e)
    }

    // Don't mock releases for cloud - cloud handles its own releases
    await comfyPage.setup({ mockReleases: false })
    await use(comfyPage)
  },

  comfyMouse: async ({ comfyPage }, use) => {
    const comfyMouse = new ComfyMouse(comfyPage)
    await use(comfyMouse)
  }
})
