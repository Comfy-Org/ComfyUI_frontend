import { mergeTests } from '@playwright/test'
import type { Page } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const PLAYABLE = 'video-preview-square.webm'
const UNDECODABLE = 'save-video-prores.mov'

async function addSaveVideoNode(comfyPage: ComfyPage) {
  const node = await comfyPage.nodeOps.addNode('SaveVideo', undefined, {
    x: 300,
    y: 150
  })
  return String(node.id)
}

const videoOutput = (filename: string) => ({
  images: [{ filename, subfolder: '', type: 'output' }],
  animated: [true]
})

function canvasPreviewVideo(page: Page) {
  return page.evaluate(() => {
    window.app!.canvas.setDirty(true, true)
    const video = document.querySelector<HTMLVideoElement>(
      '.comfy-img-preview video'
    )
    if (!video) return null
    return {
      file: new URL(video.src).searchParams.get('filename'),
      decoded: video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    }
  })
}

test.describe('Save Video preview of an undecodable output', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await mockViewFiles(comfyPage.page, {
      [PLAYABLE]: {
        path: assetPath(`video/${PLAYABLE}`),
        contentType: 'video/webm'
      },
      [UNDECODABLE]: {
        path: assetPath(`video/${UNDECODABLE}`),
        contentType: 'video/quicktime'
      }
    })
  })

  test('canvas renderer drops the previous run when the new output cannot be decoded', async ({
    comfyPage,
    getWebSocket
  }) => {
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const nodeId = await addSaveVideoNode(comfyPage)

    execution.executed('', nodeId, videoOutput(PLAYABLE))
    await expect
      .poll(() => canvasPreviewVideo(comfyPage.page))
      .toEqual({ file: PLAYABLE, decoded: true })

    execution.executed('', nodeId, videoOutput(UNDECODABLE))
    await expect
      .poll(() => canvasPreviewVideo(comfyPage.page), {
        message: 'the previous run must not stay up as the new output preview'
      })
      .toBeNull()
  })

  test.describe('Vue nodes renderer', { tag: '@vue-nodes' }, () => {
    test('previews a playable output', async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const nodeId = await addSaveVideoNode(comfyPage)

      execution.executed('', nodeId, videoOutput(PLAYABLE))

      const video = comfyPage.vueNodes
        .getNodeLocator(nodeId)
        .getByTestId('main-video')
      await expect
        .poll(() =>
          video.evaluate(
            (v: HTMLVideoElement) =>
              v.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          )
        )
        .toBe(true)
    })

    test('says the browser cannot play the output', async ({
      comfyPage,
      getWebSocket
    }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const nodeId = await addSaveVideoNode(comfyPage)
      const node = comfyPage.vueNodes.getNodeLocator(nodeId)

      execution.executed('', nodeId, videoOutput(PLAYABLE))
      await expect(node.getByTestId('main-video')).toBeVisible()

      execution.executed('', nodeId, videoOutput(UNDECODABLE))

      await expect(
        node.getByText(
          "Your browser can't play this video. Download it to view it in another app."
        )
      ).toBeVisible()
      await expect(node.getByText(UNDECODABLE)).toBeVisible()
      await expect(node.getByText('Invalid URL')).toBeHidden()
      await expect(node.getByTestId('main-video')).toHaveCount(0)
    })
  })
})
