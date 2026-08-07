import { expect } from '@playwright/test'
import type {
  PaymentPortalRequest,
  PaymentPortalResponse
} from '@comfyorg/ingest-types'

import { cloudAppFixture as test } from '@e2e/fixtures/cloudAppFixture'
import { WorkspaceBillingSettings } from '@e2e/fixtures/components/WorkspaceBillingSettings'
import {
  PAYMENT_FAILED_TEAM_BILLING_STATUS,
  PAUSED_TEAM_BILLING_STATUS
} from '@e2e/fixtures/data/cloudWorkspace'
import { CLOUD_SELF_EMAIL } from '@e2e/fixtures/helpers/CloudAuthHelper'
import { APP_URL, setupCloudApp } from '@e2e/fixtures/utils/cloudAppSetup'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { member, workspace } from '@e2e/fixtures/utils/workspaceMocks'

test.describe('Team billing recovery visibility', { tag: '@cloud' }, () => {
  test.describe('team owner with a failed payment', () => {
    let settings: WorkspaceBillingSettings
    let portalRequests: PaymentPortalRequest[]

    test.beforeEach(async ({ page }) => {
      portalRequests = []
      await page.addInitScript(() => {
        window.open = (url) => {
          document.documentElement.dataset.openedUrl = String(url)
          return window
        }
      })
      await setupCloudApp(page, {
        workspace: workspace('team', 'owner'),
        members: [
          member({
            email: CLOUD_SELF_EMAIL,
            role: 'owner',
            is_original_owner: true
          })
        ],
        features: {
          billing_control_enabled: true,
          v1_payment_recovery: true
        }
      })
      await page.route('**/api/billing/status', (route) =>
        route.fulfill(jsonRoute(PAYMENT_FAILED_TEAM_BILLING_STATUS))
      )
      await page.route('**/api/billing/payment-portal', (route) => {
        portalRequests.push(route.request().postDataJSON())
        return route.fulfill(
          jsonRoute({
            url: 'https://billing.stripe.com/session/e2e-recovery'
          } satisfies PaymentPortalResponse)
        )
      })
      settings = new WorkspaceBillingSettings(page)
      await settings.open(APP_URL)
    })

    test('TB-22A exposes payment recovery and sends the current return URL', async ({
      page
    }) => {
      await expect(settings.statusBanner).toContainText('Payment failed')
      const returnUrl = page.url()

      await settings.statusBanner
        .getByRole('button', { name: 'Update payment' })
        .click()

      expect(portalRequests).toEqual([{ return_url: returnUrl }])
      await expect
        .poll(() => page.locator('html').getAttribute('data-opened-url'))
        .toBe('https://billing.stripe.com/session/e2e-recovery')
    })
  })

  test.describe('team member with a failed payment', () => {
    let settings: WorkspaceBillingSettings

    test.beforeEach(async ({ page }) => {
      await setupCloudApp(page, {
        workspace: workspace('team', 'member'),
        members: [
          member({
            email: 'creator@test.comfy.org',
            role: 'owner',
            is_original_owner: true
          }),
          member({ email: CLOUD_SELF_EMAIL, role: 'member' })
        ],
        features: {
          billing_control_enabled: true,
          v1_payment_recovery: true
        }
      })
      await page.route('**/api/billing/status', (route) =>
        route.fulfill(jsonRoute(PAYMENT_FAILED_TEAM_BILLING_STATUS))
      )
      settings = new WorkspaceBillingSettings(page)
      await settings.open(APP_URL)
    })

    test('TB-22B keeps payment failure details and recovery private', async () => {
      await expect(settings.statusBanner).toHaveCount(0)
      await expect(
        settings.content.getByRole('button', { name: 'Update payment' })
      ).toHaveCount(0)
      await expect(settings.content).not.toContainText('Payment failed')
    })
  })

  test.describe('team member with a paused subscription', () => {
    let settings: WorkspaceBillingSettings

    test.beforeEach(async ({ page }) => {
      await setupCloudApp(page, {
        workspace: workspace('team', 'member'),
        members: [
          member({
            email: 'creator@test.comfy.org',
            role: 'owner',
            is_original_owner: true
          }),
          member({ email: CLOUD_SELF_EMAIL, role: 'member' })
        ],
        features: {
          billing_control_enabled: true,
          v1_payment_recovery: true
        }
      })
      await page.route('**/api/billing/status', (route) =>
        route.fulfill(jsonRoute(PAUSED_TEAM_BILLING_STATUS))
      )
      settings = new WorkspaceBillingSettings(page)
      await settings.open(APP_URL)
    })

    test('TB-22C shows a role-safe pause notice without billing controls', async () => {
      await expect(settings.statusBanner).toContainText('Subscription paused')
      await expect(settings.statusBanner).toContainText(
        "Ask your workspace owner to restore the workspace's subscription."
      )
      await expect(
        settings.statusBanner.getByRole('button', { name: 'Update payment' })
      ).toHaveCount(0)
    })
  })
})
