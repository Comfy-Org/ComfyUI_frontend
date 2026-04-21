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
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const n = window.app!.graph.getNodeById(1)
            const config = n?.properties?.['Scene Config'] as
              | Record<string, string>
              | undefined
            return config?.backgroundColor
          })
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
      await expect.poll(() => modelFileWidget.getValue()).toContain('cube.obj')

      await load3d.waitForModelLoaded()
      await comfyPage.expectScreenshot(
        load3d.node,
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
      await expect.poll(() => modelFileWidget.getValue()).toContain('cube.obj')

      await load3d.waitForModelLoaded()
      await comfyPage.expectScreenshot(
        load3d.node,
        'load3d-dropped-cube-obj.png',
        { maxDiffPixelRatio: 0.1 }
      )
    }
  )

  test(
    'Uploading a background image populates Scene Config and surfaces panorama/remove controls',
    { tag: ['@screenshot'] },
    async ({ comfyPage, load3d }) => {
      await expect(load3d.uploadBackgroundImageButton).toBeVisible()
      const node = await comfyPage.nodeOps.getNodeRefById(1)
      const readBackgroundImage = async () => {
        const properties =
          await node.getProperty<Record<string, { backgroundImage?: string }>>(
            'properties'
          )
        return properties['Scene Config']?.backgroundImage ?? ''
      }

      expect(
        await readBackgroundImage(),
        'Scene Config.backgroundImage should start empty'
      ).toBe('')

      await test.step('Upload an image via file picker', async () => {
        const uploadResponse = comfyPage.page.waitForResponse(
          (resp) => resp.url().includes('/upload/') && resp.status() === 200
        )
        const fileChooser = comfyPage.page.waitForEvent('filechooser')
        await load3d.uploadBackgroundImageButton.click()
        await (await fileChooser).setFiles(assetPath('image64x64.webp'))
        await uploadResponse
      })

      await expect.poll(readBackgroundImage).not.toBe('')
      await expect(load3d.panoramaModeButton).toBeVisible()
      await expect(load3d.removeBackgroundImageButton).toBeVisible()

      await comfyPage.expectScreenshot(
        load3d.node,
        'load3d-background-image-tiled.png',
        { maxDiffPixelRatio: 0.05 }
      )

      await test.step('Toggling panorama mode updates Scene Config.backgroundRenderMode', async () => {
        await load3d.panoramaModeButton.click()
        await expect
          .poll(async () => {
            const properties =
              await node.getProperty<
                Record<string, { backgroundRenderMode?: string }>
              >('properties')
            return properties['Scene Config']?.backgroundRenderMode
          })
          .toBe('panorama')
        await comfyPage.expectScreenshot(
          load3d.node,
          'load3d-background-image-panorama.png',
          { maxDiffPixelRatio: 0.05 }
        )
      })

      await test.step('Remove background image clears the Scene Config', async () => {
        await load3d.removeBackgroundImageButton.click()
        await expect.poll(readBackgroundImage).toBe('')
        await expect(load3d.removeBackgroundImageButton).toHaveCount(0)
        await expect(load3d.panoramaModeButton).toHaveCount(0)
      })
    }
  )

  test(
    'Grid toggle hides and restores the Scene grid helper',
    { tag: ['@screenshot'] },
    async ({ comfyPage, load3d }) => {
      await expect(load3d.gridToggleButton).toBeVisible()

      const node = await comfyPage.nodeOps.getNodeRefById(1)
      const readShowGrid = async () => {
        const properties =
          await node.getProperty<Record<string, { showGrid?: boolean }>>(
            'properties'
          )
        return properties['Scene Config']?.showGrid
      }

      const initial = (await readShowGrid()) ?? true
      await comfyPage.expectScreenshot(load3d.node, 'load3d-grid-visible.png', {
        maxDiffPixelRatio: 0.05
      })

      await load3d.gridToggleButton.click()
      await expect.poll(readShowGrid).toBe(!initial)
      await comfyPage.expectScreenshot(load3d.node, 'load3d-grid-hidden.png', {
        maxDiffPixelRatio: 0.05
      })

      await load3d.gridToggleButton.click()
      await expect.poll(readShowGrid).toBe(initial)
      await comfyPage.expectScreenshot(load3d.node, 'load3d-grid-visible.png', {
        maxDiffPixelRatio: 0.05
      })
    }
  )

  test('Recording controls show stop/export/clear buttons after a recording', async ({
    comfyPage,
    load3d
  }) => {
    await expect(load3d.recordingButton).toBeVisible()
    await expect(load3d.stopRecordingButton).toHaveCount(0)

    await test.step('Start recording flips button to stop-recording', async () => {
      await load3d.recordingButton.click()
      await expect(load3d.stopRecordingButton).toBeVisible()
    })

    await test.step('Stop recording surfaces export and clear controls', async () => {
      await comfyPage.nextFrame()
      await load3d.stopRecordingButton.click()
      await expect(load3d.recordingButton).toBeVisible()
      await expect(load3d.exportRecordingButton).toBeVisible()
      await expect(load3d.clearRecordingButton).toBeVisible()
    })

    await test.step('Export recording triggers a scene-recording download', async () => {
      const downloadPromise = comfyPage.page.waitForEvent('download')
      await load3d.exportRecordingButton.click()
      const download = await downloadPromise
      expect(download.suggestedFilename()).toContain('scene-recording')
    })

    await test.step('Clear recording removes export and clear controls', async () => {
      await load3d.clearRecordingButton.click()
      await expect(load3d.exportRecordingButton).toHaveCount(0)
      await expect(load3d.clearRecordingButton).toHaveCount(0)
    })
  })
})
