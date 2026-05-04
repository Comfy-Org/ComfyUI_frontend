import { expect } from '@playwright/test'
import type { Route } from '@playwright/test'

import type { Asset, ListAssetsResponse } from '@comfyorg/ingest-types'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

const WORKFLOW = 'missing/nested_subgraph_installed_model'
const OUTER_SUBGRAPH_NODE_ID = '205'
const LOTUS_MODEL_NAME = 'lotus-depth-d-v1-1.safetensors'

const LOTUS_DIFFUSION_MODEL: Asset = {
  id: 'test-lotus-depth-d-v1-1',
  name: LOTUS_MODEL_NAME,
  asset_hash:
    'blake3:0000000000000000000000000000000000000000000000000000000000000203',
  size: 1_024,
  mime_type: 'application/octet-stream',
  tags: ['models', 'diffusion_models'],
  created_at: '2026-05-05T00:00:00Z',
  updated_at: '2026-05-05T00:00:00Z',
  last_access_time: '2026-05-05T00:00:00Z',
  user_metadata: {
    filename: LOTUS_MODEL_NAME
  }
}

function makeAssetsResponse(assets: Asset[]): ListAssetsResponse {
  return { assets, total: assets.length, has_more: false }
}

function isDiffusionModelAssetRequest(url: string): boolean {
  const includeTags = new URL(url).searchParams.get('include_tags') ?? ''
  return includeTags.split(',').includes('diffusion_models')
}

function countDiffusionModelAssetRequests(requests: string[]): number {
  return requests.filter(isDiffusionModelAssetRequest).length
}

const test = comfyPageFixture.extend<{
  cloudAssetRequests: string[]
  stubCloudAssets: void
}>({
  cloudAssetRequests: async ({ page: _page }, use) => {
    await use([])
  },
  stubCloudAssets: [
    async ({ cloudAssetRequests, page }, use) => {
      const pattern = /\/api\/assets(?:\?.*)?$/
      const assetsRouteHandler = (route: Route) => {
        cloudAssetRequests.push(route.request().url())
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(makeAssetsResponse([LOTUS_DIFFUSION_MODEL]))
        })
      }

      await page.route(pattern, assetsRouteHandler)
      await use()
      await page.unroute(pattern, assetsRouteHandler)
    },
    { auto: true }
  ]
})

test.describe(
  'Errors tab - Cloud missing models',
  { tag: ['@cloud', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting(
        'Comfy.RightSidePanel.ShowErrorsTab',
        true
      )
      await comfyPage.settings.setSetting('Comfy.Assets.UseAssetAPI', true)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test('keeps installed models resolved after returning from a nested subgraph', async ({
      cloudAssetRequests,
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(WORKFLOW)

      const errorOverlay = comfyPage.page.getByTestId(
        TestIds.dialogs.errorOverlay
      )
      const errorsTab = comfyPage.page.getByTestId(
        TestIds.propertiesPanel.errorsTab
      )
      const panel = new PropertiesPanelHelper(comfyPage.page)

      await expect
        .poll(() => countDiffusionModelAssetRequests(cloudAssetRequests))
        .toBeGreaterThan(0)
      await expect(errorOverlay).toBeHidden()
      await panel.open(comfyPage.actionbar.propertiesButton)
      await expect(errorsTab).toBeHidden()
      await panel.close()

      await comfyPage.vueNodes.waitForNodes()
      await comfyPage.vueNodes.enterSubgraph(OUTER_SUBGRAPH_NODE_ID)
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
      await expect(errorOverlay).toBeHidden()

      const requestCountBeforeRootReturn =
        countDiffusionModelAssetRequests(cloudAssetRequests)

      await comfyPage.page.getByTestId(TestIds.breadcrumb.item('root')).click()
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
      await panel.open(comfyPage.actionbar.propertiesButton)

      await expect
        .poll(
          () =>
            countDiffusionModelAssetRequests(cloudAssetRequests) >
            requestCountBeforeRootReturn,
          { timeout: 10_000 }
        )
        .toBe(true)

      await expect(errorsTab).toBeHidden()
    })
  }
)
