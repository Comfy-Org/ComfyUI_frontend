import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import { Load3DHelper } from './Load3DHelper'
import { Load3DViewerHelper } from './Load3DViewerHelper'

test.describe('Load3D Viewer', () => {
  let load3d: Load3DHelper
  let viewer: Load3DViewerHelper

  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.settings.setSetting('Comfy.Load3D.3DViewerEnable', true)
    await comfyPage.workflow.loadWorkflow('3d/load3d_node')
    await comfyPage.vueNodes.waitForNodes()

    const node = comfyPage.vueNodes.getNodeLocator('1')
    load3d = new Load3DHelper(node)
    viewer = new Load3DViewerHelper(comfyPage.page)

    // Upload cube.obj so the node has a model loaded
    const uploadResponsePromise = comfyPage.page.waitForResponse(
      (resp) => resp.url().includes('/upload/') && resp.status() === 200,
      { timeout: 15000 }
    )
    const fileChooserPromise = comfyPage.page.waitForEvent('filechooser')
    await load3d.getUploadButton('upload 3d model').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(comfyPage.assetPath('cube.obj'))
    await uploadResponsePromise

    await load3d.waitForModelLoaded()
  })

  test(
    'Opens viewer dialog with canvas and controls sidebar',
    { tag: '@smoke' },
    async () => {
      await load3d.openViewerButton.click()
      await viewer.waitForOpen()

      await expect(viewer.canvas).toBeVisible()
      const canvasBox = await viewer.canvas.boundingBox()
      expect(canvasBox!.width).toBeGreaterThan(0)
      expect(canvasBox!.height).toBeGreaterThan(0)

      await expect(viewer.sidebar).toBeVisible()
      await expect(viewer.cancelButton).toBeVisible()
    }
  )

  test(
    'Cancel button closes the viewer dialog',
    { tag: '@smoke' },
    async () => {
      await load3d.openViewerButton.click()
      await viewer.waitForOpen()

      await viewer.cancelButton.click()
      await viewer.waitForClosed()
    }
  )
})
