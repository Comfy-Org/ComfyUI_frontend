import { expect, mergeTests } from '@playwright/test'

import { canvasMenuFixture } from '@e2e/fixtures/canvasMenuFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  expectElementScreenshot,
  expectPageScreenshot
} from '@e2e/fixtures/utils/screenshotRegion'
import { NodeBadgeMode } from '@/types/nodeSource'

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

test.describe(
  'Full app layout',
  { tag: ['@screenshot', '@ui', '@vue-nodes'] },
  () => {
    test.use({
      initialSettings: {
        'Comfy.UseNewMenu': 'Top',
        'Comfy.Graph.CanvasMenu': true,
        'Comfy.Minimap.Visible': true,
        'Comfy.NodeBadge.NodeIdBadgeMode': NodeBadgeMode.ShowAll
      }
    })

    test('kitchen sink', async ({ comfyPage, canvasMenu }) => {
      await expect(comfyPage.menu.sideToolbar).toBeVisible()
      await expect(comfyPage.actionbar.card).toBeVisible()
      await expect(canvasMenu.root).toBeVisible()
      await expect(
        comfyPage.page.getByTestId('minimap-container')
      ).toBeVisible()

      await expectPageScreenshot(comfyPage.page, 'app-kitchen-sink.png')
    })
  }
)
