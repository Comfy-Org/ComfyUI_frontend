import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { maskEditorExtensionTest as test } from '@e2e/fixtures/maskEditorExtensionFixture'

test.describe(
  'Public MaskEditor extension coordinates and delayed-result safety',
  { tag: ['@canvas', '@vue-nodes'] },
  () => {
    test.beforeEach(
      async ({ comfyPage, comfyFiles, extensionTool, maskEditor }) => {
        await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
        await extensionTool.register()
        const filename = await extensionTool.uploadAsymmetricImage(
          comfyPage.vueNodes
            .getNodeByTitle('Load Image')
            .locator('input[type="file"]')
        )
        comfyFiles.deleteAfterTest({
          filename,
          type: 'input'
        })
        await expect(maskEditor.previewImage).toHaveAttribute(
          'src',
          new RegExp(filename)
        )
        await maskEditor.reopenDialog()
        await extensionTool.tool.click()
        await expect(extensionTool.apply).toBeVisible()
      }
    )

    test('rendered landmarks retain their image coordinates through navigation, rotation, and mirroring', async ({
      comfyPage,
      extensionTool,
      maskEditor
    }) => {
      await test.step('Locate an asymmetric landmark from rendered pixels', async () => {
        await extensionTool.clickRenderedLandmark()
        await comfyPage.nextFrame()
        const events = await extensionTool.getEvents()
        expect(events).toHaveLength(1)
        expect(events[0].x).toBeCloseTo(19, 0)
        expect(events[0].y).toBeCloseTo(12, 0)
      })

      await test.step('Zoom and pan without creating prompts', async () => {
        const initialBounds = await extensionTool.maskCanvas.boundingBox()
        expect(initialBounds).not.toBeNull()
        const point = await extensionTool.findRenderedColor(255, 0, 255)
        await comfyPage.page.mouse.move(point.x, point.y)
        await comfyPage.page.mouse.wheel(0, 150)
        await comfyPage.nextFrame()
        const zoomedBounds = await extensionTool.maskCanvas.boundingBox()
        expect(zoomedBounds).not.toBeNull()
        expect(zoomedBounds!.width).toBeLessThan(initialBounds!.width)
        const beforePan = await extensionTool.findRenderedColor(255, 0, 255)
        await extensionTool.navigate('middle')
        await extensionTool.navigate('left')
        await comfyPage.nextFrame()
        const afterPan = await extensionTool.findRenderedColor(255, 0, 255)
        expect(afterPan.x - beforePan.x).toBeCloseTo(70, 0)
        expect(afterPan.y - beforePan.y).toBeCloseTo(46, 0)
        expect(await extensionTool.getEvents()).toHaveLength(1)
        await extensionTool.clickRenderedLandmark()
        await comfyPage.nextFrame()
        const events = await extensionTool.getEvents()
        expect(events).toHaveLength(2)
        expect(events[1].x).toBeCloseTo(19, 0)
        expect(events[1].y).toBeCloseTo(12, 0)
      })

      await test.step('Rotate the portrait without stretching and align overlay points', async () => {
        await maskEditor.dialog
          .getByTitle('Rotate Right', { exact: true })
          .click()
        await comfyPage.nextFrame()
        const bounds = await extensionTool.maskCanvas.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.width / bounds!.height).toBeCloseTo(0.5, 2)
        const landmark = await extensionTool.clickRenderedLandmark()
        await comfyPage.nextFrame()
        const events = await extensionTool.getEvents()
        expect(events).toHaveLength(3)
        expect(events[2].x).toBeCloseTo(36, 0)
        expect(events[2].y).toBeCloseTo(19, 0)
        const overlay = await extensionTool.findRenderedColor(0, 0, 255)
        expect(Math.abs(overlay.x - landmark.x)).toBeLessThan(2)
        expect(Math.abs(overlay.y - landmark.y)).toBeLessThan(2)
      })

      await test.step('Mirror the rotated document in its current image coordinates', async () => {
        await maskEditor.dialog
          .getByTitle('Mirror Horizontal', { exact: true })
          .click()
        await comfyPage.nextFrame()
        await extensionTool.clickRenderedLandmark()
        await comfyPage.nextFrame()
        const events = await extensionTool.getEvents()
        expect(events).toHaveLength(4)
        expect(events[3].x).toBeCloseTo(12, 0)
        expect(events[3].y).toBeCloseTo(19, 0)
        expect(await maskEditor.pollMaskPixelCount()).toBe(0)
      })
    })

    test('a delayed result cannot overwrite an external undo', async ({
      extensionTool,
      maskEditor
    }) => {
      await extensionTool.apply.click()
      await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(1152)
      await extensionTool.delayedApply.click()
      await expect(extensionTool.status).toHaveText('Waiting for mask')
      await maskEditor.dialog.getByTitle('Undo', { exact: true }).click()
      await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(0)
      await extensionTool.releaseDelayedResult()
      await expect
        .poll(() => extensionTool.getDelayedResults())
        .toEqual([{ ok: false, reason: 'stale' }])
      expect(await maskEditor.pollMaskPixelCount()).toBe(0)
    })

    test('a delayed result cannot overwrite a native brush edit after switching tools', async ({
      extensionTool,
      maskEditor
    }) => {
      await extensionTool.delayedApply.click()
      await expect(extensionTool.status).toHaveText('Waiting for mask')
      await maskEditor.dialog.locator('[data-tool="pen"]').click()
      await maskEditor.drawStrokeAndExpectPixels(maskEditor.dialog)
      const current = await maskEditor.getCanvasSnapshot(2)
      await extensionTool.releaseDelayedResult()
      await expect
        .poll(() => extensionTool.getDelayedResults())
        .toEqual([{ ok: false, reason: 'inactive' }])
      expect(await maskEditor.getCanvasSnapshot(2)).toBe(current)
    })

    test('a delayed result cannot alter a saved mask or widgets after reopening', async ({
      comfyFiles,
      extensionTool,
      maskEditor
    }) => {
      await extensionTool.apply.click()
      await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(1152)
      await extensionTool.delayedApply.click()
      await expect(extensionTool.status).toHaveText('Waiting for mask')
      await maskEditor.dialog.getByRole('button', { name: 'Save' }).click()
      await expect(maskEditor.dialog).toBeHidden()
      comfyFiles.deleteAfterTest(await extensionTool.getSavedImageReference())
      const savedWidgets = await extensionTool.getWidgets()
      await maskEditor.reopenDialog()
      await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(1152)
      const current = await maskEditor.getCanvasSnapshot(2)
      await extensionTool.releaseDelayedResult()
      await expect
        .poll(() => extensionTool.getDelayedResults())
        .toEqual([{ ok: false, reason: 'inactive' }])
      expect(await maskEditor.getCanvasSnapshot(2)).toBe(current)
      expect(await extensionTool.getWidgets()).toEqual(savedWidgets)
    })
  }
)
