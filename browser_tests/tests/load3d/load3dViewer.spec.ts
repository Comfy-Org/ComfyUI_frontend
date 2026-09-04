import { expect } from '@playwright/test'

import { assetPath } from '@e2e/fixtures/utils/paths'
import { load3dViewerTest as test } from '@e2e/fixtures/helpers/Load3DFixtures'

test.describe('Load3D Viewer', () => {
  test.beforeEach(async ({ comfyPage, load3d }) => {
    // Upload cube.obj so the node has a model loaded
    const uploadResponsePromise = comfyPage.page.waitForResponse(
      (resp) => resp.url().includes('/upload/') && resp.status() === 200,
      { timeout: 15000 }
    )
    const fileChooserPromise = comfyPage.page.waitForEvent('filechooser')
    await load3d.getUploadButton('upload 3d model').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(assetPath('cube.obj'))
    await uploadResponsePromise

    const nodeRef = await comfyPage.nodeOps.getNodeRefById(1)
    const modelFileWidget = await nodeRef.getWidget(0)
    await expect.poll(() => modelFileWidget.getValue()).toContain('cube.obj')

    await load3d.waitForModelLoaded()
  })

  test(
    'Opens viewer dialog with canvas and controls sidebar',
    { tag: '@smoke' },
    async ({ load3d, viewer }) => {
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
    async ({ load3d, viewer }) => {
      await load3d.openViewerButton.click()
      await viewer.waitForOpen()

      await viewer.cancelButton.click()
      await viewer.waitForClosed()
    }
  )

  test('keeps the full-screen viewer inside the visible workspace inset', async ({
    comfyPage,
    load3d,
    viewer
  }) => {
    test.fixme(
      true,
      'Activates after slice PR 16187 merges: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16187'
    )

    await comfyPage.page.evaluate(() => {
      document.documentElement.style.setProperty(
        '--workspace-inset-right',
        '420px'
      )
    })
    await load3d.openViewerButton.click()
    await viewer.waitForOpen()

    const dialogBox = await viewer.dialog.boundingBox()
    const viewport = comfyPage.page.viewportSize()
    expect(dialogBox).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.y).toBeGreaterThanOrEqual(0)
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(
      viewport!.width - 420 + 1
    )
    expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(
      viewport!.height + 1
    )
  })
})
