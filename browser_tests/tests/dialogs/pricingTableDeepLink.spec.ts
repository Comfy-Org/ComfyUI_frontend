import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { member, workspace } from '@e2e/fixtures/utils/workspaceMocks'

/**
 * The `?pricing=` deep link opens the pricing table on app load, gated to the
 * original owner (canManageSubscriptionLifecycle). Drives a raw `page` so the
 * cloud app boots against fully mocked endpoints, like the survey-gate spec.
 */
const pricingHeading = (page: Page) =>
  page.getByRole('heading', { name: 'Choose a Plan' })

test.describe('Pricing table deep link', { tag: '@cloud' }, () => {
  test('opens the pricing table for a personal owner', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, { workspace: workspace('personal', 'owner') })

    await page.goto(`${APP_URL}/?pricing=1`)

    await expect(pricingHeading(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]pricing=/)
  })

  test('opens on the Team tab for ?pricing=team', async ({ page }) => {
    test.slow()
    await setupCloudApp(page, { workspace: workspace('personal', 'owner') })

    await page.goto(`${APP_URL}/?pricing=team`)

    await expect(pricingHeading(page)).toBeVisible({ timeout: 45_000 })
    await expect(
      page.getByRole('button', { name: 'For Teams' })
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('opens for a team original owner', async ({ page }) => {
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

    await page.goto(`${APP_URL}/?pricing=1`)

    await expect(pricingHeading(page)).toBeVisible({ timeout: 45_000 })
    await expect(page).not.toHaveURL(/[?&]pricing=/)
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

    await page.goto(`${APP_URL}/?pricing=1`)

    await page.waitForFunction(() => !!window.app?.extensionManager, null, {
      timeout: 45_000
    })
    await expect(page).not.toHaveURL(/[?&]pricing=/)
    await expect(pricingHeading(page)).toBeHidden()
  })
})
