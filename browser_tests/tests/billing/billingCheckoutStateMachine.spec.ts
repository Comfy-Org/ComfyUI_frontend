import {
  billingCheckoutExpect as expect,
  billingCheckoutStateMachineFixture as test
} from '@e2e/fixtures/billingCheckoutStateMachineFixture'
import { BillingCheckoutStateMachineHelper as Checkout } from '@e2e/fixtures/helpers/BillingCheckoutStateMachineHelper'
import { jsonRoute } from '@e2e/fixtures/utils/jsonRoute'

test.describe('Billing checkout state machine', { tag: '@cloud' }, () => {
  test('rapid saved-payment submit/Enter sends exactly one subscribe request', async ({
    billingCheckout,
    page
  }) => {
    await billingCheckout.mockDefaultPreview()
    await billingCheckout.mockSubscribe(
      Checkout.subscribeResponse('rapid-submit', 'subscribed')
    )
    await billingCheckout.openCheckout()

    await billingCheckout.subscribeButton.click()
    await page.keyboard.press('Enter')

    await expect.poll(() => billingCheckout.subscribeRequests.length).toBe(1)
    expect(billingCheckout.subscribeBody()).toMatchObject({
      saved_payment_method_id: 'pm_saved_1'
    })
    expect(billingCheckout.subscribeBody().confirmation_token).toBeUndefined()
  })

  test('promo quote race stale/out-of-order cannot win with exact preview counts', async ({
    billingCheckout,
    page
  }) => {
    let releaseStale = () => {}
    const staleGate = new Promise<void>((resolve) => {
      releaseStale = resolve
    })
    await billingCheckout.mockPreview(async (route, index) => {
      if (index === 2) await staleGate
      const code = index === 2 ? 'STALE' : index === 3 ? 'SAVE20' : undefined
      await route.fulfill(jsonRoute(Checkout.quote(code, index)))
    })
    await billingCheckout.openCheckout()
    const promo = page.getByRole('textbox', { name: 'Promo code' })

    await promo.fill('STALE')
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await promo.fill('SAVE20')
    releaseStale()
    await expect.poll(() => billingCheckout.previewRequests.length).toBe(2)
    await page.getByRole('button', { name: 'Apply', exact: true }).click()

    await expect.poll(() => billingCheckout.previewRequests.length).toBe(3)
    await expect(page.getByText('$268.80', { exact: true })).toBeVisible()
    await expect(page.getByText('STALE', { exact: true })).toBeHidden()
  })

  test('actionable ACS then success (one completion surface/action, poll success)', async ({
    billingCheckout
  }) => {
    const id = 'actionable-acs'
    await billingCheckout.installHostedActionBoundary()
    await billingCheckout.mockDefaultPreview()
    await billingCheckout.mockSubscribe(
      Checkout.subscribeResponse(id, 'pending_payment')
    )
    await billingCheckout.mockOperation(id, [
      Checkout.operation(id, 'pending', {
        authentication_state: 'requires_action',
        action_url: 'https://verify.example/acs'
      }),
      Checkout.operation(id, 'succeeded')
    ])
    await billingCheckout.openCheckout()

    await billingCheckout.subscribeButton.click()
    await expect(billingCheckout.verificationButton).toHaveCount(1)
    await billingCheckout.verificationButton.click()

    await expect(billingCheckout.successHeading).toBeVisible()
    await expect.poll(() => billingCheckout.hostedActionCount()).toBe(1)
    expect(billingCheckout.subscribeRequests).toHaveLength(1)
    expect(billingCheckout.operationRequests).toHaveLength(2)
  })

  test('conclusive failed ACS then fresh checkout (old state gone, fresh subscribe exactly once)', async ({
    billingCheckout,
    page
  }) => {
    const id = 'failed-acs'
    const freshId = 'fresh-checkout'
    await billingCheckout.mockDefaultPreview()
    await billingCheckout.mockSubscribeSequence([
      Checkout.subscribeResponse(id, 'pending_payment'),
      Checkout.subscribeResponse(freshId, 'subscribed')
    ])
    await billingCheckout.mockOperation(id, [
      Checkout.operation(id, 'failed', {
        error_message: 'Authentication failed'
      })
    ])
    await billingCheckout.openCheckout()
    await billingCheckout.subscribeButton.click()
    await expect(
      page.getByText("We couldn't update your subscription. Please try again.")
    ).toBeVisible()

    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: 'Change to Creator Yearly' }).click()
    await billingCheckout.subscribeButton.click()

    await expect.poll(() => billingCheckout.subscribeRequests.length).toBe(2)
    await expect(
      page.getByText("We couldn't update your subscription. Please try again.")
    ).toBeHidden()
    await expect(billingCheckout.successHeading).toBeVisible()
  })

  test('terminal decline clears processing/auth/retry surfaces and finite error', async ({
    billingCheckout,
    page
  }) => {
    const id = 'terminal-decline'
    await billingCheckout.mockDefaultPreview()
    await billingCheckout.mockSubscribe(
      Checkout.subscribeResponse(id, 'pending_payment')
    )
    await billingCheckout.mockOperation(id, [
      Checkout.operation(id, 'failed', { error_message: 'Card was declined' })
    ])
    await billingCheckout.openCheckout()

    await billingCheckout.subscribeButton.click()

    await expect(
      page.getByText("We couldn't update your subscription. Please try again.")
    ).toBeVisible()
    await expect(billingCheckout.verificationButton).toBeHidden()
    await expect(
      page.getByRole('button', {
        name: /Retry verification|Check payment status/
      })
    ).toBeHidden()
    await expect(page.getByText(/processing/i)).toBeHidden()
    await expect(page.locator('.p-toast-message-error')).toHaveCount(1)
  })

  test('hosted-return reconciliation immediately polls exact count', async ({
    billingCheckout,
    page
  }) => {
    const id = 'hosted-return'
    await page.route('**/api/billing/status', (route) =>
      route.fulfill(
        jsonRoute({
          is_active: true,
          has_funds: true,
          max_seats: 1,
          occupied_seats: 1,
          subscription_status: 'active',
          subscription_tier: 'CREATOR',
          subscription_duration: 'ANNUAL',
          billing_status: 'pending_payment',
          team_credit_stop: null,
          pending_billing_op_id: id
        })
      )
    )
    await billingCheckout.mockOperation(id, [
      Checkout.operation(id, 'succeeded')
    ])

    await page.goto(
      `${process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'}/?payment_intent=pi_mock&redirect_status=succeeded`
    )

    await expect.poll(() => billingCheckout.operationRequests.length).toBe(1)
    await expect(page).not.toHaveURL(/payment_intent|redirect_status/)
  })
})
