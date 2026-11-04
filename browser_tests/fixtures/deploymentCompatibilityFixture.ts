import { DEPLOYMENT_LISTING } from '@e2e/fixtures/data/deploymentListing'
import { webSessionTest } from '@e2e/fixtures/webSessionFixture'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

export const deploymentCompatibilityTest = webSessionTest.extend({
  serverFeatures: {
    customer_io: undefined,
    ga_measurement_id: undefined,
    gtm_container_id: undefined,
    mixpanel_token: undefined,
    posthog_project_token: undefined,
    syftdata_source_id: undefined
  },
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      Object.defineProperty(AbortSignal, 'timeout', {
        configurable: true,
        value: undefined
      })
    })
    await page.route('**/api/workspaces/*/deployments', (route) =>
      route.fulfill(jsonRoute(DEPLOYMENT_LISTING))
    )
    await page.route('**/api/settings', (route) => route.fulfill(jsonRoute({})))
    await page.route('**/api/userdata**', (route) =>
      route.fulfill(jsonRoute([]))
    )
    await use(page)
  }
})
