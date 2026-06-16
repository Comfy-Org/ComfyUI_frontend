import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'

/**
 * Cloud onboarding survey gate — FE-739.
 *
 * Regression coverage for the structural half of the fix: the survey is gated
 * post-login only (UserCheckView), never by a mid-session navigation. Both
 * cases run with the survey flag ON and the status endpoint reporting "not
 * completed" (a definitive 200 with empty value — the one signal that still
 * forces the survey), so the only thing that changes the outcome is *where*
 * the gate lives.
 *
 * - Landing on `/` (the working app) must NOT bounce to the survey. Before the
 *   fix the router `/` guard ran the gate here and yanked working users out.
 * - Hitting `/cloud/user-check` (the post-login door) must still gate to the
 *   survey, proving the consolidation didn't make onboarding unreachable.
 *
 * Drives a raw `page` (not the `comfyPage` fixture) so the cloud app boots
 * against fully mocked endpoints; `comfyPage` would try to reach the OSS
 * devtools backend during setup.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const jsonRoute = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

async function mockCloudBoot(page: Page) {
  // `/api/features` is the remote-config source: production builds resolve
  // `onboardingSurveyEnabled` from it (the `ff:` localStorage override is
  // dev-only). Enable the survey so the gate is actually live.
  await page.route('**/api/features', (r) =>
    r.fulfill(
      jsonRoute({ onboarding_survey_enabled: true } satisfies RemoteConfig)
    )
  )
  await page.route('**/api/system_stats', (r) =>
    r.fulfill(jsonRoute(mockSystemStats))
  )
  await page.route('**/api/users', (r) =>
    r.fulfill(
      jsonRoute({
        storage: 'server',
        migrated: true,
        users: { 'test-user-e2e': 'E2E Test User' }
      })
    )
  )
  // Cloud user status (getUserCloudStatus) — an active account so UserCheckView
  // proceeds to the survey check instead of bouncing back to login.
  await page.route('**/api/user', (r) =>
    r.fulfill(jsonRoute({ status: 'active' }))
  )
  // Survey status (getSurveyCompletedStatus): a definitive 200 with empty value
  // = "not completed", the only response that still routes to the survey.
  await page.route('**/api/settings/onboarding_survey', (r) =>
    r.fulfill(jsonRoute({ value: {} }))
  )
  await page.route('**/api/settings', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/auth/session', (r) =>
    r.fulfill(jsonRoute({ token: 'mock-workspace-token' }))
  )
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))
}

async function bootCloud(page: Page) {
  const auth = new CloudAuthHelper(page)
  await auth.mockAuth()
  // Pre-select the mock user to skip the user-select screen.
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
  })
}

test.describe(
  'Cloud onboarding survey gate (FE-739)',
  { tag: '@cloud' },
  () => {
    test('does not bounce a working user on / to the survey', async ({
      page
    }) => {
      test.setTimeout(60_000)

      await mockCloudBoot(page)
      await bootCloud(page)

      await page.goto(APP_URL)

      // The full app boots — UserCheckView/CloudSurveyView are standalone
      // onboarding views, so reaching the extension manager proves we landed on
      // the working app and were never routed to the survey.
      await page.waitForFunction(() => !!window.app?.extensionManager, null, {
        timeout: 45_000
      })
      await expect(page).not.toHaveURL(/\/cloud\/survey/)
    })

    test('still gates to the survey from the post-login user-check', async ({
      page
    }) => {
      test.setTimeout(60_000)

      await mockCloudBoot(page)
      await bootCloud(page)

      await page.goto(`${APP_URL}/cloud/user-check`)

      await expect(page).toHaveURL(/\/cloud\/survey/, { timeout: 45_000 })
    })
  }
)
