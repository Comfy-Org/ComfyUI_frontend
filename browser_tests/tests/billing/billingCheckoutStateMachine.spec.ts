import { expect, test } from '@e2e/fixtures/billingCheckoutStateMachineFixture'
import { gotoCloudApp } from '@e2e/fixtures/cloudAppFixture'

test.describe('Billing checkout state machine', { tag: '@cloud' }, () => {
  test('submits one successful subscription for rapid click and Enter input', async ({
    billingCheckout,
    page
  }) => {
    billingCheckout.queueSubscribe({
      billing_op_id: 'op-success',
      status: 'subscribed'
    })
    await billingCheckout.openCheckout()

    await billingCheckout.payButton.click({ clickCount: 2 })
    await page.keyboard.press('Enter')

    await expect.poll(() => billingCheckout.subscribeCount()).toBe(1)
    await expect(
      page.getByRole('heading', { name: "You're all set" })
    ).toBeVisible()
  })

  test('accepts one promo mutation while a quote refresh is pending', async ({
    billingCheckout,
    page
  }) => {
    billingCheckout.queuePreview({
      allowed: true,
      transition_type: 'new_subscription',
      effective_at: '2099-01-01T00:00:00Z',
      is_immediate: true,
      cost_today_cents: 30_000,
      cost_next_period_cents: 30_000,
      credits_today_cents: 7_400,
      credits_next_period_cents: 7_400,
      new_plan: {
        slug: 'creator-annual',
        tier: 'CREATOR',
        duration: 'ANNUAL',
        price_cents: 33_600,
        credits_cents: 7_400,
        seat_summary: {
          seat_count: 1,
          total_cost_cents: 33_600,
          total_credits_cents: 7_400
        }
      },
      quote_id: 'promo-quote',
      quote_version: 2,
      promotion_code: 'SAVE10',
      discounts: [
        {
          kind: 'promotion',
          code: 'SAVE10',
          amount_off_cents: 3_600
        }
      ],
      amount_due_cents: 30_000,
      currency: 'usd',
      renewal_amount_cents: 30_000,
      renewal_at: '2100-01-01T00:00:00Z'
    })
    await billingCheckout.openCheckout()
    await billingCheckout.promoInput.fill('SAVE10')

    await billingCheckout.applyPromoButton.click({ clickCount: 2 })

    await expect(page.locator('body')).toContainText(/Promo code\s*SAVE10/)
    expect(
      billingCheckout.requests.filter(
        (request) => request.path === '/api/billing/preview-subscribe'
      )
    ).toHaveLength(2)
  })

  test('retries an actionable ACS challenge and converges to success', async ({
    billingCheckout,
    page
  }) => {
    billingCheckout.queueSubscribe({
      billing_op_id: 'op-acs',
      status: 'pending_payment'
    })
    billingCheckout.queueOperation(
      'op-acs',
      {
        id: 'op-acs',
        status: 'pending',
        started_at: new Date().toISOString(),
        authentication_state: 'requires_action',
        payment_intent_client_secret: 'pi_acs_secret_test',
        action_url: 'https://invoice.stripe.com/hosted-fallback'
      },
      {
        id: 'op-acs',
        status: 'succeeded',
        started_at: new Date().toISOString()
      }
    )
    billingCheckout.failNextStripeAction()
    await billingCheckout.openCheckout()
    await billingCheckout.payButton.click()

    const retry = page.getByRole('button', { name: 'Retry verification' })
    await expect(retry).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Complete verification' })
    ).toBeVisible()
    await retry.click()

    await expect(
      page.getByRole('heading', { name: "You're all set" })
    ).toBeVisible()
  })

  test('starts a fresh checkout after a conclusive ACS failure', async ({
    billingCheckout,
    page
  }) => {
    billingCheckout.queueSubscribe(
      { billing_op_id: 'op-failed', status: 'pending_payment' },
      { billing_op_id: 'op-fresh', status: 'subscribed' }
    )
    billingCheckout.queueOperation('op-failed', {
      id: 'op-failed',
      status: 'failed',
      error_message: 'terminal decline',
      started_at: new Date().toISOString()
    })
    await billingCheckout.openCheckout()
    await billingCheckout.payButton.click()
    await expect(
      page.getByText("We couldn't update your subscription")
    ).toBeVisible()

    await billingCheckout.payButton.click()

    await expect.poll(() => billingCheckout.subscribeCount()).toBe(2)
    await expect(
      page.getByRole('heading', { name: "You're all set" })
    ).toBeVisible()
  })

  test('clears stale verification state after a terminal decline', async ({
    billingCheckout,
    page
  }) => {
    billingCheckout.queueSubscribe({
      billing_op_id: 'op-decline',
      status: 'pending_payment'
    })
    billingCheckout.queueOperation('op-decline', {
      id: 'op-decline',
      status: 'failed',
      error_message: 'declined',
      authentication_state: 'failed_retryable',
      action_url: 'https://invoice.stripe.com/stale',
      payment_intent_client_secret: 'pi_decline_secret_test',
      started_at: new Date().toISOString()
    })
    await billingCheckout.openCheckout()
    await billingCheckout.payButton.click()

    await expect(
      page.getByRole('button', { name: 'Complete verification' })
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Retry verification' })
    ).toHaveCount(0)
    await expect(billingCheckout.payButton).toBeEnabled()
  })

  test('resumes the recovered operation after a hosted payment return', async ({
    billingCheckout,
    page
  }) => {
    billingCheckout.queueOperation('op-return', {
      id: 'op-return',
      status: 'succeeded',
      started_at: new Date().toISOString()
    })
    await page.route('**/api/billing/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_active: false,
          has_funds: true,
          billing_status: 'pending_payment',
          subscription_status: 'ended',
          pending_billing_op_id: 'op-return',
          pending_billing_op_type: 'subscription',
          action_url: 'https://invoice.stripe.com/return',
          team_credit_stop: null
        })
      })
    )

    await gotoCloudApp(
      page,
      `${process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'}/?payment_intent=pi_return&payment_intent_client_secret=pi_return_secret&redirect_status=succeeded`
    )

    await expect
      .poll(() => billingCheckout.operationPollCount('op-return'))
      .toBe(1)
    await expect(page).not.toHaveURL(/payment_intent/)
  })

  test('follows the server billing rail for top-up after a stale client rail', async ({
    billingCheckout
  }) => {
    const outcome = await billingCheckout.topupAfterStaleRail()

    expect(outcome).toEqual({
      billingRail: 'metronome',
      billingType: 'workspace',
      response: {
        billing_op_id: 'topup-server-routed',
        topup_id: 'topup-server-routed',
        status: 'completed',
        amount_cents: 5_000
      }
    })
    expect(billingCheckout.requestCount('/api/billing/topup')).toBe(1)
    expect(billingCheckout.requestCount('/customers/credit')).toBe(0)
  })
})
