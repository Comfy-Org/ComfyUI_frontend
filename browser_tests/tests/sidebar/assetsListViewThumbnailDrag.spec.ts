import { expect } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

declare global {
  interface Window {
    __lastDragStartPayload?: { types: string[]; uriList: string } | null
  }
}

// Regression test for a Sentry error in the assets panel's list view:
// `NotSupportedError: Failed to execute 'add' on 'DataTransferItemList':
// An item already exists for type 'text/uri-list'.`
//
// AssetsSidebarListView.vue makes each row a native drag source
// (`:draggable="true"` + `@dragstart="startAssetDrag"`), the same contract
// MediaAssetCard.vue uses in grid view. That is only safe when the row's own
// div is what the browser treats as the drag source. AssetsListItem.vue's
// thumbnail <img> has no `draggable="false"` guard, so a drag gesture that
// starts on the thumbnail image itself (not the row) triggers Chromium's
// built-in "drag an image" behavior, which pre-fills the DataTransfer with
// its own `text/uri-list` entry before the bubbled `dragstart` reaches the
// row's handler and calls `startAssetDrag()`, which then throws trying to
// add that type a second time. MediaImageTop.vue and Media3DTop.vue (grid
// view) already carry this guard; see assets3DCardDrag.spec.ts.
const PREVIEW_FILENAME = 'list_view_thumbnail.png'
const IMAGE_ASSET: Asset = {
  id: 'list-image-asset-001',
  name: 'output_list-001.png',
  tags: ['output'],
  mime_type: 'image/png',
  preview_url: `/api/view?filename=${PREVIEW_FILENAME}&type=output`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}
const IMAGE_ROW_NAME = 'output_list-001'
// ADR-ASSETS-DRAG-DROP-0035: the drag URI names the asset's file, never its
// preview, so it resolves through the assets-API content endpoint.
const ASSET_CONTENT_PATH = `/api/assets/${IMAGE_ASSET.id}/content`

function makeAssetsResponse(assets: Asset[]): ListAssetsResponse {
  return { assets, total: assets.length, has_more: false }
}

const test = comfyPageFixture.extend<{
  stubCloudAssets: void
  stubInputFiles: void
}>({
  stubCloudAssets: [
    async ({ page }, use) => {
      const pattern = /\/api\/assets(?:\?.*)?$/
      await page.route(pattern, (route) => {
        const url = new URL(route.request().url())
        if (url.searchParams.get('after')) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(makeAssetsResponse([]))
          })
        }
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeAssetsResponse([IMAGE_ASSET]))
        })
      })
      await mockViewFiles(page, { [PREVIEW_FILENAME]: {} })
      await use()
      await page.unroute(pattern)
    },
    { auto: true }
  ],
  stubInputFiles: [
    async ({ page }, use) => {
      const pattern = /\/internal\/files\/input(?:\?.*)?$/
      await page.route(pattern, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([])
        })
      )
      await use()
      await page.unroute(pattern)
    },
    { auto: true }
  ]
})

test.describe('Assets list view thumbnail drag', { tag: '@cloud' }, () => {
  test('dragging a list row thumbnail does not throw NotSupportedError', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(1)

    await tab.openSettingsMenu()
    await tab.listViewOption.click()
    await tab.closeSettingsMenu()

    const row = tab.listRowByName(IMAGE_ROW_NAME)
    await expect(row).toBeVisible()
    const thumbnail = row.locator('img')
    await expect(thumbnail).toBeVisible()
    const box = await thumbnail.boundingBox()
    if (!box) throw new Error('list row thumbnail has no layout box')

    using consoleErrors = collectConsoleErrors(comfyPage.page)

    await comfyPage.page.evaluate(() => {
      window.__lastDragStartPayload = null
      document.addEventListener(
        'dragstart',
        (event) => {
          const dt = event.dataTransfer
          window.__lastDragStartPayload = dt
            ? {
                types: Array.from(dt.types),
                uriList: dt.getData('text/uri-list')
              }
            : null
        },
        { once: true }
      )
    })

    await comfyPage.page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2
    )
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(box.x + box.width + 200, box.y + 40, {
      steps: 10
    })
    await comfyPage.page.mouse.up()

    await expect.poll(() => consoleErrors.errors).toEqual([])

    const dragStartPayload = await comfyPage.page.evaluate(
      () => window.__lastDragStartPayload
    )
    expect(dragStartPayload).not.toBeNull()
    expect(dragStartPayload?.types).toContain('application/x-comfy-asset-info')
    expect(dragStartPayload?.types).toContain('text/uri-list')
    expect(dragStartPayload?.uriList).toContain(ASSET_CONTENT_PATH)
  })
})
