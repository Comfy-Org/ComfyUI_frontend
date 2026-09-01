import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createMockJob } from '@e2e/fixtures/helpers/AssetsHelper'

test.describe('Assets sidebar - drag and drop', () => {
  test('Dragging outputs from assets skips upload', async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory([
      createMockJob({
        id: 'job',
        preview_output: {
          filename: `test.png`,
          type: 'temp',
          nodeId: '1',
          mediaType: 'images'
        }
      })
    ])
    await comfyPage.page.route('**/upload/image', (route) => {
      expect(true, 'file is not uploaded').toBe(false)
      return route.fulfill({ status: 405 })
    })

    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    const [loadImage] = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    if (!loadImage) throw new Error('Load Image node not found')
    await loadImage.centerOnNode()

    const { assetsTab } = comfyPage.menu
    await assetsTab.open()
    await assetsTab.waitForAssets()
    await expect(assetsTab.assetCards).toHaveCount(1)

    const targetPosition =
      await comfyPage.canvasOps.getNodeCenterByTitle('Load Image')
    if (!targetPosition) throw new Error('Load Image node center not found')

    await assetsTab.assetCards.dragTo(comfyPage.canvas, { targetPosition })

    const fileComboWidget = await loadImage.getWidget(0)
    await expect.poll(() => fileComboWidget.getValue()).toBe('test.png [temp]')
  })

  test('Loading as workflow reuses asset name', async ({ comfyPage }) => {
    await comfyPage.assets.mockOutputHistory([
      createMockJob({
        id: 'job',
        preview_output: {
          filename: `testimage.png`,
          type: 'temp',
          nodeId: '1',
          mediaType: 'images'
        }
      })
    ])
    const path = comfyPage.assetPath('workflowInMedia/workflow.webp')
    await comfyPage.page.route('**/view?**', (route) => route.fulfill({ path }))

    const { assetsTab } = comfyPage.menu
    await assetsTab.open()
    await assetsTab.waitForAssets()
    await expect(assetsTab.assetCards).toHaveCount(1)

    const targetPosition = { x: 400, y: 100 }
    await assetsTab.assetCards.dragTo(comfyPage.canvas, { targetPosition })

    const getTabName = () => comfyPage.menu.topbar.getActiveTabName()
    await expect.poll(getTabName).toContain('testimage')
  })
})
