import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import type {
  BillingOpStatusResponse,
  BillingStatusResponse
} from '@comfyorg/ingest-types'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

import {
  cloudAppFixture as test,
  waitForCloudApp
} from '@e2e/fixtures/cloudAppFixture'
import { mockBilling } from '@e2e/fixtures/utils/cloudBillingMocks'
import { bootCloud, mockCloudBoot } from '@e2e/fixtures/utils/cloudBootMocks'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import {
  member,
  mockWorkspace,
  workspace
} from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:5173'
const SELF_EMAIL = 'e2e@test.comfy.org'
const BOOT_FEATURES = {
  team_workspaces_enabled: true,
  consolidated_billing_enabled: true,
  billing_control_enabled: true
} satisfies RemoteConfig

const BOOT_SETTINGS = {
  'Comfy.Assets.UseAssetAPI': false,
  'Comfy.TutorialCompleted': true
}

async function mockGraphBootExtras(page: Page) {
  await page.route('**/api/settings/**', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({}))
  })
  await page.route('**/api/prompt', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ exec_info: { queue_remaining: 0 } }))
  })
  await page.route('**/api/queue', (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    return route.fulfill(jsonRoute({ queue_running: [], queue_pending: [] }))
  })
}

const OP_ID = 'recovered-3ds-subscription'
const ACTION_URL = 'https://verify.example/3ds-session'

const PENDING_3DS_STATUS = {
  is_active: true,
  subscription_status: 'active',
  subscription_tier: 'TEAM',
  subscription_duration: 'ANNUAL',
  plan_slug: 'team_per_credit_annual',
  billing_status: 'pending_payment',
  has_funds: true,
  renewal_date: '2099-02-20T00:00:00Z',
  team_credit_stop: {
    id: 'team_700',
    credits_monthly: 147_700,
    stop_usd: 700
  },
  pending_billing_op_id: OP_ID,
  action_url: ACTION_URL
} satisfies BillingStatusResponse

const PENDING_OPERATION = {
  id: OP_ID,
  status: 'pending',
  started_at: '2026-07-20T00:00:00Z',
  action_url: ACTION_URL
} satisfies BillingOpStatusResponse

async function setupPending3ds(page: Page, cancelStatus: number) {
  await page.addInitScript(() => {
    window.open = (url) => {
      document.documentElement.dataset.openedUrl = String(url)
      return window
    }
  })
  await mockCloudBoot(page, {
    features: BOOT_FEATURES,
    settings: BOOT_SETTINGS
  })
  await mockGraphBootExtras(page)
  await mockBilling(page)
  await mockWorkspace(page, workspace('team', 'owner'), [
    member({ email: SELF_EMAIL, role: 'owner', is_original_owner: true })
  ])
  await bootCloud(page)

  let canceled = false
  await page.route('**/api/billing/status', (route) =>
    route.fulfill(jsonRoute(PENDING_3DS_STATUS))
  )
  await page.route(`**/api/billing/ops/${OP_ID}/cancel`, (route) => {
    if (cancelStatus < 400) canceled = true
    return route.fulfill({
      status: cancelStatus,
      contentType: 'application/json',
      body: JSON.stringify(
        cancelStatus < 400
          ? {}
          : { code: 'not_cancelable', message: 'Charge already processing' }
      )
    })
  })
  await page.route(`**/api/billing/ops/${OP_ID}`, (route) =>
    route.fulfill(
      jsonRoute(
        canceled
          ? ({
              id: OP_ID,
              status: 'failed',
              error_message: 'canceled',
              started_at: '2026-07-20T00:00:00Z'
            } satisfies BillingOpStatusResponse)
          : PENDING_OPERATION
      )
    )
  )
  await page.route('**/api/billing/subscribe', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'unexpected', message: 'no resubscribe' })
    })
  )
}

const dialog = (page: Page) =>
  page.locator('[aria-labelledby="subscription-required"]')

async function openCheckout(page: Page) {
  await page.goto(`${APP_URL}/?pricing=1`)
  await waitForCloudApp(page)
  await expect(dialog(page)).toBeVisible({ timeout: 15_000 })
}

test.describe('Checkout 3DS verifying re-entry', { tag: '@cloud' }, () => {
  test('verifying re-entry, tab open, cancel unavailable', async ({ page }) => {
    await setupPending3ds(page, 409)
    await openCheckout(page)

    const verifyButton = dialog(page).getByRole('button', {
      name: 'Complete verification'
    })
    await expect(verifyButton).toBeVisible()
    await expect(verifyButton).toBeEnabled()

    await verifyButton.click()
    await expect
      .poll(() => page.locator('html').getAttribute('data-opened-url'))
      .toBe(ACTION_URL)
    await expect(dialog(page).locator('.animate-spin').first()).toBeVisible()

    await dialog(page).getByRole('button', { name: 'Cancel payment' }).click()
    await expect(
      dialog(page).getByText('This payment is already processing')
    ).toBeVisible()
  })

  test('cancel returns to plan selection', async ({ page }) => {
    await setupPending3ds(page, 200)
    await openCheckout(page)

    await dialog(page).getByRole('button', { name: 'Cancel payment' }).click()
    await expect(
      dialog(page).getByRole('heading', { name: 'Choose a Plan' })
    ).toBeVisible()
  })
})
