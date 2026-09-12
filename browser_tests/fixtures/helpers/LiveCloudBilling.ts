import {
  zBillingOpStatusResponse,
  zBillingStatusResponse,
  zCurrentWorkspaceResponse,
  zListSavedPaymentMethodsResponse,
  zPreviewSubscribeResponse,
  zSubscribeResponse
} from '@comfyorg/ingest-types/zod'
import type {
  APIRequestContext,
  Page,
  Response,
  TestInfo
} from '@playwright/test'
import { expect } from '@playwright/test'
import type { z } from 'zod'

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
    schema: z.ZodType<T>
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
    expect(response.status(), `POST ${path}`).toBe(200)
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
      expect(['inactive', 'awaiting_payment_method']).toContain(
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

  async open() {
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
    const preview = zPreviewSubscribeResponse.parse(await response.json())
    expect(preview.allowed).toBe(true)
    expect(preview.new_plan.slug).toBe('creator-monthly')
    await expect(
      this.confirmation.getByText('Total due today', { exact: true })
    ).toBeVisible()
    await expect(this.subscribe.or(this.resumePayment)).toBeEnabled()
  }

  async abandonCheckout(testInfo: TestInfo, resume = false) {
    const action = resume
      ? this.resumePayment
      : this.subscribe.or(this.resumePayment)
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

  async attachScreenshot(name: string) {
    await this.comfyPage.attachScreenshot(name, { runInCI: true })
  }
}
