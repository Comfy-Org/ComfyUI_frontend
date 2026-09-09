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

    for (const { nodeType, title, folder, action } of [
      {
        nodeType: 'LoadImage',
        title: 'Load Image',
        folder: 'input',
        action: 'paste'
      },
      {
        nodeType: 'LoadImageMask',
        title: 'Load Image (as Mask)',
        folder: 'input',
        action: 'paste'
      },
      {
        nodeType: 'LoadImageOutput',
        title: 'Load Image (from Outputs)',
        folder: 'output',
        action: 'paste'
      },
      {
        nodeType: 'LoadImage',
        title: 'Load Image',
        folder: 'input',
        action: 'canvas paste'
      },
      {
        nodeType: 'LoadImage',
        title: 'Load Image',
        folder: 'input',
        action: 'drop'
      }
    ]) {
      test.describe(`${nodeType} ${action}`, () => {
        test.beforeEach(async ({ comfyPage }) => {
          await comfyPage.menu.topbar.newWorkflowButton.click()
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(0)
          if (action !== 'canvas paste') {
            const outputResponse =
              folder === 'output'
                ? comfyPage.page.waitForResponse(
                    (response) =>
                      new URL(response.url()).pathname.endsWith(
                        '/internal/files/output'
                      ) &&
                      response.request().method() === 'GET' &&
                      response.ok()
                  )
                : undefined
            await comfyPage.searchBoxV2.addNode(title)
            await comfyPage.vueNodes.waitForNodes()
            if (outputResponse) {
              const response = await outputResponse
              expect(await response.finished()).toBeNull()
              const options = z.array(z.string()).parse(await response.json())
              const [node] = await comfyPage.nodeOps.getNodeRefsByType(nodeType)
              const imageWidget = await node.getWidgetByName('image')
              await expect
                .poll(() =>
                  comfyPage.page.evaluate(
                    ({ nodeId, widgetIndex }) =>
                      window.app!.graph.getNodeById(nodeId)?.widgets?.[
                        widgetIndex
                      ]?.options.values,
                    { nodeId: node.id, widgetIndex: imageWidget.index }
                  )
                )
                .toEqual(options)
            }
          }
        })

        test.afterEach(async ({ comfyPage }) => {
          await comfyPage.workflow.deleteWorkflow('image-upload-root')
          await comfyPage.canvasOps.resetView()
        })

        test('stores image.png at the configured root and preserves its path after reload', async ({
          comfyPage,
          comfyFiles
        }) => {
          await comfyPage.canvas.focus()
          if (action !== 'canvas paste') {
            const nodes = await comfyPage.nodeOps.getNodeRefsByType(nodeType)
            expect(nodes).toHaveLength(1)
            await nodes[0].click('title')
          }

          const uploadResponse = comfyPage.page.waitForResponse(
            (response) =>
              response.url().includes('/upload/image') &&
              response.status() === 200
          )

          if (action === 'drop') {
            const dropPosition =
              await comfyPage.canvasOps.getNodeCenterByTitle(title)
            if (!dropPosition) throw new Error('Upload node must be visible')
            await comfyPage.dragDrop.dragAndDropExternalResource({
              fileName: 'image.png',
              filePath: assetPath('test_upload_image.png'),
              dropPosition,
              waitForUpload: true
            })
          } else {
            await comfyPage.clipboard.pasteFile(
              assetPath('test_upload_image.png'),
              { mode: 'direct', fileName: 'image.png' }
            )
          }

          const uploaded = zUploadImageResponse
            .required()
            .parse(await (await uploadResponse).json())
          if (!uploaded.name) throw new Error('Upload must return a filename')
          comfyFiles.deleteAfterTest({
            filename: uploaded.name,
            subfolder: uploaded.subfolder,
            type: uploaded.type
          })
          expect(uploaded.type).toBe(folder)
          expect(uploaded.subfolder).toBe('')

          const expectedPath =
            folder === 'output' ? `${uploaded.name} [output]` : uploaded.name
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(1)
          const [node] = await comfyPage.nodeOps.getNodeRefsByType(nodeType)
          const imageWidget = await node.getWidgetByName('image')
          await expect.poll(() => imageWidget.getValue()).toBe(expectedPath)

          await comfyPage.menu.topbar.saveWorkflow('image-upload-root')
          if (folder === 'output') {
            await comfyPage.page.route(
              '**/internal/files/output**',
              async (route) => {
                if (route.request().method() !== 'GET') {
                  await route.fallback()
                  return
                }

                const response = await route.fetch()
                const options = z
                  .array(z.string())
                  .safeParse(await response.json().catch(() => undefined))
                if (!response.ok() || !options.success) {
                  await route.fulfill({ response })
                  return
                }
                await route.fulfill({
                  response,
                  json: options.data.toSorted(
                    (a, b) =>
                      Number(b === expectedPath) - Number(a === expectedPath)
                  )
                })
              }
            )
          }
          const outputResponse =
            folder === 'output'
              ? comfyPage.page.waitForResponse(
                  (response) =>
                    new URL(response.url()).pathname.endsWith(
                      '/internal/files/output'
                    ) && response.request().method() === 'GET'
                )
              : undefined
          await comfyPage.workflow.reloadAndWaitForApp()
          if (outputResponse) {
            const response = await outputResponse
            expect(response.ok()).toBe(true)
            expect(await response.finished()).toBeNull()
            const options = z.array(z.string()).parse(await response.json())
            expect(options).toContain(expectedPath)
          }
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
          await expect.poll(() => imageWidget.getValue()).toBe(expectedPath)
          const saved = await comfyPage.workflow.getExportedWorkflow()
          expect(
            saved.nodes.find((entry) => entry.type === nodeType)
          ).toMatchObject({
            widgets_values: expect.arrayContaining([expectedPath])
          })
        })
      })
    }
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
