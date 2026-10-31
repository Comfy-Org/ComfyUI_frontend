import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { maskEditorExtensionTest as test } from '@e2e/fixtures/maskEditorExtensionFixture'

test.describe(
  'MaskEditor extension tools',
  { tag: ['@canvas', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    })

    test('extension tools select points and apply undoable masks without changing RGB or widgets', async ({
      comfyPage,
      comfyFiles,
      maskEditor,
      extensionTool
    }, testInfo) => {
      const originalWidgets = await extensionTool.getWidgets()
      await extensionTool.register()
      const dialog = await maskEditor.openDialog()
      comfyFiles.deleteAfterTest({ filename: 'image64x64.webp', type: 'input' })

      await test.step('Select image points without drawing a native brush stroke', async () => {
        await extensionTool.tool.click()
        await expect(extensionTool.apply).toBeVisible()
        await extensionTool.clickImagePoint(16, 24, 'left')
        await extensionTool.clickImagePoint(48, 40, 'right')
        await comfyPage.nextFrame()
        await expect(extensionTool.status).toHaveText('2 points')
        const events = await extensionTool.getEvents()
        expect(events).toHaveLength(2)
        expect(events[0].x).toBeCloseTo(16, 0)
        expect(events[0].y).toBeCloseTo(24, 0)
        expect(events[0].button).toBe(0)
        expect(events[1].x).toBeCloseTo(48, 0)
        expect(events[1].y).toBeCloseTo(40, 0)
        expect(events[1].button).toBe(2)
        await expect(extensionTool.overlay).toBeVisible()
        expect(await maskEditor.pollMaskPixelCount()).toBe(0)
      })

      await test.step('Apply an extension mask as one native Undo and Redo step', async () => {
        await extensionTool.apply.click()
        await expect(extensionTool.status).toHaveText('Mask applied')
        await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(1024)
        await dialog.getByTitle('Undo', { exact: true }).click()
        await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(0)
        await dialog.getByTitle('Redo', { exact: true }).click()
        await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(1024)
      })

      await test.step('Save the mask without persisting overlay markers or changing RGB', async () => {
        await extensionTool.clickImagePoint(16, 24, 'left')
        await comfyPage.nextFrame()
        await expect(extensionTool.overlay).toBeVisible()
        await dialog.getByRole('button', { name: 'Save' }).click()
        await expect(dialog).toBeHidden()
        comfyFiles.deleteAfterTest(await extensionTool.getSavedImageReference())
        await expect
          .poll(() => extensionTool.getLifecycleCounts())
          .toEqual({
            disposed: 1,
            unmounted: 1
          })
        expect(await extensionTool.inspectSavedImage()).toEqual({
          width: 64,
          height: 64,
          changedRgbPixels: 0,
          incorrectMaskPixels: 0
        })
        const savedWidgets = await extensionTool.getWidgets()
        expect(savedWidgets.map((widget) => widget.name)).toEqual(
          originalWidgets.map((widget) => widget.name)
        )
      })

      await test.step('An old session cannot replace the mask in a reopened editor', async () => {
        await maskEditor.reopenDialog()
        await expect.poll(() => maskEditor.pollMaskPixelCount()).toBe(1024)
        expect(await extensionTool.applyFromClosedSession()).toEqual({
          ok: false,
          reason: 'inactive'
        })
        expect(await maskEditor.pollMaskPixelCount()).toBe(1024)
        await extensionTool.tool.click()
        await expect(extensionTool.status).toHaveText('0 points')
        await dialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(dialog).toBeHidden()
        await expect
          .poll(() => extensionTool.getLifecycleCounts())
          .toEqual({
            disposed: 2,
            unmounted: 2
          })
      })

      await test.step('Native workflow export and import preserve widget names, order, and saved values', async () => {
        const savedWidgets = await extensionTool.getWidgets()
        const downloaded = comfyPage.page.waitForEvent('download')
        await comfyPage.menu.topbar.exportWorkflow('mask-editor-extension')
        const workflow = testInfo.outputPath('mask-editor-extension.json')
        await (await downloaded).saveAs(workflow)
        await comfyPage.menu.topbar.newWorkflowButton.click()
        await comfyPage.expectNodeCount(0)
        await comfyPage.workflowUploadInput.setInputFiles(workflow)
        await expect(comfyPage.workflowUploadInput).toHaveValue('')
        await expect
          .poll(() => extensionTool.getWidgets())
          .toEqual(savedWidgets)
      })
    })
  }
)
