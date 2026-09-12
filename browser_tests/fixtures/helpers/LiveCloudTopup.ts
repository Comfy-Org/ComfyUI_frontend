import {
  zBillingBalanceResponse,
  zBillingOpStatusResponse,
  zBillingStatusResponse,
  zCreateTopupRequest,
  zCreateTopupResponse,
  zListSavedPaymentMethodsResponse
} from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { TestInfo } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBilling'
import { matchesBillingResponse } from '@e2e/fixtures/helpers/LiveCloudBilling'

export class LiveCloudTopup {
  private readonly dialog

  constructor(
    private readonly comfyPage: ComfyPage,
    private readonly session: LiveCloudBillingSession,
    private readonly frontend: string
  ) {
    this.dialog = comfyPage.page.getByRole('dialog')
  }

  async open() {
    const status = await this.session.read(
      '/api/billing/status',
      zBillingStatusResponse
    )
    expect(status.is_active).toBe(true)
    expect(status.subscription_tier).toBe('CREATOR')
    const methods = await this.session.read(
      '/api/billing/payment-methods',
      zListSavedPaymentMethodsResponse
    )
    expect(methods).not.toHaveLength(0)
    await this.comfyPage.page.goto(`${this.frontend}/?topup=1`)
    await this.dialog.getByRole('button', { name: '$10', exact: true }).click()
    await this.dialog
      .getByRole('button', { name: 'Add credits', exact: true })
      .click()
    await expect(
      this.dialog.getByText(
        'Your saved payment method is charged immediately.',
        { exact: true }
      )
    ).toBeVisible()
  }

  async verifyPurchase(testInfo: TestInfo) {
    const before = await this.session.read(
      '/api/billing/balance',
      zBillingBalanceResponse
    )
    const { topup } = await this.submitPurchase()
    await this.attachPurchase(testInfo, topup, before.amount_micros)
    await expect(
      this.comfyPage.page.getByText('Credits added successfully', {
        exact: true
      })
    ).toBeVisible()
    await this.expectPurchaseComplete(
      topup.billing_op_id,
      before.amount_micros + Number(topup.amount_cents)
    )
    await this.comfyPage.attachScreenshot('saved-card-topup.png', {
      runInCI: true
    })
  }

  async verifyIdempotentRetry(testInfo: TestInfo) {
    const before = await this.session.read(
      '/api/billing/balance',
      zBillingBalanceResponse
    )
    const { request, topup } = await this.submitPurchase()
    expect(request.idempotency_key).toBeTruthy()
    if (!request.idempotency_key) {
      throw new Error('Missing top-up idempotency key')
    }
    const retry = await this.session.post(
      '/api/billing/topup',
      {
        amount_cents: Number(request.amount_cents),
        idempotency_key: request.idempotency_key
      },
      zCreateTopupResponse
    )
    expect(retry.billing_op_id).toBe(topup.billing_op_id)
    expect(retry.topup_id).toBe(topup.topup_id)
    await this.attachPurchase(testInfo, topup, before.amount_micros, {
      retryOperationId: retry.billing_op_id,
      retryTopupId: retry.topup_id
    })
    await this.expectPurchaseComplete(
      topup.billing_op_id,
      before.amount_micros + Number(topup.amount_cents)
    )
  }

  private async submitPurchase() {
    const [response] = await Promise.all([
      this.comfyPage.page.waitForResponse(
        (response) =>
          matchesBillingResponse(
            response,
            this.frontend,
            '/api/billing/topup'
          ) && response.request().method() === 'POST'
      ),
      this.dialog
        .getByRole('button', { name: 'Pay $10.00', exact: true })
        .click()
    ])
    expect(response.status()).toBe(200)
    const request = zCreateTopupRequest.parse(response.request().postDataJSON())
    const topup = zCreateTopupResponse.parse(await response.json())
    expect(topup.amount_cents).toBe(1000n)
    expect(topup.billing_op_id).not.toBe('')
    return { request, topup }
  }

  private async attachPurchase(
    testInfo: TestInfo,
    topup: ReturnType<typeof zCreateTopupResponse.parse>,
    balanceBeforeCents: number,
    extra: Record<string, string> = {}
  ) {
    await testInfo.attach('topup.json', {
      body: JSON.stringify({
        operationId: topup.billing_op_id,
        topupId: topup.topup_id,
        amountCents: Number(topup.amount_cents),
        balanceBeforeCents,
        ...extra
      }),
      contentType: 'application/json'
    })
  }

  private async expectPurchaseComplete(
    operationId: string,
    expectedBalanceCents: number
  ) {
    await expect
      .poll(async () => {
        const operation = await this.session.read(
          `/api/billing/ops/${encodeURIComponent(operationId)}`,
          zBillingOpStatusResponse
        )
        return { id: operation.id, status: operation.status }
      })
      .toMatchObject({ id: operationId, status: 'succeeded' })
    await expect
      .poll(
        async () =>
          (
            await this.session.read(
              '/api/billing/balance',
              zBillingBalanceResponse
            )
          ).amount_micros
      )
      .toBe(expectedBalanceCents)
  }
}
