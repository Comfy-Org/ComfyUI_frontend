import { expect } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  STABLE_CHECKPOINT,
  STABLE_CHECKPOINT_2
} from '@e2e/fixtures/data/assetFixtures'

function makeAssetsResponse(assets: Asset[]): ListAssetsResponse {
  return { assets, total: assets.length, has_more: false }
}

const CLOUD_ASSETS: Asset[] = [STABLE_CHECKPOINT, STABLE_CHECKPOINT_2]
const WAITING_FOR_WIDGET_TYPE = 'waiting:type'
const WAITING_FOR_WIDGET_VALUE = 'waiting:value'

// Stub /api/assets before the app loads. The local ComfyUI backend has no
// /api/assets endpoint (returns 503), which poisons the assets store on
// first load. Narrow pattern avoids intercepting static /assets/*.js bundles.
//
// TODO: Consider moving this stub into ComfyPage fixture for all @cloud tests.
const test = comfyPageFixture.extend<{
  cloudAssetRequests: string[]
  stubCloudAssets: void
}>({
  cloudAssetRequests: async ({ page: _page }, use) => {
    await use([])
  },
  stubCloudAssets: [
    async ({ cloudAssetRequests, page }, use) => {
      const pattern = '**/api/assets?*'
      await page.route(pattern, (route) => {
        cloudAssetRequests.push(route.request().url())
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeAssetsResponse(CLOUD_ASSETS))
        })
      })
      await use()
      await page.unroute(pattern)
    },
    { auto: true }
  ]
})

test.describe('Asset-supported node default value', { tag: '@cloud' }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
  })

  test('should use first cloud asset when server default is not in assets', async ({
    cloudAssetRequests,
    comfyPage
  }) => {
    // Wait for the checkpoint asset query to complete and the existing widget
    // to upgrade into asset mode before creating a fresh node. The current
    // default node may keep a previously resolved value; what matters is that
    // new nodes resolve against the cloud asset list after the fetch.
    await expect
      .poll(() =>
        cloudAssetRequests.some((url) => {
          const includeTags =
            new URL(url).searchParams.get('include_tags') ?? ''
          return includeTags.split(',').includes('checkpoints')
        })
      )
      .toBe(true)

    await expect
      .poll(
        () =>
          comfyPage.page.evaluate((waitingForWidgetType) => {
            const node = window.app!.graph.nodes.find(
              (n: { type: string }) => n.type === 'CheckpointLoaderSimple'
            )
            return (
              node?.widgets?.find(
                (w: { name: string }) => w.name === 'ckpt_name'
              )?.type ?? waitingForWidgetType
            )
          }, WAITING_FOR_WIDGET_TYPE),
        { timeout: 10_000 }
      )
      .toBe('asset')

    // Add a new CheckpointLoaderSimple — should use first cloud asset,
    // not the server's object_info default.
    // Production resolves via getAssetFilename (user_metadata.filename →
    // metadata.filename → asset.name). Test fixtures have no metadata
    // filename, so asset.name is the resolved value.
    const nodeId = await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('CheckpointLoaderSimple')
      window.app!.graph.add(node!)
      return node!.id
    })

    // Wait for the asset widget to mount AND its value to resolve.
    // The widget type becomes 'asset' before the value is populated,
    // so poll for both conditions together to avoid a race where the
    // type check passes but the value is still the placeholder.
    await expect
      .poll(
        () =>
          comfyPage.page.evaluate(
            ({ id, waitingForWidgetType, waitingForWidgetValue }) => {
              const node = window.app!.graph.getNodeById(id)
              const widget = node?.widgets?.find(
                (w: { name: string }) => w.name === 'ckpt_name'
              )
              if (widget?.type !== 'asset') return waitingForWidgetType
              const val = String(widget?.value ?? '')
              return val === 'Select model' ? waitingForWidgetValue : val
            },
            {
              id: nodeId,
              waitingForWidgetType: WAITING_FOR_WIDGET_TYPE,
              waitingForWidgetValue: WAITING_FOR_WIDGET_VALUE
            }
          ),
        { timeout: 15_000 }
      )
      .toBe(CLOUD_ASSETS[0].name)
  })
})
