import {
  zBillingBalanceResponse,
  zBillingOpStatusResponse,
  zBillingStatusResponse,
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
    const topup = zCreateTopupResponse.parse(await response.json())
    expect(topup.amount_cents).toBe(1000n)
    expect(topup.billing_op_id).not.toBe('')
    await testInfo.attach('topup.json', {
      body: JSON.stringify({
        operationId: topup.billing_op_id,
        topupId: topup.topup_id,
        amountCents: Number(topup.amount_cents),
        balanceBeforeCents: before.amount_micros
      }),
      contentType: 'application/json'
    })
    await expect(
      this.comfyPage.page.getByText('Credits added successfully', {
        exact: true
      })
    ).toBeVisible()
    await expect
      .poll(async () => {
        const operation = await this.session.read(
          `/api/billing/ops/${encodeURIComponent(topup.billing_op_id)}`,
          zBillingOpStatusResponse
        )
        return { id: operation.id, status: operation.status }
      })
      .toMatchObject({ id: topup.billing_op_id, status: 'succeeded' })
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
      .toBe(before.amount_micros + Number(topup.amount_cents))
    await this.comfyPage.attachScreenshot('saved-card-topup.png', {
      runInCI: true
    })
  }
}
