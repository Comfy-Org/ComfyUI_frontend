import { expect } from '@playwright/test'
import type {
  BillingOpStatusResponse,
  BillingStatusResponse
} from '@comfyorg/ingest-types'

import { mockCloudComfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  DEFAULT_TEAM_MEMBERS,
  PERSONAL_BILLING_STATUS
} from '@e2e/fixtures/data/cloudWorkspace'
import { CloudWorkspaceMockHelper } from '@e2e/fixtures/helpers/CloudWorkspaceMockHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'
import { workspace } from '@e2e/fixtures/utils/workspaceMocks'

const APP_URL = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
const SIGNUP_OP_ID = 'op-signup'
const FINISH_PAYMENT_URL = new URL('/finish-signup-payment', APP_URL).href

const UNFINISHED_SIGNUP_STATUS: BillingStatusResponse = {
  ...PERSONAL_BILLING_STATUS,
  billing_status: 'pending_payment',
  subscription_status: undefined,
  subscription_state: 'activating',
  subscription_payment_recovery: {
    billing_op_id: SIGNUP_OP_ID,
    reason: 'payment_required'
  }
}

const SIGNUP_OPERATION: BillingOpStatusResponse = {
  id: SIGNUP_OP_ID,
  started_at: '2026-11-05T17:15:54Z',
  status: 'pending',
  action_url: FINISH_PAYMENT_URL,
  plan: { slug: 'creator-monthly', duration: 'MONTHLY', tier: 'CREATOR' }
}

test.describe('Billing tab plan not started banner', { tag: '@cloud' }, () => {
  test('opens the served payment page for the plan whose first payment is unfinished', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    test.setTimeout(60_000)
    const billing = new CloudWorkspaceMockHelper(page)
    await billing.setup(
      DEFAULT_TEAM_MEMBERS,
      workspace('personal', 'owner'),
      UNFINISHED_SIGNUP_STATUS
    )
    await page.route('**/api/features', (route) =>
      route.fulfill(
        jsonRoute({
          billing_new_ux_enabled: true,
          unified_billing_settings: true
        })
      )
    )
    await page.route(`**/api/billing/ops/${SIGNUP_OP_ID}`, (route) =>
      route.fulfill(jsonRoute(SIGNUP_OPERATION))
    )
    await page.route('**/api/billing/payment-methods', (route) =>
      route.fulfill(jsonRoute([]))
    )
    await page
      .context()
      .route(FINISH_PAYMENT_URL, (route) =>
        route.fulfill({ contentType: 'text/html', body: '<title>Pay</title>' })
      )

    const content = await billing.openPlanAndCreditsSettings('Billing')
    const banner = content.getByTestId('billing-banner-planNotStarted')

    await expect(banner).toContainText('Your Creator plan hasn’t started')
    await expect(banner).toContainText('Finish paying to start it.')

    const paymentPage = page.waitForEvent('popup')
    await banner.getByRole('button', { name: 'Finish payment' }).click()
    await expect(await paymentPage).toHaveURL(FINISH_PAYMENT_URL)
  })
})
