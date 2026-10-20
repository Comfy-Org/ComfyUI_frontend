import { expect, mergeTests } from '@playwright/test'

import { canvasMenuFixture } from '@e2e/fixtures/canvasMenuFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { expectElementScreenshot } from '@e2e/fixtures/utils/screenshotRegion'

const test = mergeTests(comfyPageFixture, canvasMenuFixture)

test.describe('App chrome', { tag: ['@screenshot', '@ui'] }, () => {
  test.use({
    initialSettings: {
      'Comfy.UseNewMenu': 'Top',
      'Comfy.Graph.CanvasMenu': true
    }
  })

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
  })

  test('side toolbar', async ({ comfyPage }) => {
    await expectElementScreenshot(
      comfyPage.menu.sideToolbar,
      'app-chrome-side-toolbar.png'
    )
  })

  test('workflow tab bar', async ({ comfyPage }) => {
    await expectElementScreenshot(
      comfyPage.menu.topbar.workflowTabs,
      'app-chrome-workflow-tabs.png'
    )
  })

  test('action bar', async ({ comfyPage }) => {
    await expectElementScreenshot(
      comfyPage.actionbar.card,
      'app-chrome-action-bar.png'
    )
  })

  test('canvas toolbar', async ({ canvasMenu }) => {
    await expectElementScreenshot(
      canvasMenu.root,
      'app-chrome-canvas-toolbar.png'
    )
  })
})
