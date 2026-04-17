import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { load3dTest as test } from '@e2e/fixtures/helpers/Load3DFixtures'
import type { Load3DHelper } from '@e2e/tests/load3d/Load3DHelper'

async function uploadModel(
  comfyPage: ComfyPage,
  load3d: Load3DHelper,
  filePath: string
): Promise<void> {
  const uploadDone = comfyPage.page.waitForResponse(
    (r) => r.url().includes('/upload/') && r.status() === 200,
    { timeout: 15_000 }
  )
  const chooser = comfyPage.page.waitForEvent('filechooser')
  await load3d.getUploadButton('upload 3d model').click()
  const fc = await chooser
  await fc.setFiles(filePath)
  await uploadDone
}

test.describe('Load3D PLY model loading', { tag: ['@node'] }, () => {
  test('loads a PLY model with the threejs engine', async ({
    comfyPage,
    load3d
  }) => {
    await comfyPage.settings.setSetting('Comfy.Load3D.PLYEngine', 'threejs')

    await uploadModel(comfyPage, load3d, assetPath('3d/test_model.ply'))

    const nodeRef = await comfyPage.nodeOps.getNodeRefById(1)
    const modelFileWidget = await nodeRef.getWidget(0)
    await expect
      .poll(() => modelFileWidget.getValue())
      .toContain('test_model.ply')

    await load3d.waitForModelLoaded()

    const canvasBox = await load3d.canvas.boundingBox()
    expect(
      canvasBox,
      'canvas bounding box must exist after model load'
    ).not.toBeNull()
    expect(canvasBox!.width).toBeGreaterThan(0)
    expect(canvasBox!.height).toBeGreaterThan(0)
  })
})

test.describe(
  'Load3D splat model — controls menu',
  { tag: ['@node', '@slow'] },
  () => {
    test('Light and Export categories are hidden after loading a splat model', async ({
      comfyPage,
      load3d
    }) => {
      test.setTimeout(90_000)

      await uploadModel(comfyPage, load3d, assetPath('3d/test_model.splat'))

      const nodeRef = await comfyPage.nodeOps.getNodeRefById(1)
      const modelFileWidget = await nodeRef.getWidget(0)
      await expect
        .poll(() => modelFileWidget.getValue())
        .toContain('test_model.splat')

      await load3d.waitForModelLoaded()
      await load3d.openMenu()

      await expect(load3d.getMenuCategory('Scene')).toBeVisible()
      await expect(load3d.getMenuCategory('Model')).toBeVisible()
      await expect(load3d.getMenuCategory('Camera')).toBeVisible()
      await expect(load3d.getMenuCategory('Light')).toBeHidden()
      await expect(load3d.getMenuCategory('Export')).toBeHidden()
    })
  }
)
