import {
  DEPLOYMENT_LISTING,
  JUST_READY_COMPATIBLE,
  JUST_READY_DEPLOYMENT_LISTING,
  JUST_READY_UNKNOWN
} from '@e2e/fixtures/data/deploymentListing'
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
    await page.route('**/api/settings', (route) =>
      route.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
    )
    await page.route('**/api/userdata**', (route) =>
      route.fulfill(jsonRoute([]))
    )
    await use(page)
  }
})

export const deploymentRecheckTest = deploymentCompatibilityTest.extend({
  serverFeatures: async ({ serverFeatures }, use) => {
    await use({
      ...serverFeatures,
      deployment_compatibility_marks_enabled: true
    })
  },
  page: async ({ page }, use) => {
    let compatibilityChecks = 0
    await page.route('**/api/workspaces/*/deployments', (route) =>
      route.fulfill(jsonRoute(JUST_READY_DEPLOYMENT_LISTING))
    )
    await page.route(
      '**/api/workspaces/*/deployments/compatibility',
      (route) => {
        compatibilityChecks++
        return route.fulfill(
          jsonRoute(
            compatibilityChecks === 1
              ? JUST_READY_UNKNOWN
              : JUST_READY_COMPATIBLE
          )
        )
      }
    )
    await use(page)
  }
})
