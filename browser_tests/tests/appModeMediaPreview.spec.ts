import {
  comfyPageFixture as test,
  comfyExpect as expect
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { AudioPreview, getWav } from '@e2e/fixtures/components/AudioPreview'
import { assetPath } from '@e2e/fixtures/utils/paths'

/**
 * Regression coverage for FE-1344: native "Load Video"/"Load Audio" nodes
 * showed no media preview at all in App mode, unlike "Load Image". App mode
 * only renders widgets, so the fix hard-codes the same drop-zone preview
 * "Load Image" already gets for these two node types (see
 * `getLoaderDropIndicator` / `AppModeWidgetList.vue`).
 */

const NODE_POSITION = { x: 100, y: 850 }

/**
 * Add a loader node, upload a real file into it, and return its id + the
 * uploaded filename (once the combo widget reflects it).
 */
async function addLoaderNodeWithFile(
  comfyPage: ComfyPage,
  nodeType: 'LoadVideo' | 'LoadAudio' | 'LoadImage',
  nodeTitle: string,
  widgetName: string,
  file: { name?: string; path?: string; mimeType?: string; buffer?: Buffer },
  expectedFilenameSubstring: string
) {
  const nodeRef = await comfyPage.nodeOps.addNode(
    nodeType,
    undefined,
    NODE_POSITION
  )
  await nodeRef.centerOnNode()

  const node = comfyPage.vueNodes.getNodeByTitle(nodeTitle)
  const fileInput = node.locator('input[type="file"]')
  if (file.path) {
    await fileInput.setInputFiles(file.path)
  } else {
    await fileInput.setInputFiles({
      name: file.name!,
      mimeType: file.mimeType!,
      buffer: file.buffer!
    })
  }

  const widget = await nodeRef.getWidgetByName(widgetName)
  await expect
    .poll(() => widget.getValue(), {
      message: `${nodeType} widget "${widgetName}" should hold the uploaded filename`
    })
    .toContain(expectedFilenameSubstring)
  const filename = (await widget.getValue()) as string

  return { nodeRef, filename }
}

test.describe(
  'App mode media preview for native loader nodes',
  { tag: ['@ui', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.appMode.enableLinearMode()
      await comfyPage.workflow.loadWorkflow('default')
    })

    test('Load Video shows an inline video preview, matching the normal editor', async ({
      comfyPage,
      comfyFiles
    }) => {
      const { nodeRef, filename } = await addLoaderNodeWithFile(
        comfyPage,
        'LoadVideo',
        'Load Video',
        'file',
        { path: assetPath('video/video-preview-square.webm') },
        'video-preview-square'
      )
      comfyFiles.deleteAfterTest({ filename, type: 'input' })

      await comfyPage.appMode.enterAppModeWithInputs([
        [String(nodeRef.id), 'file']
      ])
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()

      const widgetItem = comfyPage.appMode.widgets.getWidgetItem(
        `${nodeRef.id}:file`
      )
      const video = widgetItem.locator('video')
      await expect(video).toBeVisible()
      await expect(video).toHaveAttribute('controls', '')
      await expect.poll(() => video.getAttribute('src')).toContain(filename)
    })

    test('Load Audio shows an inline audio preview, matching the normal editor', async ({
      comfyPage,
      comfyFiles
    }) => {
      const uploadName = `app-mode-audio-${Date.now()}.wav`
      const { nodeRef, filename } = await addLoaderNodeWithFile(
        comfyPage,
        'LoadAudio',
        'Load Audio',
        'audio',
        { name: uploadName, mimeType: 'audio/x-wav', buffer: getWav() },
        uploadName
      )
      comfyFiles.deleteAfterTest({ filename, type: 'input' })

      await comfyPage.appMode.enterAppModeWithInputs([
        [String(nodeRef.id), 'audio']
      ])
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()

      const widgetItem = comfyPage.appMode.widgets.getWidgetItem(
        `${nodeRef.id}:audio`
      )
      const audioPreview = new AudioPreview(widgetItem)
      await expect(audioPreview.play).toBeVisible()
      await expect
        .poll(() => audioPreview.audio.getAttribute('src'))
        .toContain(filename)

      expect(await audioPreview.isPlaying()).toBe(false)
      await audioPreview.play.click()
      await expect.poll(() => audioPreview.isPlaying()).toBe(true)
    })

    test('Load Image keeps its inline image preview (regression guard)', async ({
      comfyPage,
      comfyFiles
    }) => {
      const { nodeRef, filename } = await addLoaderNodeWithFile(
        comfyPage,
        'LoadImage',
        'Load Image',
        'image',
        { path: assetPath('test_upload_image.png') },
        'test_upload_image'
      )
      comfyFiles.deleteAfterTest({ filename, type: 'input' })

      await comfyPage.appMode.enterAppModeWithInputs([
        [String(nodeRef.id), 'image']
      ])
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()

      const widgetItem = comfyPage.appMode.widgets.getWidgetItem(
        `${nodeRef.id}:image`
      )
      const img = widgetItem.locator('img')
      await expect(img).toBeVisible()
      await expect.poll(() => img.getAttribute('src')).toContain(filename)
    })

    test('Load Video with no file selected shows the click-to-browse placeholder, not a broken preview', async ({
      comfyPage
    }) => {
      const nodeRef = await comfyPage.nodeOps.addNode(
        'LoadVideo',
        undefined,
        NODE_POSITION
      )
      // Force an empty selection regardless of what the server's file list
      // happens to default the combo widget to.
      await comfyPage.page.evaluate((id) => {
        const node = window.app!.graph!.getNodeById(id)
        const fileWidget = node?.widgets?.find((w) => w.name === 'file')
        if (fileWidget) fileWidget.value = ''
      }, nodeRef.id)

      await comfyPage.appMode.enterAppModeWithInputs([
        [String(nodeRef.id), 'file']
      ])
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()

      const widgetItem = comfyPage.appMode.widgets.getWidgetItem(
        `${nodeRef.id}:file`
      )
      await expect(widgetItem.locator('video')).toHaveCount(0)
      await expect(
        widgetItem.getByText('Click to browse or drag a video')
      ).toBeVisible()
    })

    test('Video preview survives toggling between App mode and the graph editor', async ({
      comfyPage,
      comfyFiles
    }) => {
      const { nodeRef, filename } = await addLoaderNodeWithFile(
        comfyPage,
        'LoadVideo',
        'Load Video',
        'file',
        { path: assetPath('video/video-preview-square.webm') },
        'video-preview-square'
      )
      comfyFiles.deleteAfterTest({ filename, type: 'input' })

      await comfyPage.appMode.enterAppModeWithInputs([
        [String(nodeRef.id), 'file']
      ])
      const widgetItem = comfyPage.appMode.widgets.getWidgetItem(
        `${nodeRef.id}:file`
      )
      await expect(widgetItem.locator('video')).toBeVisible()

      await comfyPage.appMode.toggleAppMode()
      await expect(comfyPage.appMode.linearWidgets).toBeHidden()

      await comfyPage.appMode.toggleAppMode()
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()
      await expect(widgetItem.locator('video')).toBeVisible()
      await expect
        .poll(() => widgetItem.locator('video').getAttribute('src'))
        .toContain(filename)
    })
  }
)
