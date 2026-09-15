import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { createBillingCapabilities } from '@e2e/fixtures/data/billingCapabilities'
import { ENDED_STANDARD_BILLING_STATUS } from '@e2e/fixtures/data/cloudWorkspace'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { member, workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * The `?topup=1` deep link opens the credit top-up dialog on app load, gated
 * to users who can top up (personal users and team owners). Drives a raw
 * `page` so the cloud app boots against fully mocked endpoints, like the
 * pricing-table deep-link spec.
 */
const topUpDialog = (page: Page) => page.getByTestId('top-up-pay-amount')

test.describe('Top-up deep link', { tag: '@cloud' }, () => {
  test('opens the top-up dialog for a non-Enterprise owner', async ({
    page
  }) => {
    test.slow()
    const personalWorkspace = workspace('personal', 'owner')
    await setupCloudApp(page, {
      workspace: personalWorkspace,
      billingCapabilities: createBillingCapabilities(personalWorkspace.id)
    })
    const capabilityRequest = page.waitForRequest('**/api/billing/capabilities')

    await page.goto(`${APP_URL}/?topup=1`)

    expect((await capabilityRequest).method()).toBe('GET')
    await expect(topUpDialog(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]topup=/)
  })

  test('opens the top-up dialog for an Enterprise owner', async ({ page }) => {
    test.slow()
    const teamWorkspace = workspace('team', 'owner')
    await setupCloudApp(page, {
      workspace: teamWorkspace,
      members: [
        member({
          email: CLOUD_SELF_EMAIL,
          role: 'owner',
          is_original_owner: true
        })
      ],
      billingCapabilities: createBillingCapabilities(teamWorkspace.id, {
        can_subscribe_self_serve: false
      })
    })

    await page.goto(`${APP_URL}/?topup=1`)

    await expect(topUpDialog(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]topup=/)
  })

  test('routes a lapsed subscriber to the subscription paywall', async ({
    page
  }) => {
    test.slow()
    const personalWorkspace = workspace('personal', 'owner')
    await setupCloudApp(page, {
      workspace: personalWorkspace,
      features: { subscription_required: true },
      billingStatus: ENDED_STANDARD_BILLING_STATUS,
      billingCapabilities: createBillingCapabilities(personalWorkspace.id, {
        can_top_up: false,
        can_subscribe_self_serve: true
      })
    })

    await page.goto(`${APP_URL}/?topup=1`)

    await expect(
      page.getByRole('heading', { name: 'Choose a Plan' })
    ).toBeVisible({ timeout: 45_000 })
    await expect(topUpDialog(page)).toBeHidden()
    await expect(page).not.toHaveURL(/[?&]topup=/)
  })

  test('is a silent no-op for a team member', async ({ page }) => {
    test.slow()
    const teamWorkspace = workspace('team', 'member')
    await setupCloudApp(page, {
      workspace: teamWorkspace,
      members: [
        member({
          email: 'creator@test.comfy.org',
          role: 'owner',
          is_original_owner: true
        }),
        member({ email: CLOUD_SELF_EMAIL, role: 'member' })
      ],
      billingCapabilities: createBillingCapabilities(teamWorkspace.id, {
        can_top_up: false,
        can_subscribe_self_serve: false
      })
    })

    await page.goto(`${APP_URL}/?topup=1`)

    // The loader strips the param for everyone before the eligibility gate, so
    // waiting for the clean URL is a real "loader ran" signal. window.app's
    // extensionManager is assigned in App.vue setup, long before the loader
    // runs at the tail of GraphCanvas onMounted, so it would resolve too early.
    await page.waitForURL((url) => !url.searchParams.has('topup'), {
      timeout: 45_000
    })
    await expect(topUpDialog(page)).toBeHidden()
  })

  test('preserves the deep link until capabilities finish loading', async ({
    page
  }) => {
    test.slow()
    const personalWorkspace = workspace('personal', 'owner')
    let resolveCapabilities!: (
      value: ReturnType<typeof createBillingCapabilities>
    ) => void
    const pendingCapabilities = new Promise<
      ReturnType<typeof createBillingCapabilities>
    >((resolve) => {
      resolveCapabilities = resolve
    })
    await setupCloudApp(page, {
      workspace: personalWorkspace,
      billingCapabilities: pendingCapabilities
    })
    const capabilityRequest = page.waitForRequest('**/api/billing/capabilities')

    await page.goto(`${APP_URL}/?topup=1`)
    await capabilityRequest

    await expect(page).toHaveURL(/[?&]topup=1/)
    await expect(topUpDialog(page)).toBeHidden()

    resolveCapabilities(createBillingCapabilities(personalWorkspace.id))

    await expect(topUpDialog(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]topup=/)
  })

  test('uses the top-up fallback when capabilities are unavailable', async ({
    page
  }) => {
    test.slow()
    await setupCloudApp(page, {
      workspace: workspace('personal', 'owner'),
      billingCapabilitiesStatus: 503
    })

    await page.goto(`${APP_URL}/?topup=1`)

    await expect(topUpDialog(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]topup=/)
  })
})
