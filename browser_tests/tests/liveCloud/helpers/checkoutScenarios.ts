import {
  zBillingBalanceResponse,
  zBillingStatusResponse,
  zBillingOpStatusResponse
} from '@comfyorg/ingest-types/zod'
import { expect } from '@playwright/test'
import type { TestInfo } from '@playwright/test'
import type { LiveCloudBillingSession } from '@e2e/fixtures/helpers/LiveCloudBillingSession'
import type { LiveCloudCheckout } from '@e2e/fixtures/helpers/LiveCloudCheckout'
export async function declineCheckout(
  driver: LiveCloudCheckout,
  session: LiveCloudBillingSession,
  testInfo: TestInfo
) {
  const statusBefore = await session.read(
    '/api/billing/status',
    zBillingStatusResponse
  )
  const balanceBefore = await session.read(
    '/api/billing/balance',
    zBillingBalanceResponse
  )
  await driver.open(true)
  const { checkout, subscription } = await driver.startCheckout()
  const observeFailure = async () => {
    await expect(
      driver.page.getByText('Your bank declined this payment', { exact: false })
    ).toBeVisible({ timeout: 60_000 })
    await driver.attachScreenshot('checkout-declined.png')
  }
  await Promise.all([
    observeFailure(),
    driver.submitCard(checkout, '4000000000000341')
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
  expect(status.is_active).toBe(statusBefore.is_active)
  expect([undefined, 'FREE']).toContain(status.subscription_tier)
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
