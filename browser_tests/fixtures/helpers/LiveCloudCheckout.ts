import { getLiveCloudEnvironment } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import {
  zBillingBalanceResponse,
  zBillingOpStatusResponse,
  zBillingStatusResponse,
  zPaymentPortalResponse,
  zPreviewSubscribeResponse,
  zSubscribeResponse
} from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { Page, Response, TestInfo } from '@playwright/test'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBillingSession'

function matchesBillingResponse(
  response: Response,
  frontend: string,
  path: string
) {
  return response.url() === new URL(path, frontend).href
}

export class LiveCloudCheckout {
  private readonly environment: ReturnType<typeof getLiveCloudEnvironment>
  readonly page: Page
  readonly confirmation
  readonly resumePayment
  readonly paymentMethodsHeading
  readonly savedCards
  private readonly subscribe

  constructor(
    private readonly comfyPage: ComfyPage,
    private readonly frontend: string,
    backend: string
  ) {
    this.environment = getLiveCloudEnvironment(backend)
    this.page = comfyPage.page
    this.paymentMethodsHeading = this.page.getByText(/^Payment methods?$/)
    this.savedCards = this.page.getByText(/•••• \d{4}$/)
    this.confirmation = this.page.getByRole('dialog').filter({
      has: this.page.getByRole('heading', {
        name: 'Confirm your payment',
        exact: true
      })
    })
    this.resumePayment = this.confirmation.getByRole('button', {
      name: 'Complete your payment',
      exact: true
    })
    this.subscribe = this.confirmation.getByRole('button', {
      name: 'Subscribe to Creator',
      exact: true
    })
  }

  async open(retryTransientFailures = false) {
    let preview: ReturnType<typeof zPreviewSubscribeResponse.parse> | undefined
    const loadPreview = async () => {
      const [response] = await Promise.all([
        this.page.waitForResponse((response) =>
          matchesBillingResponse(
            response,
            this.frontend,
            '/api/billing/preview-subscribe'
          )
        ),
        this.page.goto(`${this.frontend}/?pricing=creator&cycle=monthly`)
      ])
      expect(response.status()).toBe(200)
      preview = zPreviewSubscribeResponse.parse(await response.json())
    }
    if (retryTransientFailures) {
      await expect(loadPreview).toPass({ timeout: 90_000 })
    } else {
      await loadPreview()
    }
    if (!preview) throw new Error('Cloud billing preview was not loaded')
    expect(preview.allowed).toBe(true)
    expect(preview.new_plan.slug).toBe('creator-monthly')
    await expect(
      this.confirmation.getByText('Total due today', { exact: true })
    ).toBeVisible()
    await expect(this.subscribe.or(this.resumePayment)).toBeEnabled()
    return preview
  }

  async completeCheckout(
    session: LiveCloudBillingSession,
    testInfo: TestInfo,
    expectedPaymentMethodCount = 1
  ) {
    const balanceBefore = await session.read(
      '/api/billing/balance',
      zBillingBalanceResponse
    )
    const preview = await this.open(true)
    const { checkout, subscription } = await this.startCheckout(
      this.subscribe.or(this.resumePayment)
    )
    await this.submitCard(checkout, '4242424242424242')
    return await this.verifyCheckoutCompletion(
      session,
      testInfo,
      balanceBefore.amount_micros,
      preview,
      subscription.billing_op_id,
      'checkout-completed.png',
      expectedPaymentMethodCount
    )
  }

  async submitCard(checkout: Page, cardNumber: string) {
    await checkout.getByLabel('Card number', { exact: true }).fill(cardNumber)
    await checkout.getByLabel('Expiration', { exact: true }).fill('1230')
    await checkout
      .getByRole('textbox', {
        name: 'Credit or debit card CVC/CVV',
        exact: true
      })
      .fill('123')
    await checkout
      .getByPlaceholder('Full name on card', { exact: true })
      .fill('Comfy Billing Test')
    await checkout
      .getByRole('button', { name: 'Enter address manually', exact: true })
      .click()
    await checkout.locator('#billingAddressLine1').fill('123 Test Street')
    await checkout.getByLabel('City', { exact: true }).fill('San Francisco')
    await checkout.getByLabel('State', { exact: true }).selectOption('CA')
    await checkout.getByLabel('ZIP', { exact: true }).fill('94107')
    await checkout.locator('#enableStripePass').uncheck()
    await checkout.getByRole('button', { name: /^Save/ }).click()
  }

  async verifyCheckoutCompletion(
    session: LiveCloudBillingSession,
    testInfo: TestInfo,
    balanceBeforeCents: number,
    preview: ReturnType<typeof zPreviewSubscribeResponse.parse>,
    operationId: string,
    screenshotName: string,
    expectedPaymentMethodCount = 1
  ) {
    await expect
      .poll(
        async () => {
          const operation = await session.read(
            `/api/billing/ops/${encodeURIComponent(operationId)}`,
            zBillingOpStatusResponse
          )
          return {
            status: operation.status,
            authenticationState: operation.authentication_state,
            phase: operation.phase
          }
        },
        { timeout: 60_000 }
      )
      .toMatchObject({ status: 'succeeded' })
    await expect
      .poll(() => session.read('/api/billing/status', zBillingStatusResponse))
      .toMatchObject({
        is_active: true,
        plan_slug: 'creator-monthly',
        subscription_tier: 'CREATOR'
      })
    const expectedBalance =
      balanceBeforeCents + Number(preview.credits_today_cents)
    await expect
      .poll(
        async () =>
          (await session.read('/api/billing/balance', zBillingBalanceResponse))
            .amount_micros
      )
      .toBe(expectedBalance)
    const paymentMethodCount = await this.verifySavedPaymentMethods(
      session,
      expectedPaymentMethodCount
    )
    await testInfo.attach('checkout-completion.json', {
      body: JSON.stringify({
        operationId,
        planSlug: preview.new_plan.slug,
        grantCents: Number(preview.credits_today_cents),
        balanceBeforeCents,
        balanceAfterCents: expectedBalance,
        paymentMethodCount
      }),
      contentType: 'application/json'
    })
    await this.page.goto(this.frontend)
    await this.attachScreenshot(screenshotName)
    return {
      operationId,
      planSlug: preview.new_plan.slug,
      grantCents: Number(preview.credits_today_cents),
      paymentMethodCount
    }
  }

  async verifySavedPaymentMethods(
    session: LiveCloudBillingSession,
    expectedCount: number
  ) {
    const portal = await session.post(
      '/api/billing/payment-portal',
      { return_url: this.frontend },
      zPaymentPortalResponse
    )
    expect(new URL(portal.url).origin).toBe('https://checkout.comfy.org')
    await this.page.goto(portal.url)
    await expect(this.paymentMethodsHeading).toBeVisible()
    await expect(this.savedCards).toHaveCount(expectedCount)
    return expectedCount
  }

  async startCheckout(action = this.subscribe.or(this.resumePayment)) {
    await expect(action).toBeEnabled()
    const [response, checkout] = await Promise.all([
      this.page.waitForResponse(
        (response) =>
          matchesBillingResponse(
            response,
            this.frontend,
            '/api/billing/subscribe'
          ) && response.request().method() === 'POST'
      ),
      this.page.waitForEvent('popup'),
      action.click()
    ])
    expect(response.status()).toBe(200)
    const subscription = zSubscribeResponse.parse(await response.json())
    expect(subscription.status).toBe('needs_payment_method')
    expect(subscription.billing_op_id).not.toBe('')
    const mode = this.environment.stripeMode
    const testCheckoutUrl = new RegExp(
      `^https://checkout\\.(?:stripe\\.com|comfy\\.org)/c/pay/cs_${mode}_`
    )
    expect(subscription.payment_method_url).toMatch(testCheckoutUrl)
    await expect(checkout).toHaveURL(testCheckoutUrl)
    await expect(
      checkout.getByRole('textbox', { name: 'Card number', exact: true })
    ).toBeVisible()
    return { checkout, subscription }
  }

  async attachScreenshot(name: string) {
    await this.comfyPage.attachScreenshot(name, { runInCI: true })
  }
}
