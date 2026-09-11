import { zSubscribeResponse } from '@comfyorg/ingest-types/zod'

import {
  comfyExpect as expect,
  liveCloudBillingFixture as test
} from '@e2e/fixtures/liveCloudBillingFixture'

const testCheckoutUrl = /^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_test_/

test.describe('Real Cloud checkout recovery', { tag: ['@cloud-live'] }, () => {
  test('resumes an abandoned no-card checkout using the same billing operation', async ({
    comfyPage,
    billingSandbox
  }, testInfo) => {
    const preview = billingSandbox.preview
    const currency =
      preview.amount_due_cents === undefined ? 'USD' : preview.currency
    if (!currency) throw new Error('The live billing preview has no currency')
    const amountDue = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency
    }).format(
      Number(preview.amount_due_cents ?? preview.cost_today_cents) / 100
    )

    await expect(
      comfyPage.page.getByText(`Total due today ${amountDue}`, { exact: true })
    ).toBeVisible()

    await testInfo.attach('preview.png', {
      body: await comfyPage.page.screenshot(),
      contentType: 'image/png'
    })

    const [subscribeResponse, checkout] = await Promise.all([
      comfyPage.page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/billing/subscribe' &&
          response.request().method() === 'POST'
      ),
      comfyPage.page.waitForEvent('popup'),
      comfyPage.page
        .getByRole('button', { name: 'Subscribe to Creator', exact: true })
        .click()
    ])
    expect(subscribeResponse.status()).toBe(200)
    const subscription = zSubscribeResponse.parse(
      await subscribeResponse.json()
    )
    expect(subscription.status).toBe('needs_payment_method')
    expect(subscription.billing_op_id).not.toBe('')
    expect(subscription.payment_method_url).toMatch(testCheckoutUrl)
    await expect(checkout).toHaveURL(testCheckoutUrl)
    await testInfo.attach('stripe-checkout.png', {
      body: await checkout.screenshot(),
      contentType: 'image/png'
    })
    await checkout.close()

    await expect
      .poll(async () => {
        const operation = await billingSandbox.readOperation(
          subscription.billing_op_id
        )
        return {
          id: operation.id,
          status: operation.status,
          phase: operation.phase
        }
      })
      .toEqual({
        id: subscription.billing_op_id,
        status: 'pending',
        phase: 'awaiting_payment_method'
      })

    const resumePayment = comfyPage.page.getByRole('button', {
      name: 'Complete your payment',
      exact: true
    })
    await expect(resumePayment).toBeEnabled()
    await testInfo.attach('resume-payment.png', {
      body: await comfyPage.page.screenshot(),
      contentType: 'image/png'
    })
    const [resumeResponse, resumedCheckout] = await Promise.all([
      comfyPage.page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === '/api/billing/subscribe' &&
          response.request().method() === 'POST'
      ),
      comfyPage.page.waitForEvent('popup'),
      resumePayment.click()
    ])
    expect(resumeResponse.status()).toBe(200)
    const resumedSubscription = zSubscribeResponse.parse(
      await resumeResponse.json()
    )
    expect(resumedSubscription.status).toBe('needs_payment_method')
    expect(resumedSubscription.billing_op_id).toBe(subscription.billing_op_id)
    expect(resumedSubscription.payment_method_url).toMatch(testCheckoutUrl)
    await expect(resumedCheckout).toHaveURL(testCheckoutUrl)
    await resumedCheckout.close()
    await expect(resumePayment).toBeEnabled()
    await expect
      .poll(async () => {
        const operation = await billingSandbox.readOperation(
          subscription.billing_op_id
        )
        return {
          id: operation.id,
          status: operation.status,
          phase: operation.phase
        }
      })
      .toEqual({
        id: subscription.billing_op_id,
        status: 'pending',
        phase: 'awaiting_payment_method'
      })
  })
})
