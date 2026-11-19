import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
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
const BILLING_WEB_ORIGIN = 'https://billing-web.example'

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

const SECRET_ONLY_SIGNUP_OPERATION: BillingOpStatusResponse = {
  id: SIGNUP_OP_ID,
  started_at: '2026-11-05T17:15:54Z',
  status: 'pending',
  payment_intent_client_secret: 'pi_signup_secret',
  plan: { slug: 'creator-monthly', duration: 'MONTHLY', tier: 'CREATOR' }
}

async function openBillingTab(
  page: Page,
  serveOperation: Parameters<Page['route']>[1]
) {
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
        unified_billing_settings: true,
        hosted_billing_destination: 'billing_web',
        billing_web_url: BILLING_WEB_ORIGIN
      })
    )
  )
  await page.route(`**/api/billing/ops/${SIGNUP_OP_ID}`, serveOperation)
  await page.route('**/api/billing/payment-methods', (route) =>
    route.fulfill(jsonRoute([]))
  )
  const content = await billing.openPlanAndCreditsSettings('Billing')
  return content.getByTestId('billing-banner-planNotStarted')
}

test.describe('Billing tab plan not started banner', { tag: '@cloud' }, () => {
  test('opens the served payment page for the plan whose first payment is unfinished', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    test.setTimeout(60_000)
    await page
      .context()
      .route(FINISH_PAYMENT_URL, (route) =>
        route.fulfill({ contentType: 'text/html', body: '<title>Pay</title>' })
      )
    const banner = await openBillingTab(page, (route) =>
      route.fulfill(jsonRoute(SIGNUP_OPERATION))
    )

    await expect(banner).toContainText('Your Creator plan hasn’t started')
    await expect(banner).toContainText('Finish paying to start it.')

    const paymentPage = page.waitForEvent('popup')
    await banner.getByRole('button', { name: 'Finish payment' }).click()
    await expect(await paymentPage).toHaveURL(FINISH_PAYMENT_URL)
  })

  test('links Complete verification to billing-web checkout for the served plan when only a client secret is served', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    test.setTimeout(60_000)
    const banner = await openBillingTab(page, (route) =>
      route.fulfill(jsonRoute(SECRET_ONLY_SIGNUP_OPERATION))
    )

    await expect(banner).toContainText('Your Creator plan hasn’t started')
    await expect(banner).toContainText('Finish paying to start it.')
    const verify = banner.getByRole('link', { name: 'Complete verification' })
    await expect(verify).toHaveAttribute(
      'href',
      new RegExp(
        `^${BILLING_WEB_ORIGIN}/v1/checkout\\?product=comfyui&return_to=comfyui_workspace&plan=creator-monthly&workspace=[^&]+&operation=${SIGNUP_OP_ID}$`
      )
    )
    await expect(
      banner.getByRole('button', { name: 'Finish payment' })
    ).toHaveCount(0)
  })

  test('offers View on Plans with no payment link when the payment details fail to load', async ({
    comfyPage
  }) => {
    const { page } = comfyPage
    test.setTimeout(60_000)
    const banner = await openBillingTab(page, (route) =>
      route.fulfill({ status: 500, body: 'unavailable' })
    )

    await expect(banner).toContainText('Your plan hasn’t started')
    await expect(banner).toContainText(
      'Your plan starts once the payment goes through.'
    )
    await expect(
      banner.getByRole('link', { name: 'View on Plans' })
    ).toHaveAttribute('href', /\/profile\/billing\/plans/)
    await expect(
      banner.getByRole('button', { name: 'Finish payment' })
    ).toHaveCount(0)
  })
})
