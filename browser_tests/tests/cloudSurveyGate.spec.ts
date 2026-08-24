import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import {
  cloudAppExpect,
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'

/**
 * getSurveyCompletedStatus fails safe: a transient 401 on `/` must not bounce a
 * working user to /cloud/survey, while a genuine 404 (survey never submitted)
 * must still route a not-completed user there. Drives a raw `page` so the cloud
 * app boots against fully mocked endpoints (`comfyPage` would reach the OSS
 * devtools backend during setup).
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

// `/api/features` is the remote-config source: production builds resolve
// `onboardingSurveyEnabled` from it (the `ff:` localStorage override is
// dev-only). Enable the survey so the gate is actually live.
const BOOT_FEATURES = {
  onboarding_survey_enabled: true
} satisfies RemoteConfig

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

test.describe('Cloud onboarding survey gate', { tag: '@cloud' }, () => {
  test('a transient 401 on the survey check does not bounce a working user to the survey', async ({
    page
  }) => {
    await mockCloudBoot(page, { features: BOOT_FEATURES })
    await mockSurveyTransient401(page)
    await bootCloud(page)

    await page.goto(APP_URL)

    // The full app boots — CloudSurveyView is a standalone onboarding view, so
    // reaching the extension manager proves we landed on the working app and
    // the transient 401 was treated as "completed", not a bounce.
    await waitForCloudApp(page)
    await expect(page).not.toHaveURL(/\/cloud\/survey/)
  })

  test('a not-completed (404) user landing on / is routed to the survey', async ({
    page
  }) => {
    await mockCloudBoot(page, { features: BOOT_FEATURES })
    await mockSurveyNotCompleted(page)
    await bootCloud(page)

    await page.goto(APP_URL)

    await cloudAppExpect(page).toHaveURL(/\/cloud\/survey/)
  })
})
