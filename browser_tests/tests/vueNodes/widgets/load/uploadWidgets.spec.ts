import type { UploadImageResponse } from '@comfyorg/ingest-types'
import { zUploadImageResponse } from '@comfyorg/ingest-types/zod'
import { z } from 'zod'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { WidgetSelectDropdownFixture } from '@e2e/fixtures/components/WidgetSelectDropdown'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.describe('Vue Upload Widgets', { tag: '@vue-nodes' }, () => {
  test.describe('image upload roots', { tag: '@widget' }, () => {
    test.describe.configure({ mode: 'default' })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.menu.topbar.newWorkflowButton.click()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test.describe('node paste and reload', () => {
      test.afterEach(async ({ comfyPage }) => {
        await comfyPage.workflow.deleteWorkflow('image-upload-root')
      })

      for (const { nodeType, title } of [
        { nodeType: 'LoadImage', title: 'Load Image' },
        { nodeType: 'LoadImageMask', title: 'Load Image (as Mask)' }
      ]) {
        test(`${nodeType} keeps the pasted input selected and available after reload`, async ({
          comfyPage,
          comfyFiles
        }) => {
          await comfyPage.searchBoxV2.addNode(title)
          await comfyPage.vueNodes.waitForNodes()
          const [node] = await comfyPage.nodeOps.getNodeRefsByType(nodeType)
          await comfyPage.canvas.focus()
          await node.click('title')

          const uploadResponse = comfyPage.page.waitForResponse(
            (response) =>
              response.url().includes('/upload/image') &&
              response.status() === 200
          )

          await comfyPage.clipboard.pasteFile(
            assetPath('test_upload_image.png'),
            { mode: 'direct', fileName: 'image.png' }
          )

          const uploaded = zUploadImageResponse
            .required()
            .parse(await (await uploadResponse).json())
          comfyFiles.deleteAfterTest({
            filename: uploaded.name,
            subfolder: uploaded.subfolder,
            type: uploaded.type
          })
          const imageWidget = await node.getWidgetByName('image')
          await expect.poll(() => imageWidget.getValue()).toBe(uploaded.name)

          await comfyPage.menu.topbar.saveWorkflow('image-upload-root')
          await comfyPage.workflow.reloadAndWaitForApp()
          await comfyPage.vueNodes.waitForNodes()

          await expect
            .poll(() =>
              comfyPage.page.evaluate(
                ({ nodeId, widgetIndex }) =>
                  window.app!.graph.getNodeById(nodeId)?.widgets?.[widgetIndex]
                    ?.options.values,
                { nodeId: node.id, widgetIndex: imageWidget.index }
              )
            )
            .toContain(uploaded.name)
          await expect.poll(() => imageWidget.getValue()).toBe(uploaded.name)
        })
      }

      test.describe('LoadImageOutput', () => {
        test.beforeEach(async ({ comfyPage }) => {
          const outputResponse = comfyPage.page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname.endsWith(
                '/internal/files/output'
              ) &&
              response.request().method() === 'GET' &&
              response.ok()
          )
          await comfyPage.searchBoxV2.addNode('Load Image (from Outputs)')
          await comfyPage.vueNodes.waitForNodes()
          const response = await outputResponse
          const options = z.array(z.string()).parse(await response.json())
          const [node] =
            await comfyPage.nodeOps.getNodeRefsByType('LoadImageOutput')
          const imageWidget = await node.getWidgetByName('image')
          await expect
            .poll(() =>
              comfyPage.page.evaluate(
                ({ nodeId, widgetIndex }) =>
                  window.app!.graph.getNodeById(nodeId)?.widgets?.[widgetIndex]
                    ?.options.values,
                { nodeId: node.id, widgetIndex: imageWidget.index }
              )
            )
            .toEqual(options)
        })

        test('keeps the pasted output available after reload', async ({
          comfyPage,
          comfyFiles
        }) => {
          const [node] =
            await comfyPage.nodeOps.getNodeRefsByType('LoadImageOutput')
          await comfyPage.canvas.focus()
          await node.click('title')
          const uploadResponse = comfyPage.page.waitForResponse(
            (response) =>
              response.url().includes('/upload/image') &&
              response.status() === 200
          )
          await comfyPage.clipboard.pasteFile(
            assetPath('test_upload_image.png'),
            { mode: 'direct', fileName: 'image.png' }
          )
          const uploaded = zUploadImageResponse
            .required()
            .parse(await (await uploadResponse).json())
          comfyFiles.deleteAfterTest({
            filename: uploaded.name,
            subfolder: uploaded.subfolder,
            type: uploaded.type
          })
          const expectedPath = `${uploaded.name} [output]`
          const imageWidget = await node.getWidgetByName('image')
          await expect.poll(() => imageWidget.getValue()).toBe(expectedPath)

          await comfyPage.menu.topbar.saveWorkflow('image-upload-root')
          await comfyPage.workflow.reloadAndWaitForApp()
          await comfyPage.vueNodes.waitForNodes()

          await expect
            .poll(() =>
              comfyPage.page.evaluate(
                ({ nodeId, widgetIndex }) =>
                  window.app!.graph.getNodeById(nodeId)?.widgets?.[widgetIndex]
                    ?.options.values,
                { nodeId: node.id, widgetIndex: imageWidget.index }
              )
            )
            .toContain(expectedPath)
        })
      })
    })

    test('canvas paste creates a LoadImage node with the uploaded filename', async ({
      comfyPage,
      comfyFiles
    }) => {
      await comfyPage.canvas.focus()
      const uploadResponse = comfyPage.page.waitForResponse(
        (response) =>
          response.url().includes('/upload/image') && response.status() === 200
      )
      await comfyPage.clipboard.pasteFile(assetPath('test_upload_image.png'), {
        mode: 'direct',
        fileName: 'image.png'
      })
      const uploaded = zUploadImageResponse
        .required()
        .parse(await (await uploadResponse).json())
      comfyFiles.deleteAfterTest({
        filename: uploaded.name,
        subfolder: uploaded.subfolder,
        type: uploaded.type
      })

      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
      const nodes = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      expect(nodes).toHaveLength(1)
      const imageWidget = await nodes[0].getWidgetByName('image')
      await expect.poll(() => imageWidget.getValue()).toBe(uploaded.name)
    })
  })

  test.describe('media selection', { tag: '@widget' }, () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
    })

    test('keeps a selected image loaded when it is selected again', async ({
      comfyPage
    }) => {
      const loadImageNodes =
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      expect(loadImageNodes, 'Workflow has one Load Image node').toHaveLength(1)
      const [loadImageNode] = loadImageNodes

      const imageWidget = await loadImageNode.getWidgetByName('image')
      await expect.poll(() => imageWidget.getValue()).toBe('example.png')

      const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
      const imageLoadError = node.getByTestId(TestIds.errors.imageLoadError)
      const selectedImageButton = node.getByRole('button', {
        name: 'example.png',
        exact: true
      })
      await expect(selectedImageButton).toBeVisible()
      await expect(imageLoadError).toBeHidden()

      await WidgetSelectDropdownFixture.fromTrigger(
        selectedImageButton
      ).selectOption('example.png')

      await expect(selectedImageButton).toBeFocused()
      await expect(selectedImageButton).toBeVisible()
      await expect.poll(() => imageWidget.getValue()).toBe('example.png')
      await expect(imageLoadError).toBeHidden()
    })
  })

  test('should hide canvas-only upload buttons', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('widgets/all_load_widgets')

    await expect(
      comfyPage.page.getByText('choose file to upload', { exact: true })
    ).toBeHidden()

    await expect
      .poll(() =>
        comfyPage.page.getByTestId(TestIds.errors.imageLoadError).count()
      )
      .toBeGreaterThan(0)
    await expect
      .poll(() =>
        comfyPage.page.getByTestId(TestIds.errors.videoLoadError).count()
      )
      .toBeGreaterThan(0)
  })

  test('uploads an EXR image', async ({ comfyPage, comfyFiles }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')

    const [loadImageNode] =
      await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const imageWidget = await loadImageNode.getWidgetByName('image')
    const node = comfyPage.vueNodes.getNodeByTitle('Load Image')
    const filename = 'test_upload_image.exr'
    const uploadResponse = comfyPage.page.waitForResponse(
      (response) =>
        response.url().includes('/upload/image') && response.status() === 200
    )

    await node.locator('input[type="file"]').setInputFiles(assetPath(filename))
    comfyFiles.deleteAfterTest({ filename, type: 'input' })
    await uploadResponse

    await expect.poll(() => imageWidget.getValue()).toBe(filename)
    await expect(
      node.getByRole('button', { name: filename, exact: true })
    ).toBeVisible()
    await expect(node.getByTestId(TestIds.errors.imageLoadError)).toBeHidden()
  })

  test('shows a spinner during upload', async ({ comfyPage }) => {
    let releaseUpload: () => void = () => {}
    const uploadResponse: UploadImageResponse = { name: 'spinner-test.png' }

    await comfyPage.page.route('**/upload/image', async (route) => {
      await new Promise<void>((resolve) => {
        releaseUpload = resolve
      })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(uploadResponse)
      })
    })
    for (const nodeName of ['Load Image', 'Load Video', 'Load Audio']) {
      await test.step(`for ${nodeName}`, async () => {
        await comfyPage.menu.topbar.newWorkflowButton.click()
        await comfyPage.nextFrame()
        await comfyPage.searchBoxV2.addNode(nodeName)

        const node = comfyPage.vueNodes.getNodeByTitle(nodeName)
        const fileInput = node.locator('input[type="file"]')
        const spinner = node.getByRole('status')

        await expect(spinner).toBeHidden()
        await fileInput.setInputFiles({
          name: 'spinner-test.png',
          mimeType: 'image/png',
          buffer: Buffer.from('test')
        })

        await expect(spinner).toBeVisible()
        releaseUpload()
        await expect(spinner).toBeHidden()
      })
    }
  })
})
