import type { Route } from '@playwright/test'

import type { ListAssetsResponse } from '@comfyorg/ingest-types'
import { assetRequestIncludesTag } from '@e2e/fixtures/assetApiFixture'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import {
  jobOutputInsertionAssets,
  jobOutputInsertionJobs
} from '@e2e/fixtures/data/jobOutputInsertion'
import { JobsRouteMocker } from '@e2e/fixtures/jobsRouteFixture'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { routeObjectInfoFromSetupApi } from '@e2e/fixtures/utils/objectInfo'

const ASSETS_ROUTE_PATTERN = /\/api\/assets(?:\?.*)?$/

export const jobOutputInsertionTest = comfyPageFixture.extend({
  page: async ({ page }, use) => {
    const jobsApi = new JobsRouteMocker(page)

    async function assetsRouteHandler(route: Route) {
      const assets = assetRequestIncludesTag(route.request().url(), 'output')
        ? jobOutputInsertionAssets
        : []
      const response: ListAssetsResponse = {
        assets,
        total: assets.length,
        has_more: false
      }
      await route.fulfill({ json: response })
    }

    await page.route(ASSETS_ROUTE_PATTERN, assetsRouteHandler)
    await mockCloudBoot(page, {
      features: {},
      settings: {
        'Comfy.Queue.QPOV2': false,
        'Comfy.RightSidePanel.ShowErrorsTab': true,
        'Comfy.TutorialCompleted': true,
        'Comfy.UseNewMenu': 'Top',
        'Comfy.VersionCompatibility.DisableWarnings': true
      }
    })
    await mockBilling(page)
    await jobsApi.mockJobsScenario({
      history: jobOutputInsertionJobs,
      queue: []
    })
    const unrouteObjectInfo = await routeObjectInfoFromSetupApi(page)

    try {
      await use(page)
    } finally {
      await page.unroute(ASSETS_ROUTE_PATTERN, assetsRouteHandler)
      await unrouteObjectInfo()
    }
  }
})
