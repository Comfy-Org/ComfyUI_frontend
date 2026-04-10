import { expect } from '@playwright/test'

import { assetPath } from '@e2e/fixtures/utils/paths'
import { load3dTest as test } from '@e2e/fixtures/helpers/Load3DFixtures'

test.describe('Load3D', () => {
  test(
    'Renders canvas with upload buttons and controls menu',
    { tag: ['@smoke', '@screenshot'] },
    async ({ load3d }) => {
      await expect(load3d.node).toBeVisible()

      await expect(load3d.canvas).toBeVisible()

      await expect
        .poll(async () => {
          const b = await load3d.canvas.boundingBox()
          return b?.width ?? 0
        })
        .toBeGreaterThan(0)
      await expect
        .poll(async () => {
          const b = await load3d.canvas.boundingBox()
          return b?.height ?? 0
        })
        .toBeGreaterThan(0)

      await expect(load3d.getUploadButton('upload 3d model')).toBeVisible()
      await expect(
        load3d.getUploadButton('upload extra resources')
      ).toBeVisible()
      await expect(load3d.getUploadButton('clear')).toBeVisible()

      await expect(load3d.menuButton).toBeVisible()

      await expect(load3d.node).toHaveScreenshot('load3d-empty-node.png', {
        maxDiffPixelRatio: 0.05
      })
    }
  )

  test(
    'Controls menu opens and shows all categories',
    { tag: ['@smoke', '@screenshot'] },
    async ({ load3d }) => {
      await load3d.openMenu()

      await expect(load3d.getMenuCategory('Scene')).toBeVisible()
      await expect(load3d.getMenuCategory('Model')).toBeVisible()
      await expect(load3d.getMenuCategory('Camera')).toBeVisible()
      await expect(load3d.getMenuCategory('Light')).toBeVisible()
      await expect(load3d.getMenuCategory('Export')).toBeVisible()

      await expect(load3d.node).toHaveScreenshot(
        'load3d-controls-menu-open.png',
        { maxDiffPixelRatio: 0.05 }
      )
    }
  )

  test(
    'Changing background color updates the scene',
    { tag: ['@smoke', '@screenshot'] },
    async ({ comfyPage, load3d }) => {
      await load3d.setBackgroundColor('#cc3333')
      await comfyPage.nextFrame()

      await expect
        .poll(
          () =>
            comfyPage.page.evaluate(() => {
              const n = window.app!.graph.getNodeById(1)
              const config = n?.properties?.['Scene Config'] as
                | Record<string, string>
                | undefined
              return config?.backgroundColor
            }),
          { timeout: 3000 }
        )
        .toBe('#cc3333')

      await expect(load3d.node).toHaveScreenshot('load3d-red-background.png', {
        maxDiffPixelRatio: 0.05
      })
    }
  )

  test(
    'Recording controls are visible for Load3D',
    { tag: '@smoke' },
    async ({ load3d }) => {
      await expect(load3d.recordingButton).toBeVisible()
    }
  )

  test(
    'Uploads a 3D model via button and renders it',
    { tag: ['@screenshot'] },
    async ({ comfyPage, load3d }) => {
      const uploadResponsePromise = comfyPage.page.waitForResponse(
        (resp) => resp.url().includes('/upload/') && resp.status() === 200,
        { timeout: 15000 }
      )

      const fileChooserPromise = comfyPage.page.waitForEvent('filechooser')
      await load3d.getUploadButton('upload 3d model').click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(assetPath('cube.obj'))

      await uploadResponsePromise

      const node = await comfyPage.nodeOps.getNodeRefById(1)
      const modelFileWidget = await node.getWidget(0)
      await expect
        .poll(() => modelFileWidget.getValue(), { timeout: 5000 })
        .toContain('cube.obj')

      await load3d.waitForModelLoaded()
      await comfyPage.nextFrame()

      await expect(load3d.node).toHaveScreenshot(
        'load3d-uploaded-cube-obj.png',
        { maxDiffPixelRatio: 0.1 }
      )
    }
  )

  test(
    'Drag-and-drops a 3D model onto the canvas',
    { tag: ['@screenshot'] },
    async ({ comfyPage, load3d }) => {
      const canvasBox = await load3d.canvas.boundingBox()
      expect(canvasBox, 'Canvas bounding box should exist').not.toBeNull()
      const dropPosition = {
        x: canvasBox!.x + canvasBox!.width / 2,
        y: canvasBox!.y + canvasBox!.height / 2
      }

      await comfyPage.dragDrop.dragAndDropFile('cube.obj', {
        dropPosition,
        waitForUpload: true
      })

      const node = await comfyPage.nodeOps.getNodeRefById(1)
      const modelFileWidget = await node.getWidget(0)
      await expect
        .poll(() => modelFileWidget.getValue(), { timeout: 5000 })
        .toContain('cube.obj')

      await load3d.waitForModelLoaded()
      await comfyPage.nextFrame()

      await expect(load3d.node).toHaveScreenshot(
        'load3d-dropped-cube-obj.png',
        { maxDiffPixelRatio: 0.1 }
      )
    }
  )
})
