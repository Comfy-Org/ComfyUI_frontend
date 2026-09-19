import { expect } from '@playwright/test'

import type { Asset } from '@comfyorg/ingest-types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'

// Root cause (frontend, confirmed by reading the code):
// `MediaAssetCard.vue`'s `adaptedAsset` computed sets a video tile's `src` to
// `asset.thumbnail_url || asset.preview_url || ''`. The backend only builds a
// preview for image assets, so a video generated through the Comfy Agent /
// cloud path always carries empty `thumbnail_url`/`preview_url` fields on the
// `/api/assets` record - unlike the '3D' media kind, which already falls back
// to `getAssetUrl(asset)` (a client-constructed `/api/view` URL) when no
// server preview exists. Video has no such fallback, so the tile renders a
// solid black square with an unplayable `<video>` element.
//
// This asset shape - a video record with no `thumbnail_url`/`preview_url` -
// is exactly what `/api/assets` returns for agent-generated video today, so
// it is reproduced here directly at that network boundary (the same
// endpoint and fixture, `AssetsHelper.mockCloudAssets`, that the existing
// "Assets sidebar - cloud exports" tests in `assets.spec.ts` use), rather
// than through a synthetic unit-level mock.
const AGENT_VIDEO_ASSET: Asset = {
  id: '11111111-1111-4111-a111-111111111111',
  name: 'agent_generated_video.mp4',
  job_id: '22222222-2222-4222-a222-222222222222',
  mime_type: 'video/mp4',
  tags: ['output'],
  created_at: '2026-09-18T00:00:00.000Z',
  updated_at: '2026-09-18T00:00:00.000Z'
  // No preview_url / thumbnail_url - matches the current agent/cloud
  // backend behavior for video outputs.
}

test.describe('Agent-generated video asset', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockCloudAssets({
      assets: [AGENT_VIDEO_ASSET],
      total: 1,
      has_more: false
    })
  })

  test('renders a real thumbnail and a playable video, not a black tile', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    const card = tab.getAssetCardByName('agent_generated_video')
    await expect(card).toBeVisible()

    const video = card.locator('video')
    await expect(video).toBeVisible()

    // A real content src, not the empty string MediaAssetCard's
    // `thumbnail_url || preview_url || ''` fallback used to produce for
    // video when the backend has left both fields empty.
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentSrc))
      .not.toBe('')
  })

  test('dragging the video asset onto the canvas carries its workflow metadata', async ({
    comfyPage
  }) => {
    // The card is grouped per job, so its `id` is the job id and the file's
    // own id lives in `user_metadata.assetId`. Only the file id serves the
    // MP4 (with an embedded workflow); every other content URL, including
    // the job id the drag used to publish, gets the backend's 404 body.
    // Playwright matches the most recently registered route first, so the
    // catch-all must be registered before the asset-id route.
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
