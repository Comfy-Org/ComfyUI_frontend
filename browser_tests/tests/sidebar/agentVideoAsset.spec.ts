import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { AGENT_VIDEO_ASSET } from '@e2e/fixtures/data/assetFixtures'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'

// Regression from the assets-backed Media Assets panel (#15381): history
// records used to carry the original video URL, but an `/api/assets` video
// record has neither `thumbnail_url` nor `preview_url` (the backend only
// builds previews for images), so `MediaAssetCard.vue` left the `<video>`
// without a source and the tile rendered as an unplayable black square.
test.describe('Agent-generated video asset', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockCloudAssets({
      assets: [AGENT_VIDEO_ASSET],
      total: 1,
      has_more: false
    })

    // The card is grouped per job, so its `id` is the job id and the file's
    // own id lives in `user_metadata.assetId`. Only the file id serves the
    // MP4 (which carries an embedded workflow); every other content URL,
    // including the job id, gets the backend's 404 body. Playwright matches
    // the most recently registered route first, so the catch-all goes first.
    await comfyPage.page.route(
      /\/api\/assets\/[^/]+\/content(\?.*)?$/,
      async (route) =>
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            code: 'ASSET_NOT_FOUND',
            message: 'Asset not found'
          })
        })
    )
    await comfyPage.page.route(
      new RegExp(`/api/assets/${AGENT_VIDEO_ASSET.id}/content(\\?.*)?$`),
      async (route) =>
        await route.fulfill({
          path: assetPath('workflowInMedia/workflow.mp4'),
          contentType: 'video/mp4'
        })
    )
  })

  test('plays the video from its own content URL, not a black tile', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const card = tab.getAssetCardByName('agent_generated_video')
    await expect(card).toBeVisible()

    const video = card.getByTestId(TestIds.assets.videoPreview)
    await expect(video).toBeVisible()
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentSrc))
      .toContain(`/api/assets/${AGENT_VIDEO_ASSET.id}/content`)
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.videoWidth))
      .toBeGreaterThan(0)

    await video.click()

    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThan(0)
  })

  test('dragging the video asset onto the canvas opens its embedded workflow', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    const card = tab.getAssetCardByName('agent_generated_video')
    await expect(card).toBeVisible()

    // Mirrors the image counterpart, "Loading as workflow reuses asset
    // name" in assets.spec.ts: dropping a media asset that carries an
    // embedded workflow opens that workflow in a new tab named after the
    // asset - the same `handleFile` code path applies regardless of
    // whether the container is an image or a video.
    const targetPosition = { x: 400, y: 100 }
    await card.dragTo(comfyPage.canvas, { targetPosition })

    const getTabName = () => comfyPage.menu.topbar.getActiveTabName()
    await expect.poll(getTabName).toContain('agent_generated_video')
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(2)
  })
})
