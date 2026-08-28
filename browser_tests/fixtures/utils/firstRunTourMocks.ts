import type { Page } from '@playwright/test'

import { EMPTY_ASSET_RESPONSE } from '@e2e/fixtures/data/assetFixtures'
import {
  ACTIVE_PERSONAL_BILLING_STATUS,
  ONBOARDING_TOUR_REMOTE_CONFIG
} from '@e2e/fixtures/data/cloudWorkspace'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

/**
 * The install the first-run tour needs: the tour flag on, a workspace funded
 * enough to run, and a backend serving no assets. Both onboarding suites enter
 * through here, so neither can drift from the other.
 */
export async function mockFirstRunTourBackend(page: Page) {
  await page.route('**/api/features', (route) =>
    route.fulfill(jsonRoute(ONBOARDING_TOUR_REMOTE_CONFIG))
  )
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(jsonRoute(ACTIVE_PERSONAL_BILLING_STATUS))
  )
  await page.route('**/api/assets**', (route) =>
    route.fulfill(jsonRoute(EMPTY_ASSET_RESPONSE))
  )
}
