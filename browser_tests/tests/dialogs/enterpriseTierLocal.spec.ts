import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { mockSystemStats } from '@e2e/fixtures/data/systemStats'
import { CloudAuthHelper } from '@e2e/fixtures/helpers/CloudAuthHelper'

/**
 * Local distribution vs the ENTERPRISE tier.
 *
 * A local build cannot be recalled once core pins it, so the surfaces an
 * unrecognised tier crashed on cloud (credits settings panel, top-up dialog)
 * must provably survive one here. Today local never fetches billing status
 * (`performFetchSubscriptionStatus` returns null off cloud), so the tier
 * cannot reach the policy switch at all — this test is the tripwire for the
 * day that changes (the post-switcher plan flips local onto workspace
 * billing, FE-1619). Both billing rails are mocked to report ENTERPRISE so
 * whichever rail a future local build reads, the tier is waiting for it.
 */
const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const jsonRoute = (body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify(body)
})

const ENTERPRISE_STATUS = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'ENTERPRISE',
  subscription_duration: 'MONTHLY',
  plan_slug: 'enterprise_monthly',
  billing_status: 'paid',
  has_funds: true,
  renewal_date: '2027-04-25T00:00:00Z'
}

async function mockLocalBoot(page: Page) {
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
  await page.route('**/api/settings', (r) =>
    r.fulfill(jsonRoute({ 'Comfy.TutorialCompleted': true }))
  )
  await page.route('**/api/userdata**', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/extensions', (r) => r.fulfill(jsonRoute([])))
  await page.route('**/api/object_info', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/global_subgraphs', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/api/i18n', (r) => r.fulfill(jsonRoute({})))
  await page.route('**/releases**', (r) => r.fulfill(jsonRoute([])))

  await page.route('**/customers/balance', (r) =>
    r.fulfill(
      jsonRoute({
        amount_micros: 4_477_300,
        currency: 'usd',
        effective_balance_micros: 4_477_300
      })
    )
  )
  await page.route('**/customers/status', (r) =>
    r.fulfill(jsonRoute(ENTERPRISE_STATUS))
  )
  await page.route('**/api/billing/status', (r) =>
    r.fulfill(jsonRoute(ENTERPRISE_STATUS))
  )
  await page.route('**/api/billing/balance', (r) =>
    r.fulfill(
      jsonRoute({
        amount_micros: 4_477_300,
        currency: 'usd',
        effective_balance_micros: 4_477_300
      })
    )
  )
}

test.describe('Local distribution with an ENTERPRISE tier', () => {
  test('credits settings and top-up survive an unrecognised tier', async ({
    page
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    await page.setViewportSize({ width: 1440, height: 900 })
    await mockLocalBoot(page)
    const auth = new CloudAuthHelper(page)
    await auth.mockAuth()
    await page.addInitScript(() => {
      localStorage.setItem('Comfy.userId', 'test-user-e2e')
    })
    await page.goto(APP_URL)
    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })

    await page
      .getByRole('button', { name: /^Settings/ })
      .first()
      .click()
    const dialog = page.getByTestId('settings-dialog')
    await expect(dialog).toBeVisible()
    await dialog
      .locator('nav')
      .getByRole('button', { name: /Credits|Workspace|Plan/ })
      .first()
      .click()

    // The credits panel must render rather than dying in a capability lookup.
    await expect(dialog.getByText('Total credits')).toBeVisible({
      timeout: 20_000
    })

    await dialog.getByRole('button', { name: 'Add credits' }).click()
    await expect(
      page
        .getByRole('dialog')
        .getByText(/credits/i)
        .first()
    ).toBeVisible({ timeout: 10_000 })

    expect(pageErrors).toEqual([])
  })
})
