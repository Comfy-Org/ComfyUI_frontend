import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  addSaveVideo,
  canvasVideo,
  output,
  videoPreviewSize
} from '@e2e/fixtures/helpers/nodeOutputPreview'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import { webSocketFixture } from '@e2e/fixtures/ws'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const WIDE = 'video-preview-wide.webm'
const PORTRAIT = 'video-preview-portrait.webm'
const PRORES = 'save-video-prores.mov'
const SLOW = 'slow.webm'
const CANT_PLAY = "This video can't be played in the browser."

test.describe('Save Video preview', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await mockViewFiles(comfyPage.page, {
      [WIDE]: { path: assetPath(`video/${WIDE}`), contentType: 'video/webm' },
      [PORTRAIT]: {
        path: assetPath(`video/${PORTRAIT}`),
        contentType: 'video/webm'
      },
      [PRORES]: {
        path: assetPath(`video/${PRORES}`),
        contentType: 'video/quicktime'
      }
    })
  })

  test('canvas renderer shows the newest run at its own size, or says it cannot be played', async ({
    comfyPage,
    getWebSocket
  }) => {
    const { page } = comfyPage
    let slowRequested = false
    let release!: () => void
    const released = new Promise<void>((resolve) => (release = resolve))
    await page.route(
      (url) => url.href.includes(SLOW),
      async (route) => {
        slowRequested = true
        await released
        await route.fulfill({ status: 404 })
      }
    )
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const nodeId = await addSaveVideo(comfyPage)
    const landscape = { decoded: true, portrait: false }

    execution.executed('', nodeId, output(SLOW))
    await expect
      .poll(() => canvasVideo(page).then(() => slowRequested))
      .toBe(true)
    execution.executed('', nodeId, output(WIDE))
    await expect.poll(() => canvasVideo(page)).toEqual(landscape)
    const slowFailed = page.waitForRequest(
      (request) =>
        request.resourceType() === 'fetch' && request.url().includes(SLOW)
    )
    release()
    await slowFailed
    await comfyPage.nextFrame()
    expect(await canvasVideo(page)).toEqual(landscape)
    const wide = await videoPreviewSize(page, nodeId)

    execution.executed('', nodeId, output(PORTRAIT))
    await expect
      .poll(() => canvasVideo(page))
      .toEqual({ decoded: true, portrait: true })
    const portrait = await videoPreviewSize(page, nodeId)
    expect(portrait.minWidth).toBe(wide.minWidth)
    expect(portrait.nodeWidth).toBe(wide.nodeWidth)
    expect(portrait.minHeight).toBeGreaterThan(wide.minHeight)

    execution.executed('', nodeId, output(PRORES))
    await expect.poll(() => canvasVideo(page)).toBeNull()
    await expect(
      page.locator('.comfy-img-preview').getByText(CANT_PLAY)
    ).toBeVisible()
  })

  test(
    'Vue nodes renderer names the output the browser cannot play',
    { tag: '@vue-nodes' },
    async ({ comfyPage, getWebSocket }) => {
      const execution = new ExecutionHelper(comfyPage, await getWebSocket())
      const nodeId = await addSaveVideo(comfyPage)
      const node = comfyPage.vueNodes.getNodeLocator(nodeId)

      execution.executed('', nodeId, output(PRORES))
      await expect(node.getByText(CANT_PLAY)).toBeVisible()
      await expect(node.getByText(PRORES)).toBeVisible()
    }
  )
})
