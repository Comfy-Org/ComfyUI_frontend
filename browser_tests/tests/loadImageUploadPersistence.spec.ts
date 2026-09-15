/**
 * FE-1425: dropping an image on a Load Image node must survive a browser
 * reload without an explicit save. `Comfy.Workflow.Persist` defaults to true
 * and writes a localStorage draft on every `graphChanged`, but the upload
 * commit never nudged the change tracker — and HTML5 drag-and-drop emits no
 * mouseup for its global hook to catch — so the draft kept the previous image.
 */
import { zUploadImageResponse } from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import { z } from 'zod'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.describe('Load Image upload persistence', { tag: '@widget' }, () => {
  test.describe.configure({ mode: 'default' })

  test('keeps a dropped image across a reload without saving', async ({
    comfyPage,
    comfyFiles
  }) => {
    test.setTimeout(60000)

    await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.searchBoxV2.addNode('Load Image')

    const dropPosition =
      await comfyPage.canvasOps.getNodeCenterByTitle('Load Image')
    if (!dropPosition) {
      throw new Error('Load Image node center must be available for drop')
    }

    const readImageWidgetValue = () =>
      comfyPage.page.evaluate(
        () =>
          window.app?.graph.nodes
            .find((node) => node.type === 'LoadImage')
            ?.widgets?.find((widget) => widget.name === 'image')?.value
      )

    const uploadResponse = comfyPage.page.waitForResponse(
      (response) =>
        response.url().includes('/upload/image') && response.status() === 200
    )
    await comfyPage.dragDrop.dragAndDropExternalResource({
      fileName: 'image.png',
      filePath: assetPath('test_upload_image.png'),
      dropPosition,
      waitForUpload: true
    })
    const uploaded = zUploadImageResponse
      .required()
      .parse(await (await uploadResponse).json())
    comfyFiles.deleteAfterTest({
      filename: uploaded.name,
      subfolder: uploaded.subfolder,
      type: uploaded.type
    })

    await expect.poll(readImageWidgetValue).toBe(uploaded.name)

    // The draft carrying the new value is what survives the reload, so waiting
    // on it also covers the 512ms persist debounce.
    await expect
      .poll(
        () =>
          comfyPage.page.evaluate((expected) => {
            for (let i = 0; i < window.localStorage.length; i++) {
              const key = window.localStorage.key(i)
              if (!key?.startsWith('Comfy.Workflow.Draft.v2:')) continue
              if (window.localStorage.getItem(key)?.includes(expected))
                return true
            }
            return false
          }, uploaded.name),
        { timeout: 10_000 }
      )
      .toBe(true)

    await comfyPage.workflow.reloadAndWaitForApp()

    await expect.poll(readImageWidgetValue).toBe(uploaded.name)
    await expect
      .poll(() =>
        comfyPage.page.evaluate(
          () =>
            window.app?.graph.nodes
              .find((node) => node.type === 'LoadImage')
              ?.widgets?.find((widget) => widget.name === 'image')?.options
              .values
        )
      )
      .toContain(uploaded.name)
  })

  test.describe('Vue image uploads', { tag: '@vue-nodes' }, () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.menu.topbar.newWorkflowButton.click()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.deleteWorkflow('image-upload-root')
      await comfyPage.canvasOps.resetView()
    })

    test('LoadImageMask keeps the pasted input selected and available after reload', async ({
      comfyPage,
      comfyFiles
    }) => {
      await comfyPage.searchBoxV2.addNode('Load Image (as Mask)')
      await comfyPage.vueNodes.waitForNodes()
      const [node] = await comfyPage.nodeOps.getNodeRefsByType('LoadImageMask')
      await comfyPage.canvas.focus()
      await node.click('title')

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
})
