import {
  zBillingBalanceResponse,
  zBillingOpStatusResponse,
  zBillingStatusResponse,
  zCancelSubscriptionAcceptedResponse,
  zCancelSubscriptionResponse,
  zCurrentWorkspaceResponse,
  zListSavedPaymentMethodsResponse,
  zPaymentPortalResponse,
  zPreviewSubscribeResponse,
  zResubscribeResponse,
  zSubscribeResponse
} from '@comfyorg/ingest-types/zod'
import type {
  APIRequestContext,
  Page,
  Response,
  TestInfo
} from '@playwright/test'
import { expect } from '@playwright/test'
import { z } from 'zod'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export class LiveCloudBillingSession {
  constructor(
    private readonly request: APIRequestContext,
    private readonly backend: string,
    private readonly headers: Record<string, string>
  ) {}

  async read<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    const response = await this.request
      .get(new URL(path, this.backend).href, {
        headers: this.headers,
        maxRedirects: 0
      })
      .catch(() => {
        throw new Error(`Cloud billing request failed: ${path}`)
      })
    expect(response.status(), `GET ${path}`).toBe(200)
    return schema.parse(await response.json())
  }

  async post<T>(
    path: string,
    data: Record<string, number | string>,
    schema: z.ZodType<T>,
    acceptedStatuses = [200]
  ): Promise<T> {
    const response = await this.request
      .post(new URL(path, this.backend).href, {
        data,
        headers: this.headers,
        maxRedirects: 0
      })
      .catch(() => {
        throw new Error(`Cloud billing request failed: ${path}`)
      })
    expect(acceptedStatuses, `POST ${path}`).toContain(response.status())
    return schema.parse(await response.json())
  }

  async assertNoCardAccount(testInfo: TestInfo) {
    const workspace = await this.read(
      '/api/workspaces/current',
      zCurrentWorkspaceResponse
    )
    expect(workspace.type).toBe('personal')
    expect(workspace.role).toBe('owner')
    const status = await this.read(
      '/api/billing/status',
      zBillingStatusResponse
    )
    const methods = await this.read(
      '/api/billing/payment-methods',
      zListSavedPaymentMethodsResponse
    )
    await testInfo.attach('billing-preflight.json', {
      body: JSON.stringify({
        workspaceId: workspace.id,
        isActive: status.is_active,
        billingStatus: status.billing_status,
        subscriptionTier: status.subscription_tier,
        paymentMethodCount: methods.length,
        backend: this.backend
      }),
      contentType: 'application/json'
    })
    if (status.is_active) expect(status.subscription_tier).toBe('FREE')
    else
      expect([undefined, 'inactive', 'awaiting_payment_method']).toContain(
        status.billing_status
      )
    expect(methods).toHaveLength(0)
  }

  async expectPending(operationId: string) {
    await expect
      .poll(() =>
        this.read(
          `/api/billing/ops/${encodeURIComponent(operationId)}`,
          zBillingOpStatusResponse
        )
      )
      .toMatchObject({
        id: operationId,
        status: 'pending',
        phase: 'awaiting_payment_method'
      })
  }

  async expectSucceeded(operationId: string) {
    await expect
      .poll(
        async () => {
          const operation = await this.read(
            `/api/billing/ops/${encodeURIComponent(operationId)}`,
            zBillingOpStatusResponse
          )
          return operation.status
        },
        { timeout: 60_000 }
      )
      .toBe('succeeded')
  }

  async ensureProvisioned(returnUrl: string) {
    await this.post(
      '/api/billing/payment-portal',
      { return_url: returnUrl },
      zPaymentPortalResponse
    )
  }
}

export function matchesBillingResponse(
  response: Response,
  frontend: string,
  path: string
) {
  return response.url() === new URL(path, frontend).href
}

export class LiveCloudCheckout {
  private readonly page: Page
  readonly confirmation
  readonly resumePayment
  private readonly subscribe

  constructor(
    private readonly comfyPage: ComfyPage,
    private readonly frontend: string
  ) {
    this.page = comfyPage.page
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

  async abandonCheckout(testInfo: TestInfo, resume = false) {
    const action = resume
      ? this.resumePayment
      : this.subscribe.or(this.resumePayment)
    const { checkout, subscription } = await this.startCheckout(action)
    await testInfo.attach('billing-operation.json', {
      body: JSON.stringify({
        operationId: subscription.billing_op_id,
        status: subscription.status
      }),
      contentType: 'application/json'
    })
    await testInfo.attach('stripe-checkout.png', {
      body: await checkout.screenshot(),
      contentType: 'image/png'
    })
    await checkout.close()
    return subscription.billing_op_id
  }

  async completeCheckout(session: LiveCloudBillingSession, testInfo: TestInfo) {
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
      'checkout-completed.png'
    )
  }

  async completeAuthenticatedCheckout(
    session: LiveCloudBillingSession,
    testInfo: TestInfo
  ) {
    const balanceBefore = await session.read(
      '/api/billing/balance',
      zBillingBalanceResponse
    )
    const preview = await this.open(true)
    const { checkout, subscription } = await this.startCheckout(
      this.subscribe.or(this.resumePayment)
    )
    await this.submitCard(checkout, '4000000000003220')
    const challengeOrigin = 'https://testmode-acs.stripe.com'
    await expect
      .poll(() =>
        checkout
          .frames()
          .some((frame) => frame.url().startsWith(challengeOrigin))
      )
      .toBe(true)
    const challenge = checkout
      .frames()
      .find((frame) => frame.url().startsWith(challengeOrigin))
    if (!challenge) throw new Error('3D Secure challenge did not load')
    const completeAuthentication = challenge.getByRole('button', {
      name: /complete/i
    })
    await expect(completeAuthentication).toBeVisible()
    await testInfo.attach('3ds-challenge.png', {
      body: await checkout.screenshot(),
      contentType: 'image/png'
    })
    await completeAuthentication.click()
    return await this.verifyCheckoutCompletion(
      session,
      testInfo,
      balanceBefore.amount_micros,
      preview,
      subscription.billing_op_id,
      '3ds-completed.png'
    )
  }

  async declineCheckout(session: LiveCloudBillingSession, testInfo: TestInfo) {
    const balanceBefore = await session.read(
      '/api/billing/balance',
      zBillingBalanceResponse
    )
    await this.open(true)
    const { checkout, subscription } = await this.startCheckout(
      this.subscribe.or(this.resumePayment)
    )
    const observeFailure = async () => {
      await expect(
        this.page.getByText('Your bank declined this payment', { exact: false })
      ).toBeVisible()
      await this.attachScreenshot('checkout-declined.png')
    }
    await Promise.all([
      observeFailure(),
      this.submitCard(checkout, '4000000000000341')
    ])
    await expect
      .poll(async () => {
        const operation = await session.read(
          `/api/billing/ops/${encodeURIComponent(subscription.billing_op_id)}`,
          zBillingOpStatusResponse
        )
        return {
          status: operation.status
        }
      })
      .toMatchObject({ status: 'failed' })
    const status = await session.read(
      '/api/billing/status',
      zBillingStatusResponse
    )
    expect(status.subscription_tier).toBe('FREE')
    const balanceAfter = await session.read(
      '/api/billing/balance',
      zBillingBalanceResponse
    )
    expect(balanceAfter.amount_micros).toBe(balanceBefore.amount_micros)
    await testInfo.attach('checkout-decline.json', {
      body: JSON.stringify({
        operationId: subscription.billing_op_id,
        balanceBeforeCents: balanceBefore.amount_micros,
        balanceAfterCents: balanceAfter.amount_micros,
        status: 'failed',
        failureKind: 'card_declined_ui'
      }),
      contentType: 'application/json'
    })
    return { status: 'failed', failureKind: 'card_declined_ui' }
  }

  async failAuthenticatedCheckout(
    session: LiveCloudBillingSession,
    testInfo: TestInfo
  ) {
    const balanceBefore = await session.read(
      '/api/billing/balance',
      zBillingBalanceResponse
    )
    await this.open(true)
    const { checkout, subscription } = await this.startCheckout(
      this.subscribe.or(this.resumePayment)
    )
    await this.submitCard(checkout, '4000000000003220')
    const challengeOrigin = 'https://testmode-acs.stripe.com'
    await expect
      .poll(() =>
        checkout
          .frames()
          .some((frame) => frame.url().startsWith(challengeOrigin))
      )
      .toBe(true)
    const challenge = checkout
      .frames()
      .find((frame) => frame.url().startsWith(challengeOrigin))
    if (!challenge) throw new Error('3D Secure challenge did not load')
    const failAuthentication = challenge.getByRole('button', { name: /fail/i })
    await expect(failAuthentication).toBeVisible()
    await testInfo.attach('3ds-failure-challenge.png', {
      body: await checkout.screenshot(),
      contentType: 'image/png'
    })
    await failAuthentication.click()
    await expect
      .poll(
        async () => {
          const operation = await session.read(
            `/api/billing/ops/${encodeURIComponent(subscription.billing_op_id)}`,
            zBillingOpStatusResponse
          )
          return {
            status: operation.status,
            authenticationState: operation.authentication_state,
            declineReason: operation.decline_reason
          }
        },
        { timeout: 60_000 }
      )
      .toMatchObject({
        status: 'failed',
        authenticationState: 'failed_retryable'
      })
    const status = await session.read(
      '/api/billing/status',
      zBillingStatusResponse
    )
    expect(status.subscription_tier).toBe('FREE')
    const balanceAfter = await session.read(
      '/api/billing/balance',
      zBillingBalanceResponse
    )
    expect(balanceAfter.amount_micros).toBe(balanceBefore.amount_micros)
    await testInfo.attach('3ds-failure.json', {
      body: JSON.stringify({
        operationId: subscription.billing_op_id,
        balanceBeforeCents: balanceBefore.amount_micros,
        balanceAfterCents: balanceAfter.amount_micros,
        authenticationState: 'failed_retryable'
      }),
      contentType: 'application/json'
    })
    return { authenticationState: 'failed_retryable' }
  }

  async verifyCancellationRecovery(
    session: LiveCloudBillingSession,
    testInfo: TestInfo
  ) {
    const balanceBefore = await session.read(
      '/api/billing/balance',
      zBillingBalanceResponse
    )
    const cancel = await session.post(
      '/api/billing/subscription/cancel',
      { idempotency_key: crypto.randomUUID() },
      z.union([
        zCancelSubscriptionResponse,
        zCancelSubscriptionAcceptedResponse
      ]),
      [200, 202]
    )
    await session.expectSucceeded(cancel.billing_op_id)
    await expect
      .poll(() => session.read('/api/billing/status', zBillingStatusResponse))
      .toMatchObject({
        plan_slug: 'creator-monthly',
        subscription_tier: 'CREATOR'
      })
    const canceled = await session.read(
      '/api/billing/status',
      zBillingStatusResponse
    )
    expect(canceled.cancel_at).toBeTruthy()
    const resubscribe = await session.post(
      '/api/billing/subscription/resubscribe',
      { idempotency_key: crypto.randomUUID() },
      zResubscribeResponse
    )
    if (resubscribe.status === 'pending') {
      await session.expectSucceeded(resubscribe.billing_op_id)
    }
    await expect
      .poll(async () => {
        const status = await session.read(
          '/api/billing/status',
          zBillingStatusResponse
        )
        return {
          cancelAt: status.cancel_at,
          planSlug: status.plan_slug,
          subscriptionStatus: status.subscription_status
        }
      })
      .toMatchObject({
        cancelAt: undefined,
        planSlug: 'creator-monthly',
        subscriptionStatus: 'active'
      })
    const balanceAfter = await session.read(
      '/api/billing/balance',
      zBillingBalanceResponse
    )
    expect(balanceAfter.amount_micros).toBe(balanceBefore.amount_micros)
    const result = {
      cancelOperationId: cancel.billing_op_id,
      reactivateOperationId: resubscribe.billing_op_id,
      balanceBeforeCents: balanceBefore.amount_micros,
      balanceAfterCents: balanceAfter.amount_micros
    }
    await testInfo.attach('cancellation-recovery.json', {
      body: JSON.stringify(result),
      contentType: 'application/json'
    })
    return result
  }

  private async submitCard(checkout: Page, cardNumber: string) {
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

  private async verifyCheckoutCompletion(
    session: LiveCloudBillingSession,
    testInfo: TestInfo,
    balanceBeforeCents: number,
    preview: ReturnType<typeof zPreviewSubscribeResponse.parse>,
    operationId: string,
    screenshotName: string
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
    const methods = await session.read(
      '/api/billing/payment-methods',
      zListSavedPaymentMethodsResponse
    )
    expect(methods).toHaveLength(1)
    await testInfo.attach('checkout-completion.json', {
      body: JSON.stringify({
        operationId,
        planSlug: preview.new_plan.slug,
        grantCents: Number(preview.credits_today_cents),
        balanceBeforeCents,
        balanceAfterCents: expectedBalance,
        paymentMethodCount: methods.length
      }),
      contentType: 'application/json'
    })
    await this.page.goto(this.frontend)
    await this.attachScreenshot(screenshotName)
    return {
      operationId,
      planSlug: preview.new_plan.slug,
      grantCents: Number(preview.credits_today_cents),
      paymentMethodCount: methods.length
    }
  }

  private async startCheckout(action = this.subscribe.or(this.resumePayment)) {
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
    const testCheckoutUrl =
      /^https:\/\/checkout\.(?:stripe\.com|comfy\.org)\/c\/pay\/cs_test_/
    expect(subscription.payment_method_url).toMatch(testCheckoutUrl)
    await expect(checkout).toHaveURL(testCheckoutUrl)
    return { checkout, subscription }
  }

  async attachScreenshot(name: string) {
    await this.comfyPage.attachScreenshot(name, { runInCI: true })
  }
}
