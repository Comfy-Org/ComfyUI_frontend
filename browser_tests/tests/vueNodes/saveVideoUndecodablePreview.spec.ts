import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  CANT_PLAY_MESSAGE,
  IMAGE,
  PLAYABLE,
  PORTRAIT,
  SLOW,
  UNDECODABLE,
  WIDE,
  addNode,
  canvasPreviewVideo,
  filenameOf,
  output,
  waitForServed
} from '@e2e/fixtures/helpers/nodeOutputPreview'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

test.describe('Save Video preview of an undecodable output', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await mockViewFiles(comfyPage.page, {
      ...Object.fromEntries(
        [PLAYABLE, WIDE, PORTRAIT].map((file) => [
          file,
          { path: assetPath(`video/${file}`), contentType: 'video/webm' }
        ])
      ),
      [UNDECODABLE]: {
        path: assetPath(`video/${UNDECODABLE}`),
        contentType: 'video/quicktime'
      },
      [IMAGE]: {}
    })
  })

  test('canvas renderer replaces the previous run with a message when the new output cannot be decoded', async ({
    comfyPage,
    getWebSocket
  }) => {
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const nodeId = await addNode(comfyPage, 'SaveVideo')

    execution.executed('', nodeId, output(PLAYABLE))
    await expect
      .poll(() => canvasPreviewVideo(comfyPage.page))
      .toEqual({ file: PLAYABLE, decoded: true })

    const undecodableServed = waitForServed(comfyPage.page, UNDECODABLE)
    execution.executed('', nodeId, output(UNDECODABLE))
    await expect
      .poll(() => canvasPreviewVideo(comfyPage.page), {
        message: 'the previous run must not stay up as the new output preview'
      })
      .toBeNull()
    await undecodableServed
    await expect(
      comfyPage.page.locator('.comfy-img-preview').getByText(CANT_PLAY_MESSAGE)
    ).toBeVisible()
  })

  test('canvas renderer keeps the newer output when an older one fails late', async ({
    comfyPage,
    getWebSocket
  }) => {
    const { page } = comfyPage
    let slowRequests = 0
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    await page.route(
      (url) => filenameOf(url) === SLOW,
      async (route) => {
        slowRequests++
        await released
        await route.fulfill({ status: 404 })
      }
    )
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const nodeId = await addNode(comfyPage, 'SaveVideo')

    execution.executed('', nodeId, output(SLOW))
    await expect
      .poll(async () => {
        await canvasPreviewVideo(page)
        return slowRequests
      })
      .toBeGreaterThan(0)
    execution.executed('', nodeId, output(PLAYABLE))
    await expect
      .poll(() => canvasPreviewVideo(page))
      .toEqual({ file: PLAYABLE, decoded: true })

    const failureProbed = page.waitForRequest(
      (request) =>
        request.resourceType() === 'fetch' && filenameOf(request.url()) === SLOW
    )
    release()
    await failureProbed
    await comfyPage.nextFrame()

    expect(await canvasPreviewVideo(page)).toEqual({
      file: PLAYABLE,
      decoded: true
    })
  })

  test('canvas renderer fits the preview height to each video and keeps its width', async ({
    comfyPage,
    getWebSocket
  }) => {
    const { page } = comfyPage
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const nodeId = await addNode(comfyPage, 'SaveVideo')
    const sizes = () =>
      page.evaluate((id) => {
        const node = window.app!.graph.getNodeById(id)!
        const preview = node.widgets
          ?.find((w) => w.name === 'video-preview')
          ?.computeLayoutSize?.(node)
        return {
          previewWidth: preview?.minWidth,
          previewHeight: preview?.minHeight ?? 0,
          nodeWidth: node.size[0]
        }
      }, nodeId)

    execution.executed('', nodeId, output(WIDE))
    await expect
      .poll(() => canvasPreviewVideo(page))
      .toEqual({ file: WIDE, decoded: true })
    const wide = await sizes()

    execution.executed('', nodeId, output(PORTRAIT))
    await expect
      .poll(() => canvasPreviewVideo(page))
      .toEqual({ file: PORTRAIT, decoded: true })
    const portrait = await sizes()

    expect(portrait.previewWidth).toBe(wide.previewWidth)
    expect(portrait.nodeWidth).toBe(wide.nodeWidth)
    expect(portrait.previewHeight).toBeGreaterThan(wide.previewHeight)
  })

  test('canvas renderer drops the previous image when the new one fails to load', async ({
    comfyPage,
    getWebSocket
  }) => {
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const nodeId = await addNode(comfyPage, 'SaveImage')
    const loadedImages = () =>
      comfyPage.page.evaluate((id) => {
        window.app!.canvas.setDirty(true, true)
        return window.app!.graph.getNodeById(id)?.imgs?.length ?? 0
      }, nodeId)

    execution.executed('', nodeId, output(IMAGE, false))
    await expect.poll(loadedImages).toBe(1)

    execution.executed('', nodeId, output('missing.png', false))
    await expect.poll(loadedImages).toBe(0)
  })

  test(
    'Vue nodes renderer says the browser cannot play the output, then plays the next one',
    {
      tag: '@vue-nodes'
    },
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const nodeId = await addNode(comfyPage, 'SaveVideo')
      const node = comfyPage.vueNodes.getNodeLocator(nodeId)
      const video = node.getByTestId('main-video')
      const decoded = () =>
        video.evaluate(
          (v: HTMLVideoElement) =>
            v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        )

      execution.executed('', nodeId, output(PLAYABLE))
      await expect.poll(decoded).toBe(true)

      const undecodableServed = waitForServed(comfyPage.page, UNDECODABLE)
      execution.executed('', nodeId, output(UNDECODABLE))
      await undecodableServed
      await expect(node.getByText(CANT_PLAY_MESSAGE)).toBeVisible()
      await expect(node.getByText(UNDECODABLE)).toBeVisible()
      await expect(node.getByText('Invalid URL')).toBeHidden()
      await expect(video).toHaveCount(0)

      execution.executed('', nodeId, output(PLAYABLE))
      await expect.poll(decoded).toBe(true)
      await expect(node.getByText(CANT_PLAY_MESSAGE)).toBeHidden()
    }
  )
})
