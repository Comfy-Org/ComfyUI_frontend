import { expect } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { collectConsoleErrors } from '@e2e/fixtures/utils/consoleErrorCollector'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

// Regression test for the Sentry error CLOUD-FRONTEND-STAGING-4J4:
// `NotSupportedError: Failed to execute 'add' on 'DataTransferItemList':
// An item already exists for type 'text/uri-list'.`
//
// MediaAssetCard.vue's dragStart() calls
// `dataTransfer.items.add(url, 'text/uri-list')` once per drag. That is safe
// only when the card's own draggable div is the native drag source.
// MediaImageTop.vue's <img> sets `:draggable="false"` so the browser never
// treats the thumbnail itself as a drag source. Media3DTop.vue's <img> now
// carries the same guard, so a real drag gesture starting on the thumbnail
// image (not the card div) no longer triggers Chromium's built-in
// "drag an image" behavior, which used to pre-fill the DataTransfer with its
// own `text/uri-list` entry before the bubbled `dragstart` reached the
// card's handler.
const PREVIEW_FILENAME = 'preview_3d-thumbnail.png'
const THREE_D_ASSET: Asset = {
  id: '3d-asset-001',
  name: 'output_3d-001.glb',
  tags: ['output'],
  // Media3DTop.vue only renders the <img> immediately when both preview_id
  // and preview_url are present; preview_id must be a UUID to pass the
  // response schema's preview_id: z.string().uuid() (inherited from
  // @comfyorg/ingest-types). Without it, the card falls back to querying the
  // server for a preview by filename, which this mock does not serve.
  preview_id: '54e35f35-63ae-4983-b43e-defe504869c1',
  preview_url: `/api/view?filename=${PREVIEW_FILENAME}&type=output`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}
// MediaAssetCard renders the filename *without* extension via
// getFilenameDetails(...).filename, so card-text matching uses the basename.
const THREE_D_CARD_NAME = 'output_3d-001'

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
          body: JSON.stringify(makeAssetsResponse([THREE_D_ASSET]))
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

test.describe('3D asset card drag', { tag: '@cloud' }, () => {
  test('dragging the 3D thumbnail image does not throw NotSupportedError', async ({
    comfyPage
  }) => {
    const tab = comfyPage.menu.assetsTab
    await tab.open()
    await tab.waitForAssets(1)

    const card = tab.getAssetCardByName(THREE_D_CARD_NAME)
    const thumbnail = card.locator('img')
    await expect(thumbnail).toBeVisible()
    const box = await thumbnail.boundingBox()
    if (!box) throw new Error('3D asset thumbnail has no layout box')

    using consoleErrors = collectConsoleErrors(comfyPage.page)

    await comfyPage.page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2
    )
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(box.x + box.width + 40, box.y + 40, {
      steps: 10
    })
    await comfyPage.page.mouse.up()
    await comfyPage.nextFrame()

    const notSupportedErrors = consoleErrors.errors.filter((error) =>
      error.includes('NotSupportedError')
    )
    expect(notSupportedErrors).toEqual([])
  })
})
