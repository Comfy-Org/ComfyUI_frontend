import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { member, workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * The `?topup=1` deep link opens the credit top-up dialog on app load, gated
 * to users who can top up (personal users and team owners). Drives a raw
 * `page` so the cloud app boots against fully mocked endpoints, like the
 * pricing-table deep-link spec.
 */
const topUpHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Add more credits' })

test.describe('Top-up deep link', { tag: '@cloud' }, () => {
  test('opens the top-up dialog for a personal owner', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, { workspace: workspace('personal', 'owner') })

    await page.goto(`${APP_URL}/?topup=1`)

    await expect(topUpHeading(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]topup=/)
  })

  test('opens the top-up dialog for a team owner', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, {
      workspace: workspace('team', 'owner'),
      members: [
        member({
          email: CLOUD_SELF_EMAIL,
          role: 'owner',
          is_original_owner: true
        })
      ]
    })

    await page.goto(`${APP_URL}/?topup=1`)

    await expect(topUpHeading(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]topup=/)
  })

  test('routes a lapsed subscriber to the subscription paywall', async ({
    page
  }) => {
    test.slow()
    // The paywall fallthrough only renders when the remote config enforces
    // subscriptions, matching production cloud.
    await setupCloudApp(page, {
      workspace: workspace('personal', 'owner'),
      features: { subscription_required: true }
    })
    // Registered after setupCloudApp so this handler wins: the status fetch
    // the loader awaits reports a canceled subscription.
    await page.route('**/api/billing/status', (r) =>
      r.fulfill(
        jsonRoute({
          is_active: false,
          has_funds: false,
          subscription_status: 'canceled',
          billing_status: 'unpaid'
        })
      )
    )

    await page.goto(`${APP_URL}/?topup=1`)

    await expect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toBeVisible({ timeout: 45_000 })
    await expect(topUpHeading(page)).toBeHidden()
    await expect(page).not.toHaveURL(/[?&]topup=/)
  })

  test('is a silent no-op for a team member', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, {
      workspace: workspace('team', 'member'),
      members: [
        member({
          email: 'creator@test.comfy.org',
          role: 'owner',
          is_original_owner: true
        }),
        member({ email: CLOUD_SELF_EMAIL, role: 'member' })
      ]
    })

    await page.goto(`${APP_URL}/?topup=1`)

    // The loader strips the param for everyone before the eligibility gate, so
    // waiting for the clean URL is a real "loader ran" signal. window.app's
    // extensionManager is assigned in App.vue setup, long before the loader
    // runs at the tail of GraphCanvas onMounted, so it would resolve too early.
    await page.waitForURL((url) => !url.searchParams.has('topup'), {
      timeout: 45_000
    })
    await expect(topUpHeading(page)).toBeHidden()
  })
})
