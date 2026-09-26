import { getLiveCloudEnvironment } from '@e2e/fixtures/utils/liveCloudBillingConfig'
import {
  zBillingStatusResponse,
  zCurrentWorkspaceResponse,
  zListSavedPaymentMethodsResponse,
  zPaymentPortalResponse
} from '@comfyorg/ingest-types/zod'
import type { APIRequestContext, TestInfo } from '@playwright/test'
import { expect } from '@playwright/test'
import type { z } from 'zod'

export class LiveCloudBillingSession {
  private readonly environment: ReturnType<typeof getLiveCloudEnvironment>
  constructor(
    private readonly request: APIRequestContext,
    private readonly backend: string,
    private readonly headers: Record<string, string>
  ) {
    this.environment = getLiveCloudEnvironment(backend)
  }

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
    if (this.environment.stripeMode === 'live') {
      const paymentMethods = await this.read(
        '/api/billing/payment-methods',
        zListSavedPaymentMethodsResponse
      )
      expect(
        paymentMethods,
        'Checkout recovery requires an account without saved payment methods'
      ).toHaveLength(0)
    }
    await testInfo.attach('billing-preflight.json', {
      body: JSON.stringify({
        workspaceId: workspace.id,
        isActive: status.is_active,
        billingStatus: status.billing_status,
        subscriptionTier: status.subscription_tier,
        backend: this.backend
      }),
      contentType: 'application/json'
    })
    if (status.is_active) expect(status.subscription_tier).toBe('FREE')
    else
      expect(['inactive', 'awaiting_payment_method']).toContain(
        status.billing_status
      )
  }

  async ensureProvisioned(returnUrl: string) {
    await this.post(
      '/api/billing/payment-portal',
      { return_url: returnUrl },
      zPaymentPortalResponse
    )
  }
}
