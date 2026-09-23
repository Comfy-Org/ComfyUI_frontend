import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { AGENT_VIDEO_ASSET } from '@e2e/fixtures/data/assetFixtures'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { expect } from '@playwright/test'

// PM-1401: dragging an asset out of the panel did nothing while the panel was
// in list view, and worked in grid view. `MediaAssetCard` was the only thing
// that set `draggable` and wrote the drag payload, so a list row never started
// a drag at all. Both view modes now publish the payload through
// `startAssetDrag`, so the drop side stays view-agnostic.
// https://linear.app/comfyorg/issue/PM-1401
test.describe('Assets list view drag', { tag: '@cloud' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.assets.mockCloudAssets({
      assets: [AGENT_VIDEO_ASSET],
      total: 1,
      has_more: false
    })

    // Only the file's own id serves the MP4 that carries the embedded
    // workflow; every other content URL answers the backend's 404 body.
    // Playwright matches the most recently registered route first, so the
    // catch-all goes first.
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

  test('dragging a list row carries the asset, as dragging a grid card does', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()

    await tab.openSettingsMenu()
    await tab.listViewOption.click()

    const row = tab.listViewItems.first()
    await expect(row).toBeVisible()

    // The asset's own drop effect is the observable: the canvas loads the
    // workflow embedded in the dropped file and names the tab after it. The
    // grid counterpart asserts the same thing in agentVideoAsset.spec.ts, so a
    // regression in either view mode shows up as the same failure.
    await row.dragTo(comfyPage.canvas, {
      targetPosition: { x: 400, y: 100 }
    })

    await expect
      .poll(() => comfyPage.menu.topbar.getActiveTabName())
      .toContain('agent_generated_video')
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(2)
  })
})
