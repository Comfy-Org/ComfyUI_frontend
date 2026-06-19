import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'

/**
 * getSurveyCompletedStatus fails safe: a transient 401 on `/` must not bounce a
 * working user to /cloud/survey, while a genuine 404 (survey never submitted)
 * must still route a not-completed user there. Drives a raw `page` so the cloud
 * app boots against fully mocked endpoints (`comfyPage` would reach the OSS
 * devtools backend during setup).
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

function jsonRoute(body: unknown) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body)
  }
}

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
  // Cloud user status (getUserCloudStatus) — an active account so the gate
  // proceeds to the survey check instead of bouncing back to login.
  await page.route('**/api/user', (r) =>
    r.fulfill(jsonRoute({ status: 'active' }))
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

// Genuine "not completed": the cloud backend returns 404 for a survey key that
// was never stored. This is the response that must still route to the survey.
async function mockSurveyNotCompleted(page: Page) {
  await page.route('**/api/settings/onboarding_survey', (r) =>
    r.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'NOT_FOUND', message: 'Setting not found' })
    })
  )
}

// Transient auth failure: a stale workspace token makes the authenticated
// survey check 401 — the hiccup that used to bounce working users.
async function mockSurveyTransient401(page: Page) {
  await page.route('**/api/settings/onboarding_survey', (r) =>
    r.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        code: 'UNAUTHORIZED',
        message: 'User authentication required'
      })
    })
  )
}

async function bootCloud(page: Page) {
  const auth = new CloudAuthHelper(page)
  await auth.mockAuth()
  // Pre-select the mock user to skip the user-select screen.
  await page.addInitScript(() => {
    localStorage.setItem('Comfy.userId', 'test-user-e2e')
  })
}

test.describe('Cloud onboarding survey gate', { tag: '@cloud' }, () => {
  test('a transient 401 on the survey check does not bounce a working user to the survey', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page)
    await mockSurveyTransient401(page)
    await bootCloud(page)

    await page.goto(APP_URL)

    // The full app boots — CloudSurveyView is a standalone onboarding view, so
    // reaching the extension manager proves we landed on the working app and
    // the transient 401 was treated as "completed", not a bounce.
    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })
    await expect(page).not.toHaveURL(/\/cloud\/survey/)
  })

  test('a not-completed (404) user landing on / is routed to the survey', async ({
    page
  }) => {
    test.setTimeout(60_000)

    await mockCloudBoot(page)
    await mockSurveyNotCompleted(page)
    await bootCloud(page)

    await page.goto(APP_URL)

    await expect(page).toHaveURL(/\/cloud\/survey/, { timeout: 45_000 })
  })
})
