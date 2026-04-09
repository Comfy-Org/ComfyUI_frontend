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

// Stub /api/assets before the app loads. The local ComfyUI backend has no
// /api/assets endpoint (returns 503), which poisons the assets store on
// first load. Narrow pattern avoids intercepting static /assets/*.js bundles.
//
// TODO: Consider moving this stub into ComfyPage fixture for all @cloud tests.
const test = comfyPageFixture.extend<{ stubCloudAssets: void }>({
  stubCloudAssets: [
    async ({ page }, use) => {
      await page.route('**/api/assets**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeAssetsResponse(CLOUD_ASSETS))
        })
      )
      await use()
      await page.unroute('**/api/assets**')
    },
    { auto: true }
  ]
})

test.describe('Asset-supported node default value', { tag: '@cloud' }, () => {
  test.afterEach(async ({ comfyPage }) => {
    await comfyPage.nodeOps.clearGraph()
  })

  test('should use first cloud asset when server default is not in assets', async ({
    comfyPage
  }) => {
    // The default workflow contains a CheckpointLoaderSimple node whose
    // server default (from object_info) is a local file not in cloud assets.
    // Wait for the existing node's asset widget to mount, confirming the
    // assets store has been populated from the stub before adding a new node.
    await expect
      .poll(
        () =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (n: { type: string }) => n.type === 'CheckpointLoaderSimple'
            )
            return node?.widgets?.find(
              (w: { name: string }) => w.name === 'ckpt_name'
            )?.type
          }),
        { timeout: 10_000 }
      )
      .toBe('asset')

    // Add a new CheckpointLoaderSimple — should use first cloud asset,
    // not the server's object_info default.
    const widgetValue = await comfyPage.page.evaluate(() => {
      const node = window.LiteGraph!.createNode('CheckpointLoaderSimple')
      window.app!.graph.add(node!)
      const widget = node!.widgets?.find(
        (w: { name: string }) => w.name === 'ckpt_name'
      )
      return String(widget?.value ?? '')
    })

    expect(widgetValue).toBe(CLOUD_ASSETS[0].name)
  })
})
